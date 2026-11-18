# Log Keputusan

## Sudah diputuskan

| ID | Keputusan | Alasan | Oleh / tanggal | Dampak |
|---|---|---|---|---|
| D-001 | Proyek ini adalah contoh untuk mentoring kelompok 5 dan 11, bukan final project yang dinilai. Langsung ke kickoff tanpa sesi Explore panjang. | Permintaan user | User / 2026-11-18 | Seluruh dokumen |
| D-002 | Satu aplikasi dengan dua peran: konsumen (Jalur A) dan petugas pemantauan (Jalur B). | Satu contoh mencakup kedua kelompok | User / 2026-11-18 | BRIEF, REQ-001–004 |
| D-003 | Tech stack mengikuti silabus: HTML, Tailwind lewat CDN, JavaScript vanilla (DOM, fetch), Node.js + Express, GitHub, Vercel. Tanpa framework frontend, TypeScript, atau build step. | Peserta hanya mempelajari ini; contoh harus bisa ditiru | User / 2026-11-18 | Semua REQ, G-005 |
| D-004 | Repo GitHub publik baru bernama `contoh-finpro-kelompok-5-11` di akun ZeLzzzz; folder lokal `~/Projects/contoh-finpro-kelompok-5-11/`. | Bisa langsung dihubungkan ke Vercel. Nama dicek: belum ada di akun | User / 2026-11-18 | REQ-005 |
| D-005 | Persistensi lewat adapter: file JSON lokal untuk pengembangan, Upstash Redis (Vercel Marketplace) untuk produksi. | Brief mengharuskan data bertahan di Vercel tanpa belajar database baru | User / 2026-11-18 | REQ-004, REQ-005, G-006 |
| D-006 | Arah visual: Achromatic ledger (taste-skill, tema terang). Sheet di `.taste-skill/direction.json`. | Dasbor dibaca sekilas; angka dan satu seri data utama menjadi pusat perhatian | User / 2026-11-18 | DESIGN.md |
| D-007 | Node.js 22+ dengan npm, test runner bawaan `node:test`, Express 5, lisensi MIT, dijalankan lokal dengan `npm start`. | Tanpa dependensi uji tambahan | User / 2026-11-18 | REQ-001, REQ-005 |
| D-008 | Kode ditulis agar mudah dimengerti pemula: struktur folder datar dan jelas, file kecil dengan satu tugas, nama fungsi dan variabel dalam bahasa Inggris yang lugas, komentar singkat hanya untuk alasan "kenapa", tanpa pola atau abstraksi yang belum dipelajari di silabus. | Contoh ini ditiru peserta | User / 2026-11-18 | Semua REQ, BRIEF |
| D-009 | Semua usulan agent disetujui: G-002–G-007; REQ-001 periode Jan 2020–Mei 2024; REQ-003 AC-2 (indeks) dan AC-3 (volatilitas); REQ-004 AC-4 (280 karakter) dan AC-7 (duplikat 409); DESIGN: latar `#f2f4f7`, Geist Mono untuk angka, filter di query string. | Gate kickoff | User (usulan agent) / 2026-11-18 | GUARDRAILS, REQUIREMENTS, DESIGN |

## Masih terbuka

| ID | Pertanyaan | Opsi (rekomendasi pertama) | Pemilik | Menghambat? |
|---|---|---|---|---|
| D-011 | Pilihan agent yang belum disetujui: nama endpoint `/api/perubahan` dan `/api/bandingkan`; volatilitas butuh minimal 3 bulan data; Upstash dipanggil lewat REST dengan `fetch` (tanpa library) dan data disimpan sebagai hash Redis, satu field per item; `npm start` membaca `.env` bila ada. | Setuju (dipakai sementara), atau ganti nama atau cara | User, sebelum REQ-005 ditutup | REQ-005 |
| D-010 | Siapa yang membuat database Upstash di Vercel dan menyimpan kredensialnya? | User membuatnya di dashboard Vercel saat deploy (dipakai sementara), atau agent memandu langkahnya | User, sebelum REQ-005 | REQ-005 |

## Perubahan scope

| ID | Tanggal | Sebelum | Sesudah | Alasan |
|---|---|---|---|---|
