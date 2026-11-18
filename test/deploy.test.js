// REQ-005: pemilihan penyimpanan lewat variabel lingkungan, dan pintu masuk Vercel.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { after, before, test } from 'node:test';
import { createApp } from '../src/app.js';
import { chooseStore } from '../src/choose-store.js';
import { createHargaService } from '../src/harga-service.js';
import { createRedisStore } from '../src/pantauan-redis-store.js';

test('REQ-005 AC-2: variabel Upstash memilih adapter Upstash, tanpa itu lokal memakai berkas', async () => {
  const calls = [];
  const fetchFunction = async (url, options) => {
    calls.push({ url, body: options.body });
    return { ok: true, status: 200, json: async () => ({ result: [] }) };
  };
  // chooseStore memakai fetch global; ganti sebentar supaya tidak ada panggilan jaringan sungguhan.
  const realFetch = globalThis.fetch;
  globalThis.fetch = fetchFunction;
  try {
    await chooseStore({ UPSTASH_REDIS_REST_URL: 'https://a.upstash.io', UPSTASH_REDIS_REST_TOKEN: 't' }, '/tmp/x.json').list();
    await chooseStore({ KV_REST_API_URL: 'https://b.upstash.io', KV_REST_API_TOKEN: 't' }, '/tmp/x.json').list();
  } finally {
    globalThis.fetch = realFetch;
  }
  assert.deepEqual(calls.map((call) => call.url), ['https://a.upstash.io', 'https://b.upstash.io']);
  assert.equal(typeof createRedisStore, 'function');
});

// Aplikasi "produksi" tanpa variabel Upstash: VERCEL ada, URL dan token tidak.
let server;
let baseUrl;
before(async () => {
  const data = JSON.parse(await readFile(new URL('../data/harga.json', import.meta.url), 'utf8'));
  const pantauanStore = chooseStore({ VERCEL: '1' }, '/tmp/tidak-dipakai.json');
  server = createApp({ hargaService: createHargaService(data), pantauanStore }).listen(0);
  baseUrl = `http://localhost:${server.address().port}`;
});
after(() => server.close());

test('REQ-005 AC-3: tanpa konfigurasi di produksi, API pantauan membalas 503 dan dasbor harga tetap jalan', async () => {
  for (const [method, path] of [['GET', '/api/pantauan'], ['DELETE', '/api/pantauan/x']]) {
    const response = await fetch(baseUrl + path, { method });
    assert.equal(response.status, 503, `${method} ${path}`);
    assert.match((await response.json()).pesan, /UPSTASH_REDIS_REST_URL/);
  }
  const post = await fetch(`${baseUrl}/api/pantauan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ komoditas: 'beras-medium', provinsi: 'BALI' }),
  });
  assert.equal(post.status, 503);
  const prices = await fetch(`${baseUrl}/api/harga?provinsi=BALI`);
  assert.equal(prices.status, 200);
});

test('REQ-005 AC-1: api/index.js (pintu masuk Vercel) menyajikan API dan vercel.json mengarahkan /api ke sana', async () => {
  const { default: vercelApp } = await import('../api/index.js');
  const vercelServer = vercelApp.listen(0);
  try {
    const response = await fetch(`http://localhost:${vercelServer.address().port}/api/harga?provinsi=BALI`);
    assert.equal(response.status, 200);
  } finally {
    vercelServer.close();
  }
  const config = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
  assert.deepEqual(config.rewrites[0], { source: '/api/:path*', destination: '/api/index.js' });
});

test('REQ-005 AC-4: .env.example ada, .env dan node_modules diabaikan git', async () => {
  const example = await readFile(new URL('../.env.example', import.meta.url), 'utf8');
  assert.match(example, /UPSTASH_REDIS_REST_URL=\n/);
  assert.match(example, /UPSTASH_REDIS_REST_TOKEN=\n/);
  const ignore = await readFile(new URL('../.gitignore', import.meta.url), 'utf8');
  assert.match(ignore, /^\.env$/m);
  assert.match(ignore, /^node_modules\/$/m);
});
