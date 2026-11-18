# Guardrails

| ID | Aturan | Alasan / sumber | Cara cek |
|---|---|---|---|
| G-001 | Jangan commit secret (`.env`, `*.pem`, `*.key`, token Upstash) | Keamanan; repo publik | `git ls-files` tidak memuat file tersebut |
| G-002 | Jangan mencampur mutu komoditas, satuan, priceflag, atau seri actual dalam satu agregat; baris National Average dikeluarkan | Brief Group 5 & 11 | Tes unit pada skrip agregat; `grep -n "National Average" scripts/` menunjukkan filter |
| G-003 | Jangan menampilkan klaim "harga hari ini", "harga toko", atau prakiraan; setiap angka harga disertai bulan terakhir data dan atribusi WFP/HDX | Brief: aplikasi membaca tren pada periode data | Baca halaman di browser; tes DOM atau snapshot teks |
| G-004 | Browser tidak menerima CSV mentah atau baris per pasar; hanya agregat dari API | Brief: "kirim agregat, bukan 31 ribu baris" | Periksa ukuran respons `/api/harga` di tes dan di tab Network |
| G-005 | Tidak ada framework frontend, TypeScript, bundler, atau database SQL | D-003: hanya teknologi silabus | `package.json` hanya berisi dependensi yang disetujui |
| G-006 | Data pantauan produksi tidak boleh hanya di array server atau file lokal | Brief: itu tidak cukup untuk Vercel; D-005 | Tes adapter dan uji refresh di URL Vercel |
| G-007 | Tidak ada autentikasi dan tidak ada pembayaran | Di luar scope di BRIEF | `grep -ri "password\|jwt\|payment" src/ public/` kosong |

## Pengecualian yang disetujui
