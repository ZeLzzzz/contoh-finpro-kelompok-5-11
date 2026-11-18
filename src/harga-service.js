// Menghitung rata-rata harga bulanan dari data per pasar (REQ-001).
// Dipisah dari Express supaya mudah diuji tanpa menjalankan server.
import { COMMODITIES } from './wfp-data.js';

// Kesalahan yang disebabkan input pengguna; server mengubahnya menjadi respons 400.
export class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.status = 400;
  }
}

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export const METHOD_NOTE =
  'Rata-rata tak berbobot dari pasar yang punya data pada bulan itu (Retail, IDR/KG, priceflag aggregate; baris National Average tidak dipakai). Ini bukan harga representatif nasional.';
export const ATTRIBUTION = 'WFP/HDX, Indonesia - Food Prices (CC BY-IGO)';

// Rata-rata tak berbobot dari daftar harga (dipakai perubahan dua bulan, REQ-002).
function averagePrice(prices) {
  return prices.reduce((sum, price) => sum + price, 0) / prices.length;
}

// Persen perubahan dari acuan `from` ke `to`, dibulatkan satu desimal (REQ-002).
// Acuan nol atau bukan angka tidak bisa dibagi, jadi hasilnya null, bukan Infinity atau NaN.
export function percentChange(from, to) {
  if (!Number.isFinite(from) || !Number.isFinite(to) || from === 0) return null;
  const percent = ((to - from) / from) * 100;
  return Math.round(percent * 10) / 10;
}

// Membaca satu bulan "YYYY-MM" dari query; label dipakai di pesan kesalahan.
function readMonth(value, label) {
  const month = String(value ?? '');
  if (!MONTH_PATTERN.test(month)) {
    throw new ValidationError(`${label} wajib diisi dengan format YYYY-MM, contoh 2023-05.`);
  }
  return month;
}

// Membuat "layanan" harga dari isi data/harga.json.
export function createHargaService(data) {
  const rows = data.baris.map(([komoditas, provinsi, pasar, bulan, harga]) => ({
    komoditas,
    provinsi,
    pasar,
    bulan,
    harga,
  }));
  const provinces = [...new Set(rows.map((row) => row.provinsi))].sort();
  const months = [...new Set(rows.map((row) => row.bulan))].sort();
  const firstMonth = months[0];
  const lastMonth = months[months.length - 1];

  // Daftar pilihan untuk form filter.
  function getOptions() {
    return {
      komoditas: Object.entries(COMMODITIES).map(([kode, item]) => ({ kode, nama: item.nama })),
      provinsi: provinces,
      bulan: months,
      periode: { dari: firstMonth, sampai: lastMonth },
    };
  }

  // Membaca "2020-01:2024-05" menjadi { dari, sampai }. Kosong = seluruh data.
  function parsePeriod(text) {
    if (text === undefined || text === '') return { dari: firstMonth, sampai: lastMonth };
    const [dari, sampai, extra] = String(text).split(':');
    if (extra !== undefined || !MONTH_PATTERN.test(dari ?? '') || !MONTH_PATTERN.test(sampai ?? '')) {
      throw new ValidationError('Periode harus berbentuk YYYY-MM:YYYY-MM, contoh 2023-01:2024-05.');
    }
    if (dari > sampai) throw new ValidationError('Bulan awal tidak boleh setelah bulan akhir.');
    return { dari, sampai };
  }

  function getPrices(query) {
    const commodityCode = query.komoditas ?? 'beras-medium';
    const commodity = COMMODITIES[commodityCode];
    if (!commodity) {
      throw new ValidationError(`Komoditas "${commodityCode}" tidak dikenal. Pilihan: ${Object.keys(COMMODITIES).join(', ')}.`);
    }

    const province = String(query.provinsi ?? '').toUpperCase();
    if (!provinces.includes(province)) {
      throw new ValidationError(province ? `Provinsi "${query.provinsi}" tidak dikenal.` : 'Parameter provinsi wajib diisi.');
    }

    const period = parsePeriod(query.periode);

    // Kumpulkan harga per bulan: { '2023-01': [10000, 10200, ...] }
    const pricesByMonth = {};
    for (const row of rows) {
      if (row.komoditas !== commodityCode || row.provinsi !== province) continue;
      if (row.bulan < period.dari || row.bulan > period.sampai) continue;
      (pricesByMonth[row.bulan] ??= []).push(row.harga);
    }

    const monthKeys = Object.keys(pricesByMonth).sort();
    const maxMarkets = Math.max(0, ...monthKeys.map((month) => pricesByMonth[month].length));
    const points = monthKeys.map((month) => {
      const prices = pricesByMonth[month];
      const average = prices.reduce((sum, price) => sum + price, 0) / prices.length;
      return {
        bulan: month,
        harga: Math.round(average),
        pasar: prices.length,
        cakupan: prices.length === maxMarkets ? 'penuh' : 'sebagian',
      };
    });

    return {
      komoditas: { kode: commodityCode, nama: commodity.nama, satuan: commodity.satuan },
      provinsi: province,
      periode: period,
      titik: points,
      terakhir: points.at(-1) ?? null,
      pasarMaksimum: maxMarkets,
      dataTerakhir: lastMonth,
      metode: METHOD_NOTE,
      atribusi: ATTRIBUTION,
    };
  }

  // Perubahan harga antara dua bulan (REQ-002). Hanya pasar yang punya data di kedua bulan yang dihitung.
  function getChange(query) {
    const commodityCode = String(query.komoditas ?? 'beras-medium');
    // Object.hasOwn menolak nama bawaan JavaScript seperti "constructor", yang juga ada di objek biasa.
    if (!Object.hasOwn(COMMODITIES, commodityCode)) {
      throw new ValidationError(`Komoditas "${commodityCode}" tidak dikenal. Pilihan: ${Object.keys(COMMODITIES).join(', ')}.`);
    }
    const commodity = COMMODITIES[commodityCode];

    const province = String(query.provinsi ?? '').toUpperCase();
    if (!provinces.includes(province)) {
      throw new ValidationError(province ? `Provinsi "${query.provinsi}" tidak dikenal.` : 'Parameter provinsi wajib diisi.');
    }

    const from = readMonth(query.dari, 'Bulan awal');
    const to = readMonth(query.sampai, 'Bulan akhir');
    if (from > to) throw new ValidationError('Bulan awal tidak boleh setelah bulan akhir.');

    // Harga tiap pasar di bulan awal dan bulan akhir: nama pasar -> harga.
    // Map dipakai supaya nama pasar apa pun aman dijadikan kunci.
    const fromPrices = new Map();
    const toPrices = new Map();
    for (const row of rows) {
      if (row.komoditas !== commodityCode || row.provinsi !== province) continue;
      if (row.bulan === from) fromPrices.set(row.pasar, row.harga);
      if (row.bulan === to) toPrices.set(row.pasar, row.harga);
    }

    // Pasar yang sama = punya data di kedua bulan. Pasar yang hanya ada di satu bulan tidak ikut.
    const sharedMarkets = [...fromPrices.keys()].filter((market) => toPrices.has(market));
    const base = {
      komoditas: { kode: commodityCode, nama: commodity.nama, satuan: commodity.satuan },
      provinsi: province,
      dari: from,
      sampai: to,
      pasarSama: sharedMarkets.length,
    };
    if (sharedMarkets.length === 0) {
      return {
        ...base,
        awal: null,
        akhir: null,
        selisih: null,
        persen: null,
        tidakDapatDihitung: 'Perubahan tidak dapat dihitung: tidak ada pasar yang punya data di kedua bulan ini.',
      };
    }

    // Persen dihitung dari rata-rata yang belum dibulatkan, supaya 10.000 ke 12.000 tepat 20.
    const fromAverage = averagePrice(sharedMarkets.map((market) => fromPrices.get(market)));
    const toAverage = averagePrice(sharedMarkets.map((market) => toPrices.get(market)));
    const persen = percentChange(fromAverage, toAverage);
    const awal = Math.round(fromAverage);
    const akhir = Math.round(toAverage);

    return {
      ...base,
      awal,
      akhir,
      selisih: akhir - awal,
      persen,
      tidakDapatDihitung: persen === null ? 'Perubahan tidak dapat dihitung: harga awal nol atau tidak tersedia.' : null,
    };
  }

  return { getOptions, getPrices, getChange };
}
