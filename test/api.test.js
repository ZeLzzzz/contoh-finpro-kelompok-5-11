import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { after, before, test } from 'node:test';
import { createApp } from '../src/app.js';
import { createHargaService } from '../src/harga-service.js';

// Memakai data asli di data/harga.json, jadi tes ini juga memeriksa data yang dikirim ke pengguna.
let server;
let baseUrl;

before(async () => {
  const data = JSON.parse(await readFile(new URL('../data/harga.json', import.meta.url), 'utf8'));
  server = createApp({ hargaService: createHargaService(data) }).listen(0);
  baseUrl = `http://localhost:${server.address().port}`;
});
after(() => server.close());

const get = (path) => fetch(baseUrl + path);

test('REQ-001 AC-1: /api/harga membalas tren bulanan beras medium', async () => {
  const response = await get('/api/harga?komoditas=beras-medium&provinsi=JAWA%20TIMUR&periode=2020-01:2024-05');
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.titik.length, 53); // Jan 2020 - Mei 2024
  assert.equal(body.terakhir.bulan, '2024-05');
  assert.ok(body.terakhir.harga > 5000 && body.terakhir.harga < 50000);
  assert.ok(body.terakhir.pasar >= 1);
});

test('REQ-001 AC-3: input tidak valid dibalas 400 dengan pesan JSON', async () => {
  for (const path of ['/api/harga?provinsi=ATLANTIS', '/api/harga?provinsi=BALI&komoditas=durian', '/api/harga?provinsi=BALI&periode=abc']) {
    const response = await get(path);
    assert.equal(response.status, 400, path);
    assert.match((await response.json()).pesan, /\w+/);
  }
});

test('REQ-001 AC-4: periode di luar data dibalas 200 dengan titik kosong', async () => {
  const body = await (await get('/api/harga?provinsi=BALI&periode=2030-01:2030-12')).json();
  assert.deepEqual(body.titik, []);
});

test('REQ-001 AC-6: respons hanya berisi satu titik per bulan dan kecil', async () => {
  const text = await (await get('/api/harga?provinsi=JAWA%20BARAT&periode=2020-01:2024-05')).text();
  assert.ok(text.length < 20000, `respons ${text.length} byte`);
  const body = JSON.parse(text);
  assert.equal(new Set(body.titik.map((p) => p.bulan)).size, body.titik.length);
  assert.equal(typeof body.titik[0].pasar, 'number'); // hanya jumlah pasar, bukan daftar baris per pasar
  assert.equal(body.baris, undefined);
});

test('/api/opsi memberi pilihan filter; endpoint tak dikenal dibalas 404 JSON', async () => {
  const options = await (await get('/api/opsi')).json();
  assert.equal(options.provinsi.length, 34);
  assert.equal(options.komoditas.length, 3);
  const missing = await get('/api/tidak-ada');
  assert.equal(missing.status, 404);
  assert.ok((await missing.json()).pesan);
});

test('REQ-001 AC-1: halaman utama disajikan dari folder public', async () => {
  const response = await get('/');
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<html lang="id">/);
  assert.match(html, /Tidak ada data untuk pilihan ini/);
  assert.match(html, /bukan harga toko atau harga hari ini/);
});
