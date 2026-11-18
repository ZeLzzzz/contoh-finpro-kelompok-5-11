// Memilih penyimpanan pantauan berdasarkan variabel lingkungan (REQ-005).
//   - Ada URL dan token Upstash  -> Upstash Redis (produksi di Vercel)
//   - Tidak ada, berjalan di Vercel -> penyimpanan "belum dikonfigurasi": API pantauan membalas 503
//   - Tidak ada, berjalan lokal  -> file data/pantauan.json
// Kode aplikasi di tempat lain tidak tahu penyimpanan mana yang dipakai.
import { PantauanError } from './pantauan-service.js';
import { createRedisStore } from './pantauan-redis-store.js';
import { createFileStore } from './pantauan-store.js';

// Nama variabel dari integrasi Upstash di Vercel (KV_REST_API_*) atau dari dashboard Upstash langsung.
function readUpstashSettings(env) {
  const url = env.UPSTASH_REDIS_REST_URL ?? env.KV_REST_API_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN ?? env.KV_REST_API_TOKEN;
  return url && token ? { url, token } : null;
}

// Setiap fungsi melempar 503. Halaman Harga tetap jalan karena tidak memakai penyimpanan ini.
function createUnconfiguredStore() {
  const fail = async () => {
    throw new PantauanError(503, {
      pesan: 'Penyimpanan data pantauan belum dikonfigurasi di server ini. Isi UPSTASH_REDIS_REST_URL dan UPSTASH_REDIS_REST_TOKEN.',
    });
  };
  return { list: fail, get: fail, create: fail, update: fail, remove: fail };
}

export function chooseStore(env, localFilePath) {
  const upstash = readUpstashSettings(env);
  if (upstash) return createRedisStore(upstash);
  if (env.VERCEL) return createUnconfiguredStore();
  return createFileStore(localFilePath);
}
