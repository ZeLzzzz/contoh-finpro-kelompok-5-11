// Membaca CSV WFP dan menyaring baris yang boleh dipakai (aturan G-002).

// Kode komoditas di API -> nama persis di CSV WFP.
export const COMMODITIES = {
  'beras-medium': { nama: 'Beras (mutu medium)', csv: 'Rice (medium quality)', satuan: 'IDR/KG' },
  'gula-lokal': { nama: 'Gula (lokal)', csv: 'Sugar (local)', satuan: 'IDR/KG' },
  'minyak-nabati': { nama: 'Minyak (nabati)', csv: 'Oil (vegetable)', satuan: 'IDR/KG' },
};

// Brief: periode data Jan 2020 - Mei 2024.
export const FIRST_MONTH = '2020-01';

// Memecah satu baris CSV. Tanda kutip dipakai bila sel mengandung koma.
function splitLine(line) {
  const cells = [];
  let current = '';
  let inQuotes = false;
  for (const char of line) {
    if (char === '"') inQuotes = !inQuotes;
    else if (char === ',' && !inQuotes) {
      cells.push(current);
      current = '';
    } else current += char;
  }
  cells.push(current);
  return cells;
}

// Mengubah teks CSV menjadi daftar objek: { date, admin1, market, commodity, ... }.
export function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== '');
  const header = splitLine(lines[0]);
  return lines
    .slice(1)
    .filter((line) => !line.startsWith('#')) // baris metadata HXL
    .map((line) => {
      const cells = splitLine(line);
      return Object.fromEntries(header.map((name, i) => [name, cells[i]]));
    });
}

// Hanya Retail, IDR, KG, priceflag=aggregate, tiga komoditas, tanpa National Average.
export function filterRows(rows) {
  const codeByCsvName = Object.fromEntries(
    Object.entries(COMMODITIES).map(([code, commodity]) => [commodity.csv, code]),
  );
  const result = [];
  for (const row of rows) {
    const code = codeByCsvName[row.commodity];
    const price = Number(row.price);
    const month = row.date.slice(0, 7);
    if (!code) continue;
    if (row.pricetype !== 'Retail' || row.currency !== 'IDR' || row.unit !== 'KG') continue;
    if (row.priceflag !== 'aggregate') continue;
    if (row.market === 'National Average' || !row.admin1) continue;
    if (month < FIRST_MONTH || !(price > 0)) continue;
    result.push({ komoditas: code, provinsi: row.admin1, pasar: row.market, bulan: month, harga: price });
  }
  return result;
}
