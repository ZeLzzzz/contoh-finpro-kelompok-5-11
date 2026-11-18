// Menjalankan server lokal: npm start
import { readFile } from 'node:fs/promises';
import { createApp } from './app.js';
import { createHargaService } from './harga-service.js';

const data = JSON.parse(await readFile(new URL('../data/harga.json', import.meta.url), 'utf8'));
const app = createApp({ hargaService: createHargaService(data) });

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Buka http://localhost:${port}`));
