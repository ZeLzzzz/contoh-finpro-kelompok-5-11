// Halaman Harga: mengisi filter, mengambil data dari /api/harga, lalu menampilkannya.
// Alurnya: loadOptions() -> loadPrices() -> showPrices(). Kartu perubahan dua bulan (REQ-002)
// punya alur sendiri: loadChange() -> showChange(), lewat /api/perubahan.

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
  fillSelect($('change-from'), options.bulan, (month) => month, formatMonth);
  fillSelect($('change-to'), options.bulan, (month) => month, formatMonth);

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

// ---------- Perubahan harga dua bulan (REQ-002) ----------
// Kartu ini punya pilihan bulan sendiri, jadi tidak ikut filter periode tren.

const percentFormat = new Intl.NumberFormat('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
let latestChangeRequest = 0; // untuk mengabaikan jawaban kartu yang sudah lewat

// 20 -> "+20,0%", -16.7 -> "−16,7%". Tanda minus memakai "−" (U+2212) supaya lebih mudah dibaca.
function formatPercent(value) {
  let sign = '';
  if (value > 0) sign = '+';
  if (value < 0) sign = '−';
  return `${sign}${percentFormat.format(Math.abs(value))}%`;
}

// 2000 -> "+Rp 2.000", -500 -> "−Rp 500"
function formatDifference(value) {
  if (value > 0) return `+${formatPrice(value)}`;
  if (value < 0) return `−${formatPrice(-value)}`;
  return formatPrice(0);
}

// Bulan akhir bawaan = bulan terakhir tren yang tampil. Bulan awal = 12 bulan sebelumnya bila ada di data.
function setChangeDefaults() {
  const lastMonth = currentPoints.at(-1)?.bulan ?? options.periode.sampai;
  const [year, number] = lastMonth.split('-');
  setSelect('change-to', lastMonth, options.periode.sampai);
  setSelect('change-from', `${Number(year) - 1}-${number}`, options.periode.dari);
}

// Hanya satu keadaan yang terlihat. Hasil lama tidak ditampilkan di bawah pilihan baru,
// karena angkanya bisa tidak cocok dengan bulan yang sedang dipilih.
function showChangeLoading() {
  $('change-loading').hidden = false;
  $('change-error').hidden = true;
  $('change-result').hidden = true;
}

function showChangeError(message, canRetry) {
  $('change-error-message').textContent = message;
  $('change-retry').hidden = !canRetry;
  $('change-error').hidden = false;
  $('change-loading').hidden = true;
  $('change-result').hidden = true;
}

function showChange(data) {
  $('change-loading').hidden = true;
  $('change-error').hidden = true;
  $('change-result').hidden = false;

  $('change-from-label').textContent = `Harga ${formatMonth(data.dari)}`;
  $('change-to-label').textContent = `Harga ${formatMonth(data.sampai)}`;
  $('change-from-price').textContent = data.awal === null ? '—' : formatPrice(data.awal);
  $('change-to-price').textContent = data.akhir === null ? '—' : formatPrice(data.akhir);
  $('change-diff').textContent = data.selisih === null ? '—' : formatDifference(data.selisih);

  // Bila tidak dapat dihitung, persen tampil "—" dan alasannya di bawah, bukan nol atau NaN.
  const percent = $('change-percent');
  percent.textContent = data.persen === null ? '—' : formatPercent(data.persen);
  percent.classList.toggle('change-up', data.persen !== null && data.persen > 0);
  percent.classList.toggle('change-down', data.persen !== null && data.persen < 0);

  const notes = [];
  if (data.pasarSama > 0) notes.push(`Dari ${data.pasarSama} pasar yang sama.`);
  if (data.tidakDapatDihitung) notes.push(data.tidakDapatDihitung);
  $('change-note').textContent = notes.join(' ');
}

async function loadChange() {
  const thisRequest = ++latestChangeRequest;
  const query = new URLSearchParams({
    komoditas: $('komoditas').value,
    provinsi: $('provinsi').value,
    dari: $('change-from').value,
    sampai: $('change-to').value,
  }).toString();
  showChangeLoading();

  try {
    const response = await fetch(`/api/perubahan?${query}`);
    const body = await response.json().catch(() => ({}));
    if (thisRequest !== latestChangeRequest) return; // jawaban lama, abaikan
    if (response.status === 400) {
      // Pilihan yang salah, misalnya bulan awal setelah bulan akhir. Pesan server sudah jelas, jadi tidak perlu coba lagi.
      showChangeError(body.pesan ?? 'Pilihan bulan tidak valid.', false);
      return;
    }
    if (!response.ok) throw new Error(`Server membalas ${response.status}.`);
    showChange(body);
  } catch (error) {
    if (thisRequest !== latestChangeRequest) return;
    const message = error.message === 'Failed to fetch' ? 'Tidak bisa terhubung ke server.' : 'Perubahan harga gagal dimuat.';
    showChangeError(message, true);
  }
}

// ---------- Mulai ----------

for (const id of filterIds) $(id).addEventListener('change', loadPrices);
$('retry').addEventListener('click', loadPrices);
$('toggle-all').addEventListener('click', () => {
  allMonthsShown = !allMonthsShown;
  showRecentRows();
});

// Kartu perubahan: mengganti bulan, komoditas, atau provinsi memicu satu request.
for (const id of ['komoditas', 'provinsi', 'change-from', 'change-to']) $(id).addEventListener('change', loadChange);
$('change-retry').addEventListener('click', loadChange);

try {
  await loadOptions();
  await loadPrices();
  setChangeDefaults(); // setelah tren tampil, karena bulan akhir bawaan mengikuti tren itu
  await loadChange();
} catch (error) {
  showError(error.message);
}
