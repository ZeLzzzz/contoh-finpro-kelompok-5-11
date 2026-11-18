// REQ-005 AC-2: file lokal dan Upstash harus berperilaku sama.
// Kedua adapter menjalani tes yang sama; Upstash dipalsukan di memori (fetch palsu).
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { createRedisStore } from '../src/pantauan-redis-store.js';
import { createFileStore } from '../src/pantauan-store.js';

// Meniru bagian Upstash REST yang dipakai: HGETALL, HGET, HSET, HDEL pada satu hash.
function createFakeUpstash() {
  const hash = new Map();
  const calls = [];
  async function fakeFetch(url, options) {
    const command = JSON.parse(options.body);
    calls.push({ url, authorization: options.headers.Authorization, command });
    if (options.headers.Authorization !== 'Bearer rahasia') return { ok: false, status: 401, json: async () => ({ error: 'Unauthorized' }) };
    const [name, , field, value] = command;
    let result;
    if (name === 'HGETALL') result = [...hash].flat();
    else if (name === 'HGET') result = hash.get(field) ?? null;
    else if (name === 'HSET') { result = hash.has(field) ? 0 : 1; hash.set(field, value); }
    else if (name === 'HDEL') result = hash.delete(field) ? 1 : 0;
    else return { ok: false, status: 400, json: async () => ({ error: `ERR unknown command ${name}` }) };
    return { ok: true, status: 200, json: async () => ({ result }) };
  }
  return { fakeFetch, calls };
}

const item = (id, extra = {}) => ({ id, komoditas: 'beras-medium', provinsi: 'BALI', catatan: '', status: 'dipantau', dibuat: '2026-01-01T00:00:00.000Z', diubah: '2026-01-01T00:00:00.000Z', ...extra });

async function runContract(store) {
  assert.deepEqual(await store.list(), [], 'kosong di awal');
  await store.create(item('a'));
  await store.create(item('b', { provinsi: 'ACEH' }));
  assert.equal((await store.list()).length, 2);
  assert.equal((await store.get('a')).provinsi, 'BALI');
  assert.equal(await store.get('tidak-ada'), null);
  const updated = await store.update('a', { catatan: 'baru', status: 'selesai' });
  assert.equal(updated.catatan, 'baru');
  assert.equal((await store.get('a')).status, 'selesai');
  assert.equal(await store.update('tidak-ada', { catatan: 'x' }), null);
  assert.equal(await store.remove('a'), true);
  assert.equal(await store.remove('a'), false);
  assert.deepEqual((await store.list()).map((x) => x.id), ['b']);
}

test('REQ-005 AC-2: adapter file memenuhi kontrak', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'pantauan-'));
  try {
    await runContract(createFileStore(join(folder, 'pantauan.json')));
  } finally {
    await rm(folder, { recursive: true });
  }
});

test('REQ-005 AC-2: adapter Upstash memenuhi kontrak yang sama', async () => {
  const { fakeFetch, calls } = createFakeUpstash();
  await runContract(createRedisStore({ url: 'https://contoh.upstash.io', token: 'rahasia', fetchFunction: fakeFetch }));
  assert.ok(calls.length > 0);
  assert.ok(calls.every((call) => call.url === 'https://contoh.upstash.io' && call.authorization === 'Bearer rahasia'));
});

test('REQ-005: kesalahan dari Upstash (token salah) dilempar, bukan ditelan', async () => {
  const { fakeFetch } = createFakeUpstash();
  const store = createRedisStore({ url: 'https://contoh.upstash.io', token: 'salah', fetchFunction: fakeFetch });
  await assert.rejects(() => store.list(), /Upstash/);
});
