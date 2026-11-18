# Requirements

## Ringkasan

| ID | Hasil yang terlihat pengguna | Status | Bergantung pada |
|---|---|---|---|
| REQ-001 | Konsumen melihat tren harga beras medium per provinsi dan periode | done | — |
| REQ-002 | Pengguna melihat perubahan harga antara dua bulan dengan pasar yang sama | done | REQ-001 |
| REQ-003 | Petugas membandingkan beras, gula, dan minyak di satu provinsi | in-progress | REQ-001 |
| REQ-004 | Petugas mengelola daftar pantauan (tambah, lihat, ubah, hapus) | in-progress | REQ-001 |
| REQ-005 | Aplikasi berjalan publik di Vercel dengan data pantauan yang bertahan | ready | REQ-002, REQ-003, REQ-004 |

---

## REQ-001 — Tren harga beras medium per provinsi

**Status:** done
**Tujuan:** Konsumen memilih komoditas, provinsi, dan periode, lalu membaca tren harga bulanan beserta cakupan pasarnya, sehingga tidak salah mengira angka ini sebagai harga toko hari ini.
**Bergantung pada:** — (REQ ini juga membangun kerangka proyek, skrip agregasi data, dan API pertama.)
**Keputusan terkait:** D-002, D-003, D-006, D-007, G-002, G-003, G-004

### Acceptance criteria
- [x] **AC-1 (alur utama):** Ketika konsumen memilih komoditas, provinsi, dan periode, maka halaman menampilkan grafik garis rata-rata harga bulanan (IDR/KG), jumlah pasar (n) per bulan terakhir, flag cakupan, bulan terakhir data, metode agregasi, dan atribusi WFP/HDX.
- [x] **AC-2 (agregasi):** Rata-rata bulanan adalah rata-rata tak berbobot dari pasar yang punya data, hanya dari baris Retail, IDR, KG, priceflag=aggregate, dan baris National Average tidak ikut dihitung.
- [x] **AC-3 (input tidak valid):** Ketika `GET /api/harga` menerima komoditas, provinsi, atau periode yang tidak dikenal, maka server membalas 400 dengan pesan JSON, dan halaman menampilkan pesan itu tanpa menghapus tampilan sebelumnya.
- [x] **AC-4 (data kosong):** Ketika kombinasi filter tidak punya data, maka halaman menampilkan "Tidak ada data untuk pilihan ini" dan bukan nol.
- [x] **AC-5 (loading dan error):** Saat menunggu, halaman menampilkan status memuat; bila request gagal atau server membalas 5xx, tampil pesan error dan tombol "Coba lagi" yang mengulang request. Mengganti filter memicu satu request, bukan satu per ketikan.
- [x] **AC-6 (ukuran respons):** Respons `/api/harga` hanya berisi satu titik per bulan (bukan baris per pasar), dan tidak ada CSV mentah di repo yang dikirim ke browser.
- [x] **AC-7 (responsif):** Di layar 360 px tidak ada scroll horizontal, dan semua kontrol dapat dipakai.

### Di luar REQ ini
- Perbandingan dua bulan (REQ-002), tiga komoditas (REQ-003), daftar pantauan (REQ-004), deploy (REQ-005).
- Periode data yang dipakai: Jan 2020–Mei 2024 sesuai brief; seri sejak 2016-07 tidak ditampilkan.

---

## REQ-002 — Perubahan harga antara dua bulan

**Status:** done
**Tujuan:** Pengguna memilih bulan awal dan bulan akhir, lalu melihat persen perubahan harga yang dihitung dari pasar yang sama di kedua bulan.
**Bergantung pada:** REQ-001
**Keputusan terkait:** D-002, G-002

### Acceptance criteria
- [x] **AC-1 (alur utama):** Ketika pengguna memilih dua bulan, maka halaman menampilkan harga awal, harga akhir, selisih, persen perubahan bertanda (+/−), dan jumlah pasar yang dipakai.
- [x] **AC-2 (hitungan):** Harga 10.000 ke 12.000 menghasilkan +20,0% (diuji di tes unit dan lewat API).
- [x] **AC-3 (pasar sama):** Perubahan dihitung hanya dari pasar yang punya data di kedua bulan; bila tidak ada pasar yang sama, tampil "tidak dapat dihitung" beserta alasannya.
- [x] **AC-4 (acuan nol atau kosong):** Bila harga acuan nol atau tidak tersedia, hasilnya "tidak dapat dihitung", bukan angka tak hingga atau NaN.
- [x] **AC-5 (urutan bulan):** Bila bulan awal sesudah bulan akhir, server membalas 400 dan halaman menampilkan pesan yang jelas.

### Di luar REQ ini
- Persen perubahan lebih dari dua titik waktu, dan prakiraan.

---

## REQ-003 — Perbandingan beras, gula, dan minyak

**Status:** in-progress
**Tujuan:** Petugas membandingkan pergerakan tiga komoditas di satu provinsi pada skala yang sama, dengan mutu, satuan, dan periode yang jelas.
**Bergantung pada:** REQ-001
**Keputusan terkait:** D-002, G-002

### Acceptance criteria
- [ ] **AC-1 (alur utama):** Ketika petugas memilih provinsi dan periode, maka halaman menampilkan tiga seri (Rice medium quality, Sugar local, Oil vegetable), masing-masing dengan label mutu dan satuan IDR/KG.
- [ ] **AC-2 (skala sama):** Harga ketiga komoditas ditampilkan sebagai indeks (bulan pertama periode = 100) agar bisa dibandingkan, dengan harga asli ada di tabel di bawahnya.
- [ ] **AC-3 (volatilitas):** Tabel menampilkan volatilitas tiap komoditas, yaitu simpangan baku perubahan bulanan (%) dalam periode, beserta rumusnya.
- [ ] **AC-4 (data kurang):** Bila sebuah komoditas punya kurang dari 3 bulan data di pilihan itu, volatilitasnya tampil "tidak dapat dihitung" dan komoditas lain tetap tampil.
- [ ] **AC-5 (provinsi tidak valid):** Provinsi yang tidak dikenal menghasilkan 400 dengan pesan JSON, dan halaman menampilkan pesannya.

### Di luar REQ ini
- Komoditas selain tiga yang disebut brief, dan menyimpan perbandingan ke pantauan (itu REQ-004).

---

## REQ-004 — Daftar pantauan (CRUD)

**Status:** in-progress
**Tujuan:** Petugas mencatat komoditas dan provinsi yang dipantau beserta tindak lanjutnya, lalu mengubah atau menghapusnya, dan catatan itu tetap ada setelah refresh.
**Bergantung pada:** REQ-001
**Keputusan terkait:** D-002, D-005, G-006

### Acceptance criteria
- [ ] **AC-1 (tambah dan lihat):** Ketika petugas mengisi form (komoditas, provinsi, catatan tindak lanjut) dan menyimpan, maka `POST /api/pantauan` membalas 201 dengan `id`, dan item muncul di daftar.
- [ ] **AC-2 (ubah):** `PUT /api/pantauan/:id` mengubah catatan atau status ("dipantau", "ditindaklanjuti", "selesai"); daftar menampilkan nilai baru.
- [ ] **AC-3 (hapus):** `DELETE /api/pantauan/:id` membalas 204 setelah konfirmasi di halaman, dan item hilang dari daftar.
- [ ] **AC-4 (validasi):** Komoditas atau provinsi di luar daftar, atau catatan lebih dari 280 karakter, ditolak dengan 400 dan pesan per kolom; isian pengguna tetap di form.
- [ ] **AC-5 (id tidak ada):** Mengubah atau menghapus `id` yang tidak ada menghasilkan 404 dan halaman menampilkan "Item tidak ditemukan" lalu memuat ulang daftar.
- [ ] **AC-6 (persisten dan kosong):** Setelah refresh, item masih ada (lewat adapter penyimpanan); daftar kosong menampilkan ajakan menambah item pertama.
- [ ] **AC-7 (duplikat):** Item dengan komoditas dan provinsi yang sama dengan item aktif lain ditolak dengan 409.

### Di luar REQ ini
- Login dan pembagian data per pengguna (data pantauan dipakai bersama), serta impor dan ekspor.

---

## REQ-005 — Online di Vercel dengan data yang bertahan

**Status:** ready
**Tujuan:** Aplikasi bisa dibuka lewat tautan Vercel publik dan data pantauan tidak hilang setelah refresh atau deploy ulang, dengan README dan bukti uji untuk dikumpulkan.
**Bergantung pada:** REQ-002, REQ-003, REQ-004
**Keputusan terkait:** D-004, D-005, D-010, G-001, G-006

### Acceptance criteria
- [ ] **AC-1 (alur utama):** Tautan Vercel membuka dasbor, semua endpoint `/api/harga` dan `/api/pantauan` berfungsi, dan CRUD pantauan tetap terbaca setelah refresh.
- [ ] **AC-2 (adapter):** Lokal memakai file JSON, produksi memakai Upstash Redis; pilihan ditentukan oleh variabel lingkungan, dan kode aplikasi tidak berubah di antara keduanya.
- [ ] **AC-3 (konfigurasi hilang):** Bila variabel Upstash tidak ada di produksi, API pantauan membalas 503 dengan pesan jelas dan halaman tetap menampilkan dasbor harga.
- [ ] **AC-4 (repo bersih):** Repo GitHub publik tidak memuat `.env`, `node_modules`, atau token, dan memuat `.env.example`.
- [ ] **AC-5 (dokumentasi):** README menjelaskan cara menjalankan, endpoint, sumber dan atribusi data, hasil uji, batas aplikasi, dan langkah deploy ke Vercel.

### Di luar REQ ini
- Domain kustom, analitik, dan CI.

---

## Backlog

| Urutan | Fitur | Dicatat | Catatan |
|---|---|---|---|
