import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHargaService, ValidationError } from '../src/harga-service.js';

// Data kecil buatan sendiri supaya hitungannya mudah diperiksa.
const data = {
  baris: [
    ['beras-medium', 'JAWA TIMUR', 'Pasar A', '2023-01', 10000],
    ['beras-medium', 'JAWA TIMUR', 'Pasar B', '2023-01', 12000],
    ['beras-medium', 'JAWA TIMUR', 'Pasar A', '2023-02', 11000],
    ['beras-medium', 'JAWA TIMUR', 'Pasar B', '2023-03', 13000],
    ['beras-medium', 'JAWA TIMUR', 'Pasar C', '2023-03', 14000],
    ['beras-medium', 'BALI', 'Pasar D', '2023-01', 15000],
    ['gula-lokal', 'JAWA TIMUR', 'Pasar A', '2023-01', 14000],
  ],
};
const service = createHargaService(data);
const query = { komoditas: 'beras-medium', provinsi: 'JAWA TIMUR' };

test('REQ-001 AC-1/AC-2: rata-rata bulanan tak berbobot, dengan jumlah pasar', () => {
  const result = service.getPrices(query);
  assert.deepEqual(result.titik.map((p) => [p.bulan, p.harga, p.pasar]), [
    ['2023-01', 11000, 2],
    ['2023-02', 11000, 1],
    ['2023-03', 13500, 2],
  ]);
  assert.equal(result.terakhir.bulan, '2023-03');
});

test('REQ-001 AC-1: flag cakupan penuh bila semua pasar ada, sebagian bila kurang', () => {
  const flags = service.getPrices(query).titik.map((p) => p.cakupan);
  assert.deepEqual(flags, ['penuh', 'sebagian', 'penuh']);
});

test('REQ-001 AC-1: filter periode memotong titik, dan hasil memuat metode serta atribusi', () => {
  const result = service.getPrices({ ...query, periode: '2023-02:2023-03' });
  assert.deepEqual(result.titik.map((p) => p.bulan), ['2023-02', '2023-03']);
  assert.match(result.metode, /tak berbobot/);
  assert.match(result.atribusi, /WFP\/HDX/);
});

test('REQ-001 AC-1: provinsi tidak peka huruf besar-kecil', () => {
  assert.equal(service.getPrices({ ...query, provinsi: 'jawa timur' }).provinsi, 'JAWA TIMUR');
});

test('REQ-001 AC-3: input tidak valid melempar ValidationError dengan pesan', () => {
  const bad = [
    [{ ...query, komoditas: 'durian' }, /Komoditas/],
    [{ ...query, komoditas: 'constructor' }, /Komoditas/], // nama bawaan JavaScript bukan komoditas
    [{ ...query, provinsi: 'ATLANTIS' }, /Provinsi/],
    [{ komoditas: 'beras-medium' }, /provinsi wajib/],
    [{ ...query, periode: '2023' }, /YYYY-MM/],
    [{ ...query, periode: '2023-13:2023-14' }, /YYYY-MM/],
    [{ ...query, periode: '2023-03:2023-01' }, /awal/],
  ];
  for (const [badQuery, message] of bad) {
    assert.throws(() => service.getPrices(badQuery), (error) => error instanceof ValidationError && message.test(error.message));
  }
});

test('REQ-001 AC-4: provinsi valid tanpa data di periode itu menghasilkan daftar kosong, bukan nol', () => {
  const result = service.getPrices({ komoditas: 'beras-medium', provinsi: 'BALI', periode: '2023-02:2023-03' });
  assert.deepEqual(result.titik, []);
  assert.equal(result.terakhir, null);
});
