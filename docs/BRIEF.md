# Contoh Finpro Kelompok 5 & 11 — Dasbor Harga Pangan Daerah — Brief

## Masalah
Final Project Web Development kelompok 5 dan 11 (SDG 2.c) meminta dasbor harga beras dan pangan pokok per provinsi. Peserta baru belajar HTML, Tailwind, JavaScript/DOM, fetch, Express, dan Vercel, jadi mereka butuh satu proyek contoh yang berjalan dari data WFP/HDX sampai deploy. Contoh ini juga memperlihatkan jebakan data yang disebut brief: campuran mutu, seri actual dan aggregate, serta baris National Average.

## Alternatif yang sudah ada
- **Situs WFP/HDX dan PIHPS (Bank Indonesia):** menampilkan harga, tapi tidak untuk belajar membangun aplikasinya. Tidak ada contoh kode Express, CRUD, atau deploy yang bisa ditiru.
- **Mengunduh CSV WFP lalu membuka di Excel:** berkasnya 52 MB dan mencampur banyak mutu dan seri, sehingga rawan salah baca.
- **Yang ditambahkan proyek ini:** contoh kerja lengkap yang mengikuti brief Group 5 & 11 dan hanya memakai teknologi silabus. Mentor bisa menunjuknya sebagai acuan struktur, penamaan endpoint, validasi, dan pengujian.

## Pengguna
- **Konsumen (Jalur A, kelompok 5):** melihat harga beras medium di provinsinya dan perubahannya pada periode data.
- **Petugas pemantauan (Jalur B, kelompok 11/12):** membandingkan beras medium, gula lokal, dan minyak nabati, lalu mencatat tindak lanjut di daftar pantauan.
- **Mentor dan peserta kelompok 5 dan 11:** pembaca kode contoh.

## Alur utama
1. Konsumen: pilih komoditas, provinsi, dan periode → lihat tren harga, perubahan antar dua bulan, jumlah pasar, bulan terakhir data, dan atribusi.
2. Petugas: bandingkan tiga komoditas di satu provinsi → tambahkan ke daftar pantauan dengan catatan tindak lanjut → ubah status atau hapus.

## Dalam scope
- Filter komoditas, provinsi, dan periode; grafik tren harga.
- Perbandingan perubahan antar dua bulan dengan pasar yang sama.
- Perbandingan tiga komoditas (beras medium, gula lokal, minyak nabati) di satu provinsi.
- CRUD daftar pantauan lewat API Express dengan penyimpanan persisten.
- Deploy publik ke Vercel dari repositori GitHub publik, dengan README dan bukti uji.

## Di luar scope
- Login atau autentikasi, pembayaran, dan peran pengguna di server.
- Harga hari ini, harga toko, atau prakiraan harga.
- Peta, ekspor data, dan komoditas selain tiga yang disebut brief.
- API eksternal lain selain data WFP/HDX.
- Basis data SQL dan ORM (di luar silabus).
- Klaim bahwa aplikasi menstabilkan harga atau berdampak pada masyarakat.

## Batasan
- **Tech stack silabus:** HTML semantik, Tailwind CSS lewat CDN, JavaScript vanilla (DOM, fetch), Node.js + Express, Git/GitHub, deploy Vercel.
- **Data:** WFP/HDX, lisensi CC BY-IGO, atribusi wajib tampil. Subset: Retail, IDR, KG, priceflag=aggregate; komoditas Rice (medium quality), Sugar (local), Oil (vegetable); baris National Average dikeluarkan.
- **Layar:** diuji di 360 px dan desktop. Bahasa UI Indonesia.
- **Persistensi:** array server dan file JSON tidak cukup di Vercel. Produksi memakai Upstash Redis lewat adapter; lokal memakai file JSON.
- **Proyek contoh:** maksimal dua entitas (Harga: baca-saja; Pantauan: CRUD) dan 3–4 fitur, sama seperti aturan brief kelompok.

## Sumber & prioritas
1. `docs/DECISIONS.md` — keputusan yang disetujui user
2. `docs/REQUIREMENTS.md`
3. Brief Group 5 & 11 dalam `FINRPO TECH CLASS 26_27.xlsx` (sheet "finpro web dev"), silabus Web Development dan `BR OB PESERTA WEB DEVELOPMENT 26.2`
4. Dokumentasi dataset WFP/HDX: https://data.humdata.org/dataset/wfp-food-prices-for-indonesia

## Celah yang diketahui
- Brief menyebut subset Jan 2020–Mei 2024 (31.181 baris). CSV yang diunduh 2026-11-18 memuat seri tiga komoditas ini sejak 2016-07 sampai 2024-05, untuk 34 provinsi. Periode yang dipakai aplikasi belum diputuskan (lihat REQ-001).
- Mentor belum menyediakan adapter penyimpanan; proyek ini membuat sendiri adapter dengan antarmuka yang sama untuk lokal dan Upstash.
- Brief menulis Jalur B untuk "kelompok 12" padahal judul bagian "Group 5 & 11". Contoh ini mengikuti judul bagian (kelompok 11) dan tidak bergantung pada nomor itu.
