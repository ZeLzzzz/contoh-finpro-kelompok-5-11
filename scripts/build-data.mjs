// Membuat data/harga.json dari CSV harga pangan WFP/HDX.
// Jalankan: npm run build-data            (mengunduh CSV, sekitar 52 MB)
//       atau: npm run build-data -- path/ke/wfp_food_prices_idn.csv
// Hasilnya (sekitar 1-2 MB) disimpan di repo, jadi aplikasi tidak perlu CSV besar itu.
import { readFile, writeFile } from 'node:fs/promises';
import { filterRows, parseCsv } from '../src/wfp-data.js';

const CSV_URL =
  'https://data.humdata.org/dataset/72cc0659-142b-41af-821a-cb981a852617/resource/2c0e732c-1d93-4366-8f19-0397064ac5d7/download/wfp_food_prices_idn.csv';

async function readCsvText() {
  const localPath = process.argv[2];
  if (localPath) return readFile(localPath, 'utf8');
  console.log('Mengunduh CSV dari HDX...');
  const response = await fetch(CSV_URL);
  if (!response.ok) throw new Error(`Unduhan gagal: HTTP ${response.status}`);
  return response.text();
}

const csvText = await readCsvText();
const allRows = parseCsv(csvText);
const rows = filterRows(allRows);

const data = {
  dibuat: new Date().toISOString().slice(0, 10),
  sumber: 'WFP/HDX: Indonesia - Food Prices (CC BY-IGO)',
  kolom: ['komoditas', 'provinsi', 'pasar', 'bulan', 'harga'],
  baris: rows.map((row) => [row.komoditas, row.provinsi, row.pasar, row.bulan, row.harga]),
};

await writeFile('data/harga.json', JSON.stringify(data));
console.log(`Baris CSV: ${allRows.length}, tersimpan: ${rows.length}`);
