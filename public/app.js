// Halaman Harga: mengisi filter, mengambil data dari /api/harga, lalu menampilkannya.
// Alurnya: loadOptions() -> loadPrices() -> showPrices().

const $ = (id) => document.getElementById(id);
const filterIds = ['komoditas', 'provinsi', 'dari', 'sampai'];

const rupiah = new Intl.NumberFormat('id-ID');
const formatPrice = (value) => `Rp ${rupiah.format(value)}`;

// "2024-05" -> "Mei 2024"
function formatMonth(month) {
  const [year, number] = month.split('-').map(Number);
  const name = new Date(year, number - 1, 1).toLocaleDateString('id-ID', { month: 'short' });
  return `${name[0].toUpperCase()}${name.slice(1)} ${year}`;
}

// "JAWA TIMUR" -> "Jawa Timur"
const formatProvince = (name) => name.toLowerCase().replace(/\b[a-z]/g, (letter) => letter.toUpperCase());

let options = null; // isi /api/opsi
let latestRequest = 0; // untuk mengabaikan jawaban lama bila filter berubah lagi
let allMonthsShown = false;
let currentPoints = [];

// ---------- Status tampilan ----------

function showOnly(name) {
  // name: 'loading' | 'error' | 'empty' | 'dashboard'
  for (const id of ['loading', 'error', 'empty', 'dashboard']) $(id).hidden = id !== name;
}

function showError(message) {
  $('error-message').textContent = message;
  $('error').hidden = false;
  $('loading').hidden = true;
  // Tampilan sebelumnya tetap ada bila sudah pernah berhasil dimuat.
}

// ---------- Filter ----------

function fillSelect(select, items, getValue, getLabel) {
  select.replaceChildren(
    ...items.map((item) => {
      const option = document.createElement('option');
      option.value = getValue(item);
      option.textContent = getLabel(item);
      return option;
    }),
  );
}

async function loadOptions() {
  const response = await fetch('/api/opsi');
  if (!response.ok) throw new Error('Pilihan filter gagal dimuat.');
  options = await response.json();

  fillSelect($('komoditas'), options.komoditas, (item) => item.kode, (item) => item.nama);
  fillSelect($('provinsi'), options.provinsi, (name) => name, formatProvince);
  fillSelect($('dari'), options.bulan, (month) => month, formatMonth);
  fillSelect($('sampai'), options.bulan, (month) => month, formatMonth);

  // Nilai awal: dari alamat (?provinsi=...) atau bawaan.
  const params = new URLSearchParams(location.search);
  const [from, to] = (params.get('periode') ?? '').split(':');
  setSelect('komoditas', params.get('komoditas'), 'beras-medium');
  setSelect('provinsi', params.get('provinsi'), 'JAWA TIMUR');
  setSelect('dari', from, options.periode.dari);
  setSelect('sampai', to, options.periode.sampai);
}

// Memilih nilai bila ada di daftar; kalau tidak, pakai nilai bawaan.
function setSelect(id, wanted, fallback) {
  const select = $(id);
  const exists = [...select.options].some((option) => option.value === wanted);
  select.value = exists ? wanted : fallback;
}

function readFilters() {
  return {
    komoditas: $('komoditas').value,
    provinsi: $('provinsi').value,
    periode: `${$('dari').value}:${$('sampai').value}`,
  };
}

// ---------- Mengambil data ----------

async function loadPrices() {
  const filters = readFilters();
  const query = new URLSearchParams(filters).toString();
  history.replaceState(null, '', `?${query}`); // filter ikut tersimpan di alamat
  const thisRequest = ++latestRequest;

  $('error').hidden = true;
  $('loading').hidden = false;

  try {
    const response = await fetch(`/api/harga?${query}`);
    const body = await response.json().catch(() => ({}));
    if (thisRequest !== latestRequest) return; // jawaban lama, abaikan
    if (!response.ok) throw new Error(body.pesan ?? `Server membalas ${response.status}.`);
    showPrices(body);
  } catch (error) {
    if (thisRequest !== latestRequest) return;
    showError(error.message === 'Failed to fetch' ? 'Tidak bisa terhubung ke server.' : error.message);
  }
}

// ---------- Menampilkan data ----------

function showPrices(data) {
  $('title').textContent = `Harga ${data.komoditas.nama.toLowerCase()} di ${formatProvince(data.provinsi)}`;
  $('note-method').textContent = `Metode: ${data.metode}`;
  $('note-source').textContent = `Sumber: ${data.atribusi}. Data hingga ${formatMonth(data.dataTerakhir)}.`;

  if (!data.terakhir) {
    $('finding').textContent = '';
    showOnly('empty');
    return;
  }

  const last = data.terakhir;
  $('finding').textContent =
    `Rata-rata ${formatPrice(last.harga)}/kg pada ${formatMonth(last.bulan)}, dari ${last.pasar} pasar. Ini hasil data WFP, bukan harga toko.`;

  $('kpi-price').textContent = formatPrice(last.harga);
  $('kpi-price-note').textContent = `per kg, ${formatMonth(last.bulan)}`;
  $('kpi-markets').textContent = last.pasar;
  $('kpi-markets-note').textContent = `dari maksimum ${data.pasarMaksimum} pasar`;
  $('kpi-coverage').textContent = last.cakupan === 'penuh' ? 'Penuh' : 'Sebagian';
  $('kpi-last').textContent = formatMonth(last.bulan);

  currentPoints = data.titik;
  showChart(data);
  showRecentRows();
  showOnly('dashboard');
}

function showChart(data) {
  const first = data.titik[0];
  $('chart-caption').textContent =
    `${data.komoditas.nama}, ${data.komoditas.satuan}, ${formatMonth(first.bulan)} sampai ${formatMonth(data.terakhir.bulan)}.`;
  $('chart').replaceChildren();
  Charts.line($('chart'), {
    labels: data.titik.map((point) => formatMonth(point.bulan)),
    series: [{ name: `Harga ${formatProvince(data.provinsi)}`, values: data.titik.map((point) => point.harga) }],
    format: formatPrice,
  });
}

function showRecentRows() {
  const points = [...currentPoints].reverse(); // bulan terbaru di atas
  const shown = allMonthsShown ? points : points.slice(0, 5);
  $('recent-rows').replaceChildren(
    ...shown.map((point) => {
      const row = document.createElement('tr');
      row.className = 'border-b border-rule last:border-0 h-[45px]';
      row.innerHTML = `
        <td class="pl-4">${formatMonth(point.bulan)}</td>
        <td class="text-muted text-[12px]">${point.pasar} pasar${point.cakupan === 'sebagian' ? ', sebagian' : ''}</td>
        <td class="figure pr-4 text-right">${formatPrice(point.harga)}</td>`;
      return row;
    }),
  );
  $('toggle-all').textContent = allMonthsShown ? 'Tampilkan 5 bulan terakhir' : 'Lihat semua bulan';
  $('toggle-all').hidden = points.length <= 5;
}

// ---------- Mulai ----------

for (const id of filterIds) $(id).addEventListener('change', loadPrices);
$('retry').addEventListener('click', loadPrices);
$('toggle-all').addEventListener('click', () => {
  allMonthsShown = !allMonthsShown;
  showRecentRows();
});

try {
  await loadOptions();
  await loadPrices();
} catch (error) {
  showError(error.message);
}
