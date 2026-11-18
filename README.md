# Contoh Finpro Kelompok 5 & 11: Harga Pangan Daerah

Dasbor harga beras, gula, dan minyak per provinsi dari data WFP/HDX. Ini **proyek contoh untuk mentoring Web Development**: dibuat hanya dengan teknologi silabus (HTML, Tailwind CDN, JavaScript/DOM, fetch, Express, GitHub, Vercel) dan ditulis agar mudah dibaca pemula.

Spesifikasi lengkap ada di [`docs/`](docs/). Status saat ini: REQ-001 (tren harga) dan REQ-002 (perubahan dua bulan), REQ-003 (perbandingan komoditas), dan REQ-004 (daftar pantauan) selesai; REQ-005 (deploy Vercel) belum.

## Menjalankan

Butuh Node.js 22.9 atau lebih baru.

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
| `src/pantauan-store.js` | Adapter penyimpanan pantauan: file JSON (lokal) |
| `src/pantauan-redis-store.js` | Adapter penyimpanan pantauan: Upstash Redis (Vercel) |
| `src/choose-store.js` | Memilih adapter dari variabel lingkungan |
| `api/index.js`, `vercel.json` | Pintu masuk dan pengaturan Vercel |
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

Semua akses data lewat adapter penyimpanan dengan lima fungsi: `list`, `get`, `create`, `update`, `remove`. `src/choose-store.js` memilih adapternya dari variabel lingkungan:

| Kondisi | Penyimpanan |
|---|---|
| `UPSTASH_REDIS_REST_URL` dan `UPSTASH_REDIS_REST_TOKEN` terisi (atau `KV_REST_API_URL` dan `KV_REST_API_TOKEN` dari integrasi Vercel) | Upstash Redis (`src/pantauan-redis-store.js`) |
| Tidak terisi, berjalan di Vercel | Belum dikonfigurasi: `/api/pantauan` membalas `503`, halaman Harga dan Bandingkan tetap jalan |
| Tidak terisi, berjalan lokal | File `data/pantauan.json` (`src/pantauan-store.js`) |

## Deploy ke Vercel

Repositori ini sudah siap dipakai Vercel: `api/index.js` menjalankan Express untuk semua `/api/*` (diatur `vercel.json`), dan folder `public/` disajikan sebagai berkas statis. Tanpa build step.

1. Di [vercel.com/new](https://vercel.com/new), impor repositori GitHub ini. Biarkan pengaturan bawaan (Framework Preset: Other, tanpa Build Command).
2. Buka tab **Storage** pada proyek, pilih **Upstash** (Redis) dari Marketplace, buat database gratis, lalu hubungkan ke proyek. Vercel mengisi variabel `KV_REST_API_URL` dan `KV_REST_API_TOKEN` otomatis.
3. Deploy ulang (**Deployments → Redeploy**) supaya variabel terbaca.
4. Buka tautan Vercel, tambah satu item di halaman Pantauan, lalu refresh. Item harus tetap ada.

Sebelum langkah 2, halaman Harga dan Bandingkan sudah berfungsi dan Pantauan menampilkan pesan bahwa penyimpanan belum dikonfigurasi.

Mencoba Upstash dari komputer sendiri: salin `.env.example` menjadi `.env`, isi dua variabel, lalu `npm start` (file `.env` dibaca otomatis dan tidak masuk git).

## Hasil uji

`npm test` menjalankan 65 tes (`node:test`): penyaringan data WFP, hitungan harga bulanan, perubahan dua bulan (10.000 ke 12.000 = +20,0%), indeks dan volatilitas, CRUD pantauan beserta kode status, kontrak adapter file dan Upstash (Upstash dipalsukan di memori), pemilihan penyimpanan, dan pintu masuk Vercel. Halaman diperiksa di browser pada lebar 1440, 768, 390, dan 360 px.

## Batas aplikasi

- Angka harga adalah rata-rata tak berbobot dari pasar yang punya data, hanya untuk Jan 2020–Mei 2024. Bukan harga toko, bukan harga hari ini, dan bukan harga representatif nasional. Jumlah pasar berubah antar bulan (di Jawa Timur, Jan 2024 punya 18 pasar sedangkan bulan lain 6), sehingga perubahan antar bulan memakai pasar yang sama di kedua bulan.
- Data pantauan dipakai bersama semua orang yang membuka aplikasi. Tidak ada login.
- Mengubah satu item di Upstash membaca lalu menulis, jadi dua orang yang mengubah item yang sama pada detik yang sama bisa saling menimpa. Cukup untuk contoh ini.
- Aplikasi tidak membuktikan stabilisasi harga atau dampak pada masyarakat.

## Data

Sumber: [WFP/HDX, Indonesia - Food Prices](https://data.humdata.org/dataset/wfp-food-prices-for-indonesia), lisensi CC BY-IGO. Yang dipakai: Retail, IDR, KG, priceflag `aggregate`, komoditas Rice (medium quality), Sugar (local), Oil (vegetable), Jan 2020–Mei 2024, tanpa baris National Average. Harga bulanan adalah **rata-rata tak berbobot dari pasar yang punya data**, bukan harga representatif nasional, bukan harga toko, dan bukan harga hari ini.

Membuat ulang `data/harga.json`: `npm run build-data` (mengunduh CSV 52 MB) atau `npm run build-data -- lokasi/wfp_food_prices_idn.csv`.

## Lisensi

Kode: MIT. Data: CC BY-IGO (WFP/HDX).
