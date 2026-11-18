// Halaman Bandingkan: mengambil /api/bandingkan lalu menampilkan grafik indeks dan tabel.
// Alurnya: loadOptions() -> loadComparison() -> showComparison().

const $ = (id) => document.getElementById(id);
const filterIds = ['provinsi', 'dari', 'sampai'];

const rupiah = new Intl.NumberFormat('id-ID');
const formatPrice = (value) => `Rp ${rupiah.format(value)}`;
const oneDecimal = new Intl.NumberFormat('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const twoDecimals = new Intl.NumberFormat('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// "2024-05" -> "Mei 2024"
function formatMonth(month) {
  const [year, number] = month.split('-').map(Number);
  const name = new Date(year, number - 1, 1).toLocaleDateString('id-ID', { month: 'short' });
  return `${name[0].toUpperCase()}${name.slice(1)} ${year}`;
}

// "JAWA TIMUR" -> "Jawa Timur"
const formatProvince = (name) => name.toLowerCase().replace(/\b[a-z]/g, (letter) => letter.toUpperCase());

let latestRequest = 0; // untuk mengabaikan jawaban lama bila filter berubah lagi

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

function fillSelect(select, items, getLabel) {
  select.replaceChildren(
    ...items.map((item) => {
      const option = document.createElement('option');
      option.value = item;
      option.textContent = getLabel(item);
      return option;
    }),
  );
}

// Memilih nilai bila ada di daftar; kalau tidak, pakai nilai bawaan.
function setSelect(id, wanted, fallback) {
  const select = $(id);
  const exists = [...select.options].some((option) => option.value === wanted);
  select.value = exists ? wanted : fallback;
}

async function loadOptions() {
  const response = await fetch('/api/opsi');
  if (!response.ok) throw new Error('Pilihan filter gagal dimuat.');
  const options = await response.json();

  fillSelect($('provinsi'), options.provinsi, formatProvince);
  fillSelect($('dari'), options.bulan, formatMonth);
  fillSelect($('sampai'), options.bulan, formatMonth);

  // Nilai awal: dari alamat (?provinsi=...) atau bawaan.
  const params = new URLSearchParams(location.search);
  const [from, to] = (params.get('periode') ?? '').split(':');
  setSelect('provinsi', params.get('provinsi'), 'JAWA TIMUR');
  setSelect('dari', from, options.periode.dari);
  setSelect('sampai', to, options.periode.sampai);
}

// ---------- Mengambil data ----------

async function loadComparison() {
  const query = new URLSearchParams({
    provinsi: $('provinsi').value,
    periode: `${$('dari').value}:${$('sampai').value}`,
  }).toString();
  history.replaceState(null, '', `?${query}`); // filter ikut tersimpan di alamat
  const thisRequest = ++latestRequest;

  $('error').hidden = true;
  $('loading').hidden = false;

  try {
    const response = await fetch(`/api/bandingkan?${query}`);
    const body = await response.json().catch(() => ({}));
    if (thisRequest !== latestRequest) return; // jawaban lama, abaikan
    if (!response.ok) throw new Error(body.pesan ?? `Server membalas ${response.status}.`);
    showComparison(body);
  } catch (error) {
    if (thisRequest !== latestRequest) return;
    showError(error.message === 'Failed to fetch' ? 'Tidak bisa terhubung ke server.' : error.message);
  }
}

// ---------- Menampilkan data ----------

function showComparison(data) {
  $('note-method').textContent = `Metode: ${data.metode}`;
  $('note-source').textContent = `Sumber: ${data.atribusi}. Data hingga ${formatMonth(data.dataTerakhir)}.`;
  $('formula').textContent = `Rumus: ${data.rumusVolatilitas}`;

  const withData = data.komoditas.filter((item) => item.titik.length > 0);
  if (withData.length === 0) {
    $('finding').textContent = '';
    showOnly('empty');
    return;
  }

  showFinding(data);
  showChart(data, withData);
  showRows(data.komoditas);
  showOnly('dashboard');
}

// Satu kalimat temuan: komoditas dengan volatilitas tertinggi.
function showFinding(data) {
  const province = formatProvince(data.provinsi);
  const measured = data.komoditas.filter((item) => item.volatilitas !== null);
  if (measured.length === 0) {
    $('finding').textContent = `Volatilitas di ${province} belum dapat dihitung: butuh minimal 3 bulan data per komoditas.`;
    return;
  }
  const top = measured.reduce((best, item) => (item.volatilitas > best.volatilitas ? item : best));
  $('finding').textContent =
    `Di ${province}, ${top.nama.toLowerCase()} paling bergejolak: volatilitas ${twoDecimals.format(top.volatilitas)}% per bulan.`;
}

function showChart(data, withData) {
  // Bulan pada sumbu x: gabungan bulan semua komoditas, supaya seri yang bolong tetap sejajar.
  const months = [...new Set(withData.flatMap((item) => item.titik.map((point) => point.bulan)))].sort();
  $('chart-caption').textContent =
    `${formatProvince(data.provinsi)}, ${formatMonth(months[0])} sampai ${formatMonth(months.at(-1))}. Harga asli ada di tabel di bawah.`;
  $('chart').replaceChildren();
  $('chart-legend').replaceChildren();

  // Sumbu tidak perlu mulai dari 0: indeks berawal di 100, jadi mulai dekat nilai terendah.
  const lowest = Math.min(...withData.flatMap((item) => item.titik.map((point) => point.indeks)));

  const { legend } = Charts.line($('chart'), {
    height: 260,
    min: Math.floor(lowest / 25) * 25 - 25,
    labels: months.map(formatMonth),
    series: withData.map((item) => {
      const indexByMonth = Object.fromEntries(item.titik.map((point) => [point.bulan, point.indeks]));
      return { name: item.nama, values: months.map((month) => indexByMonth[month] ?? null) };
    }),
    format: (value) => oneDecimal.format(value),
  });
  if (legend) $('chart-legend').append(legend);
}

function showRows(commodities) {
  $('rows').replaceChildren(
    ...commodities.map((item) => {
      const last = item.titik.at(-1);
      const row = document.createElement('tr');
      row.className = 'border-b border-rule last:border-0 align-top';

      const cells = [
        ['py-3 pr-3 font-medium', item.nama],
        ['py-3 pr-3 text-muted', `${item.mutu}, ${item.satuan}`],
        ['figure py-3 pr-3 text-right', last ? `${formatPrice(last.harga)} (${formatMonth(last.bulan)})` : '—'],
        ['figure py-3 pr-3 text-right', last ? oneDecimal.format(last.indeks) : '—'],
      ];
      for (const [className, text] of cells) {
        const cell = document.createElement('td');
        cell.className = className;
        cell.textContent = text;
        row.append(cell);
      }

      const volatility = document.createElement('td');
      volatility.className = 'py-3 text-right';
      if (item.volatilitas !== null) {
        volatility.innerHTML = '<span class="figure"></span>';
        volatility.firstChild.textContent = `${twoDecimals.format(item.volatilitas)}%`;
      } else {
        // Tidak dapat dihitung: tanda "—" dengan alasan singkat, bukan nol.
        volatility.innerHTML = '<span class="figure">—</span><span class="block text-[12px] text-muted"></span>';
        volatility.lastChild.textContent = `Tidak dapat dihitung. ${item.alasan}`;
      }
      row.append(volatility);
      return row;
    }),
  );
}

// ---------- Mulai ----------

for (const id of filterIds) $(id).addEventListener('change', loadComparison);
$('retry').addEventListener('click', loadComparison);

try {
  await loadOptions();
  await loadComparison();
} catch (error) {
  showError(error.message);
}
