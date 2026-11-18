// Aplikasi Express: halaman statis di public/ dan API di /api.
import express from 'express';
import { fileURLToPath } from 'node:url';

const publicFolder = fileURLToPath(new URL('../public', import.meta.url));

export function createApp({ hargaService }) {
  const app = express();
  app.use(express.json());
  app.use(express.static(publicFolder));

  // GET /api/opsi -> isi pilihan filter
  app.get('/api/opsi', (req, res) => {
    res.json(hargaService.getOptions());
  });

  // GET /api/harga?komoditas=beras-medium&provinsi=JAWA TIMUR&periode=2023-01:2024-05
  app.get('/api/harga', (req, res) => {
    res.json(hargaService.getPrices(req.query));
  });

  // GET /api/perubahan?komoditas=beras-medium&provinsi=JAWA TIMUR&dari=2023-05&sampai=2024-05
  app.get('/api/perubahan', (req, res) => {
    res.json(hargaService.getChange(req.query));
  });

  // GET /api/bandingkan?provinsi=JAWA TIMUR&periode=2020-01:2024-05
  app.get('/api/bandingkan', (req, res) => {
    res.json(hargaService.getComparison(req.query));
  });

  // Endpoint /api yang tidak ada dijawab JSON, bukan halaman HTML.
  app.use('/api', (req, res) => {
    res.status(404).json({ pesan: 'Endpoint tidak ditemukan.' });
  });

  // Semua error berakhir di sini. Kesalahan input (400) membawa pesan; sisanya 500.
  app.use((error, req, res, next) => {
    if (error.status === 400) return res.status(400).json({ pesan: error.message });
    console.error(error);
    res.status(500).json({ pesan: 'Terjadi kesalahan di server.' });
  });

  return app;
}
