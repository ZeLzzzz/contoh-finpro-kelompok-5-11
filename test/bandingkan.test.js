import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { after, before, test } from 'node:test';
import { createApp } from '../src/app.js';
import { createHargaService, ValidationError } from '../src/harga-service.js';

// Data kecil: beras 4 bulan, gula 2 bulan, minyak tidak ada di JAWA TIMUR.
const data = {
  baris: [
    ['beras-medium', 'JAWA TIMUR', 'Pasar A', '2023-01', 10000],
    ['beras-medium', 'JAWA TIMUR', 'Pasar A', '2023-02', 11000],
    ['beras-medium', 'JAWA TIMUR', 'Pasar A', '2023-03', 12100],
    ['beras-medium', 'JAWA TIMUR', 'Pasar A', '2023-04', 12100],
    ['gula-lokal', 'JAWA TIMUR', 'Pasar A', '2023-01', 14000],
    ['gula-lokal', 'JAWA TIMUR', 'Pasar A', '2023-02', 14700],
    ['minyak-nabati', 'BALI', 'Pasar B', '2023-01', 15000],
  ],
};
const service = createHargaService(data);
const find = (result, kode) => result.komoditas.find((item) => item.kode === kode);

test('REQ-003 AC-1: tiga seri dengan mutu dan satuan', () => {
  const result = service.getComparison({ provinsi: 'JAWA TIMUR' });
  assert.deepEqual(result.komoditas.map((item) => item.mutu), ['Rice (medium quality)', 'Sugar (local)', 'Oil (vegetable)']);
  assert.ok(result.komoditas.every((item) => item.satuan === 'IDR/KG'));
  assert.equal(result.provinsi, 'JAWA TIMUR');
  assert.equal(result.dataTerakhir, '2023-04');
  assert.match(result.atribusi, /WFP\/HDX/);
});

test('REQ-003 AC-1: periode membatasi titik', () => {
  const result = service.getComparison({ provinsi: 'JAWA TIMUR', periode: '2023-02:2023-03' });
  assert.deepEqual(find(result, 'beras-medium').titik.map((p) => p.bulan), ['2023-02', '2023-03']);
});

test('REQ-003 AC-2: indeks bulan pertama = 100 dan harga asli ikut', () => {
  const rice = find(service.getComparison({ provinsi: 'JAWA TIMUR' }), 'beras-medium');
  assert.deepEqual(rice.titik.map((p) => p.indeks), [100, 110, 121, 121]);
  assert.deepEqual(rice.titik.map((p) => p.harga), [10000, 11000, 12100, 12100]);
});

test('REQ-003 AC-3: volatilitas = simpangan baku sampel perubahan bulanan, dengan rumus', () => {
  const result = service.getComparison({ provinsi: 'JAWA TIMUR' });
  // perubahan: 10, 10, 0 -> rata-rata 6.667, sampel sd = 5.77
  assert.equal(find(result, 'beras-medium').volatilitas, 5.77);
  assert.match(result.rumusVolatilitas, /simpangan baku sampel/);
});

test('REQ-003 AC-4: kurang dari 3 bulan -> null dengan alasan, komoditas lain tetap tampil', () => {
  const result = service.getComparison({ provinsi: 'JAWA TIMUR' });
  const sugar = find(result, 'gula-lokal');
  assert.equal(sugar.volatilitas, null);
  assert.match(sugar.alasan, /minimal 3 bulan/);
  assert.equal(sugar.titik.length, 2);
  assert.notEqual(find(result, 'beras-medium').volatilitas, null);
  assert.equal(find(result, 'beras-medium').alasan, null);
});

test('REQ-003 AC-4: komoditas tanpa data -> titik kosong dan volatilitas null', () => {
  const oil = find(service.getComparison({ provinsi: 'JAWA TIMUR' }), 'minyak-nabati');
  assert.deepEqual(oil.titik, []);
  assert.equal(oil.volatilitas, null);
  assert.ok(oil.alasan);
});

test('REQ-003 AC-5: provinsi tidak dikenal atau kosong, dan periode salah -> ValidationError', () => {
  assert.throws(() => service.getComparison({ provinsi: 'ATLANTIS' }), ValidationError);
  assert.throws(() => service.getComparison({}), ValidationError);
  assert.throws(() => service.getComparison({ provinsi: 'BALI', periode: 'abc' }), ValidationError);
});

// ---------- Lewat HTTP, dengan data asli ----------
let server;
let baseUrl;
before(async () => {
  const real = JSON.parse(await readFile(new URL('../data/harga.json', import.meta.url), 'utf8'));
  server = createApp({ hargaService: createHargaService(real) }).listen(0);
  baseUrl = `http://localhost:${server.address().port}`;
});
after(() => server.close());

test('REQ-003 AC-1/AC-3: /api/bandingkan membalas tiga komoditas dengan volatilitas', async () => {
  const response = await fetch(`${baseUrl}/api/bandingkan?provinsi=JAWA%20TIMUR&periode=2020-01:2024-05`);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.komoditas.length, 3);
  for (const item of body.komoditas) {
    assert.equal(item.titik[0].indeks, 100);
    assert.equal(typeof item.volatilitas, 'number');
  }
});

test('REQ-003 AC-4: periode 2 bulan -> volatilitas null', async () => {
  const body = await (await fetch(`${baseUrl}/api/bandingkan?provinsi=JAWA%20TIMUR&periode=2024-04:2024-05`)).json();
  assert.ok(body.komoditas.every((item) => item.volatilitas === null && item.alasan));
});

test('REQ-003 AC-5: provinsi tidak dikenal dibalas 400 dengan pesan JSON', async () => {
  const response = await fetch(`${baseUrl}/api/bandingkan?provinsi=ATLANTIS`);
  assert.equal(response.status, 400);
  assert.match((await response.json()).pesan, /ATLANTIS/);
});
