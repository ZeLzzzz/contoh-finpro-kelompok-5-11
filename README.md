# Contoh Finpro Kelompok 5 & 11: Harga Pangan Daerah

Dasbor harga beras, gula, dan minyak per provinsi dari data WFP/HDX. Ini **proyek contoh untuk mentoring Web Development**: dibuat hanya dengan teknologi silabus (HTML, Tailwind CDN, JavaScript/DOM, fetch, Express, GitHub, Vercel) dan ditulis agar mudah dibaca pemula.

Spesifikasi lengkap ada di [`docs/`](docs/). Status saat ini: REQ-001 (tren harga) dan REQ-002 (perubahan dua bulan), REQ-003 (perbandingan komoditas), dan REQ-004 (daftar pantauan) selesai; REQ-005 (deploy Vercel) belum.

## Menjalankan

Butuh Node.js 22 atau lebih baru.

```sh
npm install
npm start        # buka http://localhost:3000
npm test         # menjalankan semua tes
```

## Yang sudah bisa

- Pilih komoditas, provinsi, dan periode; lihat grafik tren harga bulanan, jumlah pasar, flag cakupan, bulan terakhir data, metode, dan atribusi.
- Pilihan filter ikut tersimpan di alamat halaman (`?provinsi=BALI&periode=2023-01:2024-05`).
- Kartu "Perubahan harga" di kanan: pilih bulan awal dan akhir, lihat harga awal, harga akhir, selisih, dan persen perubahan dari pasar yang sama di kedua bulan.
- Halaman **Bandingkan** (`/bandingkan.html`): indeks harga beras, gula, dan minyak (bulan pertama = 100), harga asli, dan volatilitas per komoditas.
- Halaman **Pantauan** (`/pantauan.html`): tambah, ubah (catatan dan status), dan hapus item pantauan; data tersimpan di `data/pantauan.json` saat dijalankan lokal.
- Status memuat, error (dengan tombol "Coba lagi"), dan data kosong.

## Struktur folder

| Lokasi | Isi |
|---|---|
| `public/` | Halaman: `index.html` + `app.js` (Harga), `bandingkan.html` + `bandingkan.js`, `pantauan.html` + `pantauan.js`, `style.css` (warna dan huruf), `charts.js` (penggambar grafik SVG, dari taste-skill) |
| `src/server.js` | Menjalankan server |
| `src/app.js` | Aplikasi Express: route dan penanganan error |
| `src/harga-service.js` | Menghitung rata-rata harga bulanan, perubahan dua bulan, dan perbandingan komoditas; memeriksa input |
| `src/pantauan-service.js` | Aturan daftar pantauan: validasi, duplikat, status |
| `src/pantauan-store.js` | Adapter penyimpanan pantauan (file JSON) |
| `src/statistics.js` | Hitungan murni: indeks, perubahan bulanan, simpangan baku |
| `src/wfp-data.js` | Membaca CSV WFP dan menyaring baris yang boleh dipakai |
| `scripts/build-data.mjs` | Membuat `data/harga.json` dari CSV WFP |
| `data/harga.json` | Subset data: 31.181 baris harga per pasar per bulan |
| `test/` | Tes dengan `node:test` |
| `docs/` | Brief, keputusan, requirement, guardrail, desain |

## API

### `GET /api/opsi`
Isi pilihan filter: komoditas, provinsi, bulan yang tersedia.

### `GET /api/harga?komoditas=beras-medium&provinsi=JAWA TIMUR&periode=2020-01:2024-05`
- `komoditas`: `beras-medium` (bawaan), `gula-lokal`, atau `minyak-nabati`.
- `provinsi`: wajib, nama provinsi seperti di data (tidak peka huruf besar-kecil).
- `periode`: `YYYY-MM:YYYY-MM`, bawaan seluruh data.

Membalas satu titik per bulan (`bulan`, `harga`, `pasar`, `cakupan`), titik `terakhir`, metode, dan atribusi. Input tidak valid dibalas `400` dengan `{ "pesan": "..." }`. Periode tanpa data dibalas `200` dengan `titik: []`.

### `GET /api/perubahan?komoditas=beras-medium&provinsi=JAWA TIMUR&dari=2023-05&sampai=2024-05`
Perubahan harga antara dua bulan, dihitung hanya dari pasar yang punya data di kedua bulan (`pasarSama`). Membalas `awal`, `akhir`, `selisih`, `persen` (satu desimal), atau `persen: null` dengan `tidakDapatDihitung` berisi alasannya (tidak ada pasar yang sama, atau harga acuan nol). Bulan awal setelah bulan akhir, atau input tidak valid, dibalas `400`.

### `GET /api/bandingkan?provinsi=JAWA TIMUR&periode=2020-01:2024-05`
Tiga komoditas sekaligus. Tiap komoditas membawa `titik` (`bulan`, `harga`, `indeks`, `pasar`), `mutu`, `satuan`, dan `volatilitas` (simpangan baku sampel dari perubahan bulanan dalam persen; rumusnya ada di `rumusVolatilitas`). Komoditas dengan kurang dari 3 bulan data mendapat `volatilitas: null` dan `alasan`. Provinsi tidak valid dibalas `400`.

### `/api/pantauan` (CRUD daftar pantauan)
- `GET /api/pantauan`: daftar, terbaru dulu.
- `POST /api/pantauan` dengan `{ komoditas, provinsi, catatan }`: `201` beserta `id`. Status awal selalu `dipantau`.
- `PUT /api/pantauan/:id` dengan `{ catatan, status }` (`dipantau`, `ditindaklanjuti`, `selesai`): `200`. Komoditas dan provinsi tidak bisa diubah.
- `DELETE /api/pantauan/:id`: `204`.
- Kesalahan: `400` dengan `kolom` berisi pesan per kolom (komoditas atau provinsi tidak dikenal, catatan lebih dari 280 karakter, JSON rusak), `404` bila `id` tidak ada, `409` bila komoditas dan provinsi yang sama sudah dipantau dan belum `selesai`.

Semua akses data lewat adapter penyimpanan (`src/pantauan-store.js`: `list`, `get`, `create`, `update`, `remove`). Lokal memakai file JSON; adapter Upstash Redis untuk Vercel menyusul di REQ-005.

## Data

Sumber: [WFP/HDX, Indonesia - Food Prices](https://data.humdata.org/dataset/wfp-food-prices-for-indonesia), lisensi CC BY-IGO. Yang dipakai: Retail, IDR, KG, priceflag `aggregate`, komoditas Rice (medium quality), Sugar (local), Oil (vegetable), Jan 2020–Mei 2024, tanpa baris National Average. Harga bulanan adalah **rata-rata tak berbobot dari pasar yang punya data**, bukan harga representatif nasional, bukan harga toko, dan bukan harga hari ini.

Membuat ulang `data/harga.json`: `npm run build-data` (mengunduh CSV 52 MB) atau `npm run build-data -- lokasi/wfp_food_prices_idn.csv`.

## Lisensi

Kode: MIT. Data: CC BY-IGO (WFP/HDX).
