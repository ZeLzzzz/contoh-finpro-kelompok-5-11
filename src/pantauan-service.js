// Aturan daftar pantauan (REQ-004): validasi, status, dan larangan duplikat.
// Penyimpanan dilewatkan dari luar (lihat pantauan-store.js), jadi mudah diuji.
import { randomUUID } from 'node:crypto';

export const STATUSES = ['dipantau', 'ditindaklanjuti', 'selesai'];
export const MAX_NOTE_LENGTH = 280;

// Kesalahan yang diubah route menjadi respons HTTP. `body` adalah isi JSON-nya.
export class PantauanError extends Error {
  constructor(status, body) {
    super(body.pesan);
    this.status = status;
    this.body = body;
  }
}

const notFound = () => new PantauanError(404, { pesan: 'Item tidak ditemukan.' });

// store: adapter penyimpanan; komoditasCodes: array kode; provinces: array nama (huruf besar).
export function createPantauanService({ store, komoditasCodes, provinces }) {
  function checkNote(note, fields) {
    if (note.length > MAX_NOTE_LENGTH) {
      fields.catatan = `Catatan paling banyak ${MAX_NOTE_LENGTH} karakter.`;
    }
  }

  // Catatan opsional; bukan teks berarti salah.
  function readNote(value, fields) {
    if (value === undefined || value === null) return '';
    if (typeof value !== 'string') {
      fields.catatan = 'Catatan harus berupa teks.';
      return '';
    }
    const note = value.trim();
    checkNote(note, fields);
    return note;
  }

  function throwIfInvalid(fields) {
    if (Object.keys(fields).length > 0) {
      throw new PantauanError(400, { pesan: 'Data tidak valid.', kolom: fields });
    }
  }

  const isActive = (item) => item.status !== 'selesai';

  async function list() {
    const items = await store.list();
    return items.sort((a, b) => b.dibuat.localeCompare(a.dibuat));
  }

  async function create(input = {}) {
    const fields = {};

    const komoditas = typeof input.komoditas === 'string' ? input.komoditas : '';
    if (!komoditasCodes.includes(komoditas)) fields.komoditas = 'Pilih komoditas dari daftar.';

    const provinceName = typeof input.provinsi === 'string' ? input.provinsi.trim().toUpperCase() : '';
    if (!provinces.includes(provinceName)) fields.provinsi = 'Pilih provinsi dari daftar.';

    const catatan = readNote(input.catatan, fields);
    throwIfInvalid(fields);

    // Satu komoditas + provinsi hanya boleh sekali di antara item yang masih aktif.
    const items = await store.list();
    const duplicate = items.some(
      (item) => isActive(item) && item.komoditas === komoditas && item.provinsi === provinceName,
    );
    if (duplicate) {
      throw new PantauanError(409, { pesan: 'Komoditas dan provinsi ini sudah ada di daftar pantauan aktif.' });
    }

    const now = new Date().toISOString();
    return store.create({
      id: randomUUID(),
      komoditas,
      provinsi: provinceName,
      catatan,
      status: 'dipantau', // status dari klien diabaikan
      dibuat: now,
      diubah: now,
    });
  }

  // Hanya catatan dan status yang boleh berubah.
  async function update(id, input = {}) {
    const fields = {};
    const changes = {};

    if (input.catatan !== undefined) changes.catatan = readNote(input.catatan, fields);
    if (input.status !== undefined) {
      if (!STATUSES.includes(input.status)) fields.status = 'Status harus dipantau, ditindaklanjuti, atau selesai.';
      else changes.status = input.status;
    }
    if (Object.keys(changes).length === 0 && Object.keys(fields).length === 0) {
      fields.catatan = 'Isi catatan atau status yang ingin diubah.';
    }
    throwIfInvalid(fields);

    const current = await store.get(id);
    if (!current) throw notFound();

    // Mengaktifkan kembali item "selesai" tidak boleh menciptakan duplikat aktif.
    if (changes.status && changes.status !== 'selesai' && current.status === 'selesai') {
      const items = await store.list();
      const duplicate = items.some(
        (item) => item.id !== id && isActive(item) && item.komoditas === current.komoditas && item.provinsi === current.provinsi,
      );
      if (duplicate) {
        throw new PantauanError(409, { pesan: 'Komoditas dan provinsi ini sudah ada di daftar pantauan aktif.' });
      }
    }

    const updated = await store.update(id, { ...changes, diubah: new Date().toISOString() });
    if (!updated) throw notFound(); // terhapus di antara dua langkah
    return updated;
  }

  async function remove(id) {
    if (!(await store.remove(id))) throw notFound();
  }

  return { list, create, update, remove };
}
