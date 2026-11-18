// Penyimpanan daftar pantauan lewat "adapter".
//
// Antarmuka adapter (semua fungsi async):
//   list()               -> array semua item
//   get(id)              -> item, atau null bila id tidak ada
//   create(item)         -> item yang disimpan
//   update(id, changes)  -> item setelah diubah, atau null bila id tidak ada
//   remove(id)           -> true bila terhapus, false bila id tidak ada
//
// Layanan dan route hanya memakai antarmuka ini, jadi adapter lain (REQ-005:
// Upstash Redis) bisa dipasang tanpa mengubah route. File ini adalah adapter
// berkas JSON untuk pengembangan lokal.
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export function createFileStore(filePath) {
  // Semua penulisan antre di sini supaya dua POST bersamaan tidak saling menimpa.
  let queue = Promise.resolve();

  async function readItems() {
    try {
      return JSON.parse(await readFile(filePath, 'utf8'));
    } catch (error) {
      if (error.code === 'ENOENT') return []; // berkas belum dibuat
      throw error;
    }
  }

  // Menulis ke berkas sementara lalu me-rename, supaya berkas tidak pernah setengah jadi.
  async function writeItems(items) {
    await mkdir(dirname(filePath), { recursive: true });
    const tempPath = `${filePath}.tmp`;
    await writeFile(tempPath, JSON.stringify(items, null, 2));
    await rename(tempPath, filePath);
  }

  // Menjalankan perubahan satu per satu. Kegagalan satu perubahan tidak menghentikan antrean.
  function change(work) {
    const result = queue.then(work);
    queue = result.catch(() => {});
    return result;
  }

  return {
    list: () => readItems(),

    async get(id) {
      const items = await readItems();
      return items.find((item) => item.id === id) ?? null;
    },

    create: (item) =>
      change(async () => {
        const items = await readItems();
        items.push(item);
        await writeItems(items);
        return item;
      }),

    update: (id, changes) =>
      change(async () => {
        const items = await readItems();
        const index = items.findIndex((item) => item.id === id);
        if (index === -1) return null;
        items[index] = { ...items[index], ...changes };
        await writeItems(items);
        return items[index];
      }),

    remove: (id) =>
      change(async () => {
        const items = await readItems();
        const remaining = items.filter((item) => item.id !== id);
        if (remaining.length === items.length) return false;
        await writeItems(remaining);
        return true;
      }),
  };
}
