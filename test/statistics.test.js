import assert from 'node:assert/strict';
import { test } from 'node:test';
import { monthlyChanges, sampleStandardDeviation, toIndex } from '../src/statistics.js';

test('REQ-003 AC-2: indeks = harga / harga bulan pertama x 100, 1 desimal', () => {
  assert.equal(toIndex(10000, 10000), 100);
  assert.equal(toIndex(11000, 10000), 110);
  assert.equal(toIndex(10333, 10000), 103.3);
});

test('REQ-003 AC-3: perubahan bulanan dalam persen', () => {
  const points = [
    { bulan: '2023-01', harga: 100 },
    { bulan: '2023-02', harga: 110 },
    { bulan: '2023-03', harga: 99 },
  ];
  const changes = monthlyChanges(points);
  assert.equal(changes.length, 2);
  assert.ok(Math.abs(changes[0] - 10) < 1e-9);
  assert.ok(Math.abs(changes[1] - -10) < 1e-9);
});

test('REQ-003 AC-3: bulan yang bolong tidak dihitung sebagai perubahan satu bulan', () => {
  const points = [
    { bulan: '2023-01', harga: 100 },
    { bulan: '2023-03', harga: 120 },
    { bulan: '2023-04', harga: 120 },
  ];
  assert.deepEqual(monthlyChanges(points), [0]);
});

test('REQ-003 AC-3: simpangan baku sampel (n-1)', () => {
  // 2,4,4,4,5,5,7,9: rata-rata 5, jumlah kuadrat 32, sampel = sqrt(32/7)
  const result = sampleStandardDeviation([2, 4, 4, 4, 5, 5, 7, 9]);
  assert.ok(Math.abs(result - Math.sqrt(32 / 7)) < 1e-12);
});

test('REQ-003 AC-4: simpangan baku butuh minimal 2 angka', () => {
  assert.equal(sampleStandardDeviation([]), null);
  assert.equal(sampleStandardDeviation([5]), null);
});
