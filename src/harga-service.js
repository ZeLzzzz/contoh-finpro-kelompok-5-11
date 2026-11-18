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

  return { getOptions, getPrices };
}
