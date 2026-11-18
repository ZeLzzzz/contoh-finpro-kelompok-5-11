# Desain

## Arah visual
Achromatic ledger (taste-skill, tema terang, D-006): kerangka tanpa warna, tombol utama hitam pekat, dan satu hue biru `#1d5fbf` hanya untuk seri data utama (garis harga provinsi terpilih). Pembanding dan seri lain memakai tinta dan abu-abu. Huruf Geist. Alasannya: dasbor dibaca sekilas, jadi angka dan satu garis tren yang jadi pusat perhatian.

"Wajah" produk: latar abu kebiruan `#f2f4f7` pengganti `#f8f8f8`, kartu putih, dan semua angka harga dalam Geist Mono dengan angka tabular, seperti kolom buku besar.

Sheet: `.taste-skill/direction.json`

## Halaman / layar
| Layar | Pertanyaan utama | Isi utama |
|---|---|---|
| Harga (REQ-001, REQ-002) | "Berapa harga beras medium di provinsi saya dan berubah berapa?" | Baris filter (komoditas, provinsi, periode), strip KPI (harga bulan terakhir, perubahan, jumlah pasar, bulan terakhir data), grafik tren sebagai blok terbesar, panel perubahan dua bulan di rail kanan, catatan metode dan atribusi |
| Bandingkan (REQ-003) | "Komoditas mana yang paling bergejolak di provinsi ini?" | Grafik indeks tiga seri, tabel harga asli dan volatilitas |
| Pantauan (REQ-004) | "Apa yang sedang saya pantau dan apa tindak lanjutnya?" | Form tambah (judul tindakan utama hitam), daftar dengan status, aksi ubah dan hapus per baris |

Pola layar Harga mengikuti pola `overview` pada sheet; layar Pantauan disusun dari aturan umum `references/app-screens.md` karena sheet tidak punya pola `list`.

## State penting
- **Memuat:** kerangka grafik dan KPI dengan teks "Memuat data…".
- **Kosong:** "Tidak ada data untuk pilihan ini" (harga), ajakan menambah item pertama (pantauan).
- **Error:** pesan dari server dan tombol "Coba lagi"; tampilan sebelumnya tetap ada bila ada.
- **Validasi:** pesan di bawah kolom form, isian tetap tersimpan.
- **Tidak dapat dihitung:** tanda "—" dengan alasan singkat, bukan nol.
- **Setelah refresh:** filter terakhir disimpan di query string URL; daftar pantauan dibaca ulang dari server.

## Aksesibilitas & responsif
- Kontras WCAG AA, fokus terlihat, target sentuh minimal 36 px dengan jarak cukup.
- Label pada setiap kontrol form, HTML semantik, grafik punya ringkasan teks dan tabel pendamping.
- Sidebar menjadi bar atas 48 px di bawah 768 px; tidak ada scroll horizontal di 360 px.

## Token
Token lengkap ada di `.taste-skill/direction.json` (bagian 2 sheet): `--ground`, `--surface`, `--text`, `--muted`, `--accent` (`#141414`), `--chart-3` (`#1d5fbf`, seri utama), `--positive`, `--negative`, radius kartu 8 px dan kontrol 6 px, jarak antar-kartu 12 px.
