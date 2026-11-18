// Aplikasi Express: halaman statis di public/ dan API di /api.
import express from 'express';
import { fileURLToPath } from 'node:url';
import { createPantauanService } from './pantauan-service.js';
import { createFileStore } from './pantauan-store.js';

const publicFolder = fileURLToPath(new URL('../public', import.meta.url));

const defaultPantauanFile = fileURLToPath(new URL('../data/pantauan.json', import.meta.url));

// pantauanStore boleh dikosongkan: berkas data/pantauan.json baru dipakai saat /api/pantauan pertama dipanggil.
export function createApp({ hargaService, pantauanStore }) {
  let pantauanService = null;
  function getPantauanService() {
    if (!pantauanService) {
      const options = hargaService.getOptions();
      pantauanService = createPantauanService({
        store: pantauanStore ?? createFileStore(defaultPantauanFile),
        komoditasCodes: options.komoditas.map((item) => item.kode),
        provinces: options.provinsi,
      });
    }
    return pantauanService;
  }

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

  // Daftar pantauan (REQ-004)
  app.get('/api/pantauan', async (req, res) => {
    res.json(await getPantauanService().list());
  });

  app.post('/api/pantauan', async (req, res) => {
    res.status(201).json(await getPantauanService().create(req.body));
  });

  app.put('/api/pantauan/:id', async (req, res) => {
    res.json(await getPantauanService().update(req.params.id, req.body));
  });

  app.delete('/api/pantauan/:id', async (req, res) => {
    await getPantauanService().remove(req.params.id);
    res.status(204).end();
  });

  // Endpoint /api yang tidak ada dijawab JSON, bukan halaman HTML.
  app.use('/api', (req, res) => {
    res.status(404).json({ pesan: 'Endpoint tidak ditemukan.' });
  });

  // Semua error berakhir di sini. Kesalahan input (400) membawa pesan; sisanya 500.
  app.use((error, req, res, next) => {
    if (error.type === 'entity.parse.failed') return res.status(400).json({ pesan: 'Isi permintaan bukan JSON yang valid.' });
    if (error.body) return res.status(error.status).json(error.body); // PantauanError: 400, 404, 409
    if (error.status === 400) return res.status(400).json({ pesan: error.message });
    console.error(error);
    res.status(500).json({ pesan: 'Terjadi kesalahan di server.' });
  });

  return app;
}
