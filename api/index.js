// Pintu masuk Vercel: semua permintaan /api/* dikirim ke aplikasi Express ini (lihat vercel.json).
// Halaman di public/ disajikan langsung oleh Vercel sebagai berkas statis.
// Data harga di-import (bukan dibaca dengan fs) supaya pasti ikut terbawa ke fungsi Vercel.
import hargaData from '../data/harga.json' with { type: 'json' };
import { createApp } from '../src/app.js';
import { chooseStore } from '../src/choose-store.js';
import { createHargaService } from '../src/harga-service.js';

const pantauanStore = chooseStore(process.env, '/tmp/pantauan.json');

export default createApp({ hargaService: createHargaService(hargaData), pantauanStore });
