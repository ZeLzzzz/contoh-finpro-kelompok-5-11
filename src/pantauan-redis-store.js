// Adapter penyimpanan pantauan di Upstash Redis (REQ-005), untuk Vercel.
// Antarmukanya sama dengan createFileStore di pantauan-store.js, jadi route tidak berubah.
//
// Upstash dipanggil lewat REST API dengan fetch biasa, tanpa library tambahan:
// POST {url} dengan isi ["PERINTAH", "argumen", ...] dan header Authorization.
// Data disimpan sebagai hash Redis: satu field per item, nama field = id, isi = JSON item.
// Karena tiap item punya field sendiri, dua orang yang mengubah item berbeda tidak saling menimpa.
const KEY = 'pantauan';

export function createRedisStore({ url, token, fetchFunction = fetch }) {
  // Mengirim satu perintah Redis dan mengembalikan hasilnya.
  async function run(...command) {
    const response = await fetchFunction(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(command),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body.error) throw new Error(`Upstash: ${body.error ?? response.status}`);
    return body.result;
  }

  async function get(id) {
    const text = await run('HGET', KEY, id);
    return text ? JSON.parse(text) : null;
  }

  return {
    async list() {
      // HGETALL membalas [field1, nilai1, field2, nilai2, ...]
      const flat = (await run('HGETALL', KEY)) ?? [];
      const items = [];
      for (let i = 1; i < flat.length; i += 2) items.push(JSON.parse(flat[i]));
      return items;
    },

    get,

    async create(item) {
      await run('HSET', KEY, item.id, JSON.stringify(item));
      return item;
    },

    async update(id, changes) {
      const current = await get(id);
      if (!current) return null;
      const updated = { ...current, ...changes };
      await run('HSET', KEY, id, JSON.stringify(updated));
      return updated;
    },

    async remove(id) {
      const deleted = await run('HDEL', KEY, id);
      return deleted > 0;
    },
  };
}
