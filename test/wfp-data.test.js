import assert from 'node:assert/strict';
import { test } from 'node:test';
import { filterRows, parseCsv } from '../src/wfp-data.js';

const HEADER = 'date,admin1,admin2,market,market_id,latitude,longitude,category,commodity,commodity_id,unit,priceflag,pricetype,currency,price,usdprice';

// Membuat satu baris CSV; bagian yang diisi `overrides` menggantikan nilai bawaan.
function csvLine(overrides = {}) {
  const row = {
    date: '2023-05-15', admin1: 'JAWA TIMUR', market: 'Pasar A', commodity: 'Rice (medium quality)',
    unit: 'KG', priceflag: 'aggregate', pricetype: 'Retail', currency: 'IDR', price: '12000', ...overrides,
  };
  return `${row.date},${row.admin1},,${row.market},1,,,cereals,${row.commodity},1,${row.unit},${row.priceflag},${row.pricetype},${row.currency},${row.price},0.8`;
}

const keep = (overrides) => filterRows(parseCsv([HEADER, csvLine(overrides)].join('\n')));

test('REQ-001 AC-2: baris Retail, IDR, KG, aggregate dipertahankan', () => {
  assert.deepEqual(keep({}), [
    { komoditas: 'beras-medium', provinsi: 'JAWA TIMUR', pasar: 'Pasar A', bulan: '2023-05', harga: 12000 },
  ]);
});

test('REQ-001 AC-2: baris yang tidak boleh dicampur dibuang', () => {
  assert.equal(keep({ market: 'National Average', admin1: '' }).length, 0, 'National Average');
  assert.equal(keep({ priceflag: 'actual' }).length, 0, 'seri actual');
  assert.equal(keep({ pricetype: 'Wholesale' }).length, 0, 'bukan Retail');
  assert.equal(keep({ currency: 'USD' }).length, 0, 'bukan IDR');
  assert.equal(keep({ unit: 'L' }).length, 0, 'bukan KG');
  assert.equal(keep({ commodity: 'Rice' }).length, 0, 'mutu lain');
  assert.equal(keep({ date: '2019-12-15' }).length, 0, 'sebelum Jan 2020');
  assert.equal(keep({ price: '0' }).length, 0, 'harga nol');
});

test('parseCsv membaca sel yang memakai tanda kutip dan melewati baris metadata HXL', () => {
  const text = [HEADER, '#date,#adm1+name', csvLine({ market: '"Pasar, Besar"' })].join('\n');
  const rows = parseCsv(text);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].market, 'Pasar, Besar');
});
