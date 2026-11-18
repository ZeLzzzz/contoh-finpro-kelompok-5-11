// Hitungan murni untuk perbandingan komoditas (REQ-003). Tanpa Express, tanpa data.

// Indeks: harga dibagi harga bulan pertama, dikali 100 (1 desimal).
export function toIndex(price, firstPrice) {
  return Math.round((price / firstPrice) * 1000) / 10;
}

// "2023-01" -> 2023*12 + 0, supaya dua bulan berurutan selisihnya tepat 1.
function monthNumber(month) {
  const [year, number] = month.split('-').map(Number);
  return year * 12 + number - 1;
}

// Perubahan persen dari bulan ke bulan. Bulan yang bolong dilewati,
// karena perubahan dua bulan bukan perubahan satu bulan.
export function monthlyChanges(points) {
  const changes = [];
  for (let i = 1; i < points.length; i++) {
    const before = points[i - 1];
    const now = points[i];
    if (monthNumber(now.bulan) - monthNumber(before.bulan) !== 1) continue;
    changes.push((now.harga / before.harga - 1) * 100);
  }
  return changes;
}

// Simpangan baku sampel (dibagi n-1). Butuh minimal 2 angka.
export function sampleStandardDeviation(numbers) {
  if (numbers.length < 2) return null;
  const mean = numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
  const squares = numbers.reduce((sum, n) => sum + (n - mean) ** 2, 0);
  return Math.sqrt(squares / (numbers.length - 1));
}
