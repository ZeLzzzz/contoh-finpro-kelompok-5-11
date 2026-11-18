import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { after, before, test } from 'node:test';
import { createApp } from '../src/app.js';
import { createHargaService, percentChange, ValidationError } from '../src/harga-service.js';

// Data kecil buatan sendiri supaya hitungannya mudah diperiksa.
const sampleData = {
  baris: [
    // Jawa Timur: Pasar A dan B punya data di kedua bulan, C hanya di bulan awal, D hanya di bulan akhir.
    ['beras-medium', 'JAWA TIMUR', 'Pasar A', '2023-05', 10000],
    ['beras-medium', 'JAWA TIMUR', 'Pasar A', '2024-05', 12000],
    ['beras-medium', 'JAWA TIMUR', 'Pasar B', '2023-05', 8000],
    ['beras-medium', 'JAWA TIMUR', 'Pasar B', '2024-05', 9000],
    ['beras-medium', 'JAWA TIMUR', 'Pasar C', '2023-05', 50000],
    ['beras-medium', 'JAWA TIMUR', 'Pasar D', '2024-05', 1000],
    // Bali: satu pasar, naik dari 10.000 ke 12.000.
    ['beras-medium', 'BALI', 'Pasar E', '2023-05', 10000],
    ['beras-medium', 'BALI', 'Pasar E', '2024-05', 12000],
    // Aceh: tidak ada pasar yang punya data di kedua bulan.
    ['beras-medium', 'ACEH', 'Pasar F', '2023-05', 9000],
    ['beras-medium', 'ACEH', 'Pasar G', '2024-05', 9500],
    // Papua: harga awal nol, acuan persen tidak boleh dibagi nol.
    ['beras-medium', 'PAPUA', 'Pasar H', '2023-05', 0],
    ['beras-medium', 'PAPUA', 'Pasar H', '2024-05', 5000],
    // Komoditas lain tidak boleh tercampur (G-002).
    ['gula-lokal', 'JAWA TIMUR', 'Pasar A', '2023-05', 14000],
    ['gula-lokal', 'JAWA TIMUR', 'Pasar A', '2024-05', 90000],
  ],
};
const service = createHargaService(sampleData);

// Menjalankan server sementara dengan data buatan, lalu menutupnya.
async function getSample(path) {
  const server = createApp({ hargaService: createHargaService(sampleData) }).listen(0);
  try {
    const response = await fetch(`http://localhost:${server.address().port}${path}`);
    return { status: response.status, body: await response.json() };
  } finally {
    server.close();
  }
}

// Server dengan data asli di data/harga.json, dipakai untuk tes yang memeriksa data yang dikirim.
let realServer;
let realUrl;
before(async () => {
  const data = JSON.parse(await readFile(new URL('../data/harga.json', import.meta.url), 'utf8'));
  realServer = createApp({ hargaService: createHargaService(data) }).listen(0);
  realUrl = `http://localhost:${realServer.address().port}`;
});
after(() => realServer.close());

// ---------- Hitungan persen ----------

test('REQ-002 AC-2: 10.000 ke 12.000 menghasilkan persen 20', () => {
  assert.equal(percentChange(10000, 12000), 20);
});

test('REQ-002 AC-1: persen turun bertanda minus dan dibulatkan satu desimal', () => {
  assert.equal(percentChange(12000, 10000), -16.7);
  assert.equal(percentChange(3, 4), 33.3);
});

test('REQ-002 AC-4: acuan nol, kosong, atau bukan angka menghasilkan null, bukan Infinity atau NaN', () => {
  for (const from of [0, NaN, Infinity, undefined, null]) {
    assert.equal(percentChange(from, 12000), null, `acuan ${from}`);
  }
  assert.equal(percentChange(10000, undefined), null);
});

// ---------- Perubahan dua bulan lewat layanan ----------

test('REQ-002 AC-1: perubahan dihitung dari rata-rata pasar yang sama di kedua bulan', () => {
  const result = service.getChange({ komoditas: 'beras-medium', provinsi: 'JAWA TIMUR', dari: '2023-05', sampai: '2024-05' });
  assert.deepEqual(result, {
    komoditas: { kode: 'beras-medium', nama: 'Beras (mutu medium)', satuan: 'IDR/KG' },
    provinsi: 'JAWA TIMUR',
    dari: '2023-05',
    sampai: '2024-05',
    pasarSama: 2,
    awal: 9000,
    akhir: 10500,
    selisih: 1500,
    persen: 16.7,
    tidakDapatDihitung: null,
  });
});

test('REQ-002 AC-2: harga 10.000 ke 12.000 menghasilkan persen 20, dengan komoditas bawaan beras medium', () => {
  const result = service.getChange({ provinsi: 'BALI', dari: '2023-05', sampai: '2024-05' });
  assert.equal(result.awal, 10000);
  assert.equal(result.akhir, 12000);
  assert.equal(result.persen, 20);
});

test('REQ-002 AC-3: pasar yang hanya punya data di salah satu bulan tidak ikut dihitung', () => {
  // Pasar C (50.000) hanya ada di bulan awal; bila ikut, rata-rata awal tidak 9.000.
  const result = service.getChange({ provinsi: 'JAWA TIMUR', dari: '2023-05', sampai: '2024-05' });
  assert.equal(result.pasarSama, 2);
  assert.equal(result.awal, 9000);
});

test('REQ-002 AC-3: tanpa pasar yang sama, perubahan tidak dapat dihitung beserta alasannya', () => {
  const result = service.getChange({ provinsi: 'ACEH', dari: '2023-05', sampai: '2024-05' });
  assert.equal(result.pasarSama, 0);
  assert.equal(result.awal, null);
  assert.equal(result.akhir, null);
  assert.equal(result.selisih, null);
  assert.equal(result.persen, null);
  assert.match(result.tidakDapatDihitung, /tidak dapat dihitung/);
  assert.match(result.tidakDapatDihitung, /tidak ada pasar/);
});

test('REQ-002 AC-4: harga awal nol menghasilkan persen null dan alasan, bukan Infinity', () => {
  const result = service.getChange({ provinsi: 'PAPUA', dari: '2023-05', sampai: '2024-05' });
  assert.equal(result.awal, 0);
  assert.equal(result.akhir, 5000);
  assert.equal(result.persen, null);
  assert.match(result.tidakDapatDihitung, /nol/);
});

test('REQ-002: komoditas lain tidak tercampur dan bulan awal sama dengan bulan akhir memberi perubahan nol', () => {
  const gula = service.getChange({ komoditas: 'gula-lokal', provinsi: 'JAWA TIMUR', dari: '2023-05', sampai: '2024-05' });
  assert.equal(gula.awal, 14000);
  assert.equal(gula.akhir, 90000);
  assert.equal(gula.persen, 542.9);

  const sameMonth = service.getChange({ provinsi: 'JAWA TIMUR', dari: '2023-05', sampai: '2023-05' });
  assert.equal(sameMonth.pasarSama, 3);
  assert.equal(sameMonth.selisih, 0);
  assert.equal(sameMonth.persen, 0);
});

test('REQ-002: bulan dengan format benar tetapi tanpa data dibalas tidak dapat dihitung, bukan error', () => {
  const result = service.getChange({ provinsi: 'BALI', dari: '2030-01', sampai: '2030-02' });
  assert.equal(result.pasarSama, 0);
  assert.match(result.tidakDapatDihitung, /tidak ada pasar/);
});

test('REQ-002 AC-5: bulan awal sesudah bulan akhir melempar ValidationError dengan pesan', () => {
  assert.throws(
    () => service.getChange({ provinsi: 'BALI', dari: '2024-05', sampai: '2023-05' }),
    (error) => error instanceof ValidationError && /tidak boleh setelah/.test(error.message),
  );
});

test('REQ-002: input tidak valid melempar ValidationError dengan pesan', () => {
  const bad = [
    [{ provinsi: 'BALI', dari: '2023-05', sampai: '2024-05', komoditas: 'durian' }, /Komoditas/],
    [{ provinsi: 'ATLANTIS', dari: '2023-05', sampai: '2024-05' }, /Provinsi/],
    [{ dari: '2023-05', sampai: '2024-05' }, /provinsi wajib/],
    [{ provinsi: 'BALI', sampai: '2024-05' }, /Bulan awal/],
    [{ provinsi: 'BALI', dari: '2023-05' }, /Bulan akhir/],
    [{ provinsi: 'BALI', dari: '2023-5', sampai: '2024-05' }, /YYYY-MM/],
    [{ provinsi: 'BALI', dari: '2023-05', sampai: '2024-13' }, /YYYY-MM/],
  ];
  for (const [badQuery, message] of bad) {
    assert.throws(
      () => service.getChange(badQuery),
      (error) => error instanceof ValidationError && message.test(error.message),
      JSON.stringify(badQuery),
    );
  }
});

// ---------- Lewat API ----------

test('REQ-002 AC-2: lewat API, 10.000 ke 12.000 menghasilkan persen 20', async () => {
  const { status, body } = await getSample('/api/perubahan?komoditas=beras-medium&provinsi=BALI&dari=2023-05&sampai=2024-05');
  assert.equal(status, 200);
  assert.equal(body.persen, 20);
  assert.equal(body.awal, 10000);
  assert.equal(body.akhir, 12000);
});

test('REQ-002 AC-3 dan AC-4: API membalas 200 dengan persen null dan alasan bila perubahan tidak dapat dihitung', async () => {
  for (const path of ['/api/perubahan?provinsi=ACEH&dari=2023-05&sampai=2024-05', '/api/perubahan?provinsi=PAPUA&dari=2023-05&sampai=2024-05']) {
    const { status, body } = await getSample(path);
    assert.equal(status, 200, path);
    assert.equal(body.persen, null, path);
    assert.equal(typeof body.tidakDapatDihitung, 'string', path);
  }
});

test('REQ-002 AC-5: bulan awal sesudah bulan akhir dibalas 400 dengan pesan JSON', async () => {
  const { status, body } = await getSample('/api/perubahan?provinsi=BALI&dari=2024-05&sampai=2023-05');
  assert.equal(status, 400);
  assert.match(body.pesan, /tidak boleh setelah/);
});

test('REQ-002: input tidak valid lewat API dibalas 400 dengan pesan JSON', async () => {
  const paths = [
    '/api/perubahan?provinsi=ATLANTIS&dari=2023-05&sampai=2024-05',
    '/api/perubahan?provinsi=BALI&komoditas=durian&dari=2023-05&sampai=2024-05',
    '/api/perubahan?provinsi=BALI&dari=2023-5&sampai=2024-05',
    '/api/perubahan?dari=2023-05&sampai=2024-05',
  ];
  for (const path of paths) {
    const { status, body } = await getSample(path);
    assert.equal(status, 400, path);
    assert.match(body.pesan, /\w+/, path);
  }
});

test('REQ-002 AC-1: API dengan data asli membalas harga awal, akhir, selisih, persen, dan jumlah pasar', async () => {
  const body = await (await fetch(`${realUrl}/api/perubahan?komoditas=beras-medium&provinsi=JAWA%20TIMUR&dari=2023-05&sampai=2024-05`)).json();
  assert.ok(body.pasarSama >= 1);
  assert.equal(body.selisih, body.akhir - body.awal);
  assert.ok(Math.abs(body.persen - (body.selisih / body.awal) * 100) < 0.1);
  assert.equal(body.tidakDapatDihitung, null);
});

test('REQ-002 (G-004): respons hanya berisi agregat, tidak ada baris per pasar', async () => {
  const body = await (await fetch(`${realUrl}/api/perubahan?provinsi=JAWA%20TIMUR&dari=2023-05&sampai=2024-05`)).json();
  const expectedKeys = ['komoditas', 'provinsi', 'dari', 'sampai', 'pasarSama', 'awal', 'akhir', 'selisih', 'persen', 'tidakDapatDihitung'];
  assert.deepEqual(Object.keys(body).sort(), [...expectedKeys].sort());
});

test('REQ-002 AC-1: halaman memuat kartu Perubahan harga dengan dua pilihan bulan dan skripnya memanggil /api/perubahan', async () => {
  const html = await (await fetch(`${realUrl}/`)).text();
  assert.match(html, /Perubahan harga/);
  assert.match(html, /id="change-from"/);
  assert.match(html, /id="change-to"/);
  const script = await (await fetch(`${realUrl}/app.js`)).text();
  assert.match(script, /\/api\/perubahan/);
});
