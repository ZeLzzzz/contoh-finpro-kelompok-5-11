import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import { createApp } from '../src/app.js';
import { createHargaService } from '../src/harga-service.js';
import { createFileStore } from '../src/pantauan-store.js';

// Berkas penyimpanan ada di folder sementara, bukan di data/pantauan.json.
let server;
let baseUrl;
let tempFolder;
let filePath;

before(async () => {
  const data = JSON.parse(await readFile(new URL('../data/harga.json', import.meta.url), 'utf8'));
  tempFolder = await mkdtemp(join(tmpdir(), 'pantauan-'));
  filePath = join(tempFolder, 'pantauan.json');
  const app = createApp({ hargaService: createHargaService(data), pantauanStore: createFileStore(filePath) });
  server = app.listen(0);
  baseUrl = `http://localhost:${server.address().port}`;
});
after(async () => {
  server.close();
  await rm(tempFolder, { recursive: true, force: true });
});

const send = (method, path, body) =>
  fetch(baseUrl + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const add = (body) => send('POST', '/api/pantauan', body);

test('REQ-004 AC-1: POST membalas 201 dengan id, item muncul di daftar (terbaru dulu)', async () => {
  const first = await add({ komoditas: 'beras-medium', provinsi: 'bali', catatan: '  Cek pasar  ', status: 'selesai' });
  assert.equal(first.status, 201);
  const item = await first.json();
  assert.ok(item.id);
  assert.equal(item.provinsi, 'BALI'); // huruf besar
  assert.equal(item.catatan, 'Cek pasar'); // dipangkas
  assert.equal(item.status, 'dipantau'); // status dari klien diabaikan

  await new Promise((resolve) => setTimeout(resolve, 5));
  const second = await (await add({ komoditas: 'beras-medium', provinsi: 'JAWA TIMUR' })).json();
  assert.equal(second.catatan, ''); // catatan boleh kosong

  const list = await (await send('GET', '/api/pantauan')).json();
  assert.deepEqual(list.map((entry) => entry.id), [second.id, item.id]);
});

test('REQ-004 AC-2: PUT mengubah catatan dan status, tidak mengubah komoditas/provinsi', async () => {
  const item = await (await add({ komoditas: 'gula-lokal', provinsi: 'ACEH' })).json();
  const response = await send('PUT', `/api/pantauan/${item.id}`, {
    catatan: 'Sudah dihubungi dinas',
    status: 'ditindaklanjuti',
    provinsi: 'BALI',
  });
  assert.equal(response.status, 200);
  const updated = await response.json();
  assert.equal(updated.catatan, 'Sudah dihubungi dinas');
  assert.equal(updated.status, 'ditindaklanjuti');
  assert.equal(updated.provinsi, 'ACEH');

  const list = await (await send('GET', '/api/pantauan')).json();
  assert.equal(list.find((entry) => entry.id === item.id).status, 'ditindaklanjuti');

  const bad = await send('PUT', `/api/pantauan/${item.id}`, { status: 'ngawur' });
  assert.equal(bad.status, 400);
  assert.ok((await bad.json()).kolom.status);
});

test('REQ-004 AC-3: DELETE membalas 204 dan item hilang dari daftar', async () => {
  const item = await (await add({ komoditas: 'beras-medium', provinsi: 'ACEH' })).json();
  const response = await send('DELETE', `/api/pantauan/${item.id}`);
  assert.equal(response.status, 204);
  const list = await (await send('GET', '/api/pantauan')).json();
  assert.ok(!list.some((entry) => entry.id === item.id));
});

test('REQ-004 AC-4: komoditas/provinsi di luar daftar dan catatan > 280 dibalas 400 per kolom', async () => {
  const response = await add({ komoditas: 'durian', provinsi: 'ATLANTIS', catatan: 'x'.repeat(281) });
  assert.equal(response.status, 400);
  const body = await response.json();
  assert.equal(body.pesan, 'Data tidak valid.');
  assert.deepEqual(Object.keys(body.kolom).sort(), ['catatan', 'komoditas', 'provinsi']);

  const edge = await add({ komoditas: 'gula-lokal', provinsi: 'BALI', catatan: 'y'.repeat(280) });
  assert.equal(edge.status, 201); // tepat 280 masih boleh
  await send('DELETE', `/api/pantauan/${(await edge.json()).id}`);

  const longEdit = await send('PUT', '/api/pantauan/apa-saja', { catatan: 'z'.repeat(281) });
  assert.equal(longEdit.status, 400);
  assert.ok((await longEdit.json()).kolom.catatan);
});

test('REQ-004 AC-4: JSON rusak dibalas 400 dengan pesan', async () => {
  const response = await fetch(`${baseUrl}/api/pantauan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{rusak',
  });
  assert.equal(response.status, 400);
  assert.match((await response.json()).pesan, /JSON/);
});

test('REQ-004 AC-5: id yang tidak ada dibalas 404 untuk PUT dan DELETE', async () => {
  const put = await send('PUT', '/api/pantauan/tidak-ada', { catatan: 'x' });
  assert.equal(put.status, 404);
  assert.equal((await put.json()).pesan, 'Item tidak ditemukan.');
  const del = await send('DELETE', '/api/pantauan/tidak-ada');
  assert.equal(del.status, 404);
});

test('REQ-004 AC-6: item tersimpan di berkas dan terbaca oleh store baru', async () => {
  const item = await (await add({ komoditas: 'gula-lokal', provinsi: 'BALI', catatan: 'tersimpan' })).json();
  const reopened = createFileStore(filePath); // mirip server dimulai ulang
  assert.equal((await reopened.get(item.id)).catatan, 'tersimpan');
});

test('REQ-004 AC-6: berkas belum ada -> daftar kosong, dan penulisan bersamaan tidak menghilangkan item', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'pantauan-'));
  try {
    const store = createFileStore(join(folder, 'baru', 'pantauan.json'));
    assert.deepEqual(await store.list(), []);
    assert.equal(await store.get('x'), null);
    assert.equal(await store.update('x', {}), null);
    assert.equal(await store.remove('x'), false);
    await Promise.all(Array.from({ length: 20 }, (_, index) => store.create({ id: String(index) })));
    assert.equal((await store.list()).length, 20);
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
});

test('REQ-004 AC-7: komoditas + provinsi sama dengan item aktif ditolak 409; setelah selesai boleh', async () => {
  const item = await (await add({ komoditas: 'minyak-nabati', provinsi: 'PAPUA' })).json();
  const duplicate = await add({ komoditas: 'minyak-nabati', provinsi: 'papua' });
  assert.equal(duplicate.status, 409);
  assert.match((await duplicate.json()).pesan, /\w+/);

  await send('PUT', `/api/pantauan/${item.id}`, { status: 'selesai' });
  const again = await add({ komoditas: 'minyak-nabati', provinsi: 'PAPUA' });
  assert.equal(again.status, 201);

  // Mengaktifkan lagi item selesai tidak boleh membuat duplikat aktif.
  const reopen = await send('PUT', `/api/pantauan/${item.id}`, { status: 'dipantau' });
  assert.equal(reopen.status, 409);
});
