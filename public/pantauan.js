// Halaman Pantauan: daftar, tambah, ubah, dan hapus item lewat /api/pantauan.
// Teks dari server (terutama catatan) selalu dimasukkan dengan textContent, bukan innerHTML.

const $ = (id) => document.getElementById(id);
const MAX_NOTE = 280;

// "JAWA TIMUR" -> "Jawa Timur"
const formatProvince = (name) => name.toLowerCase().replace(/\b[a-z]/g, (letter) => letter.toUpperCase());

// Warna pil status memakai token pil dari sheet desain.
const STATUS = {
  dipantau: { label: 'Dipantau', style: 'bg-[#eeeeee] text-[#3d3d3d]' },
  ditindaklanjuti: { label: 'Ditindaklanjuti', style: 'bg-[#fffbeb] text-[#92400e]' },
  selesai: { label: 'Selesai', style: 'bg-[#dcfae5] text-[#04250e]' },
};

let komoditasNames = {}; // kode -> nama
let items = [];
let editingId = null; // id baris yang sedang diubah

// ---------- Pemanggilan API ----------

// Mengembalikan { status, body }. Gagal terhubung dilempar sebagai Error berpesan Indonesia.
async function callApi(method, path, data) {
  let response;
  try {
    response = await fetch(path, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: data === undefined ? undefined : JSON.stringify(data),
    });
  } catch {
    throw new Error('Tidak bisa terhubung ke server.');
  }
  const body = await response.json().catch(() => ({}));
  return { status: response.status, body };
}

// ---------- Elemen kecil ----------

function makeElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function makeButton(text, className, onClick) {
  const button = makeElement('button', className, text);
  button.type = 'button';
  button.addEventListener('click', onClick);
  return button;
}

const ghostButton = 'h-[30px] rounded-md border border-control bg-surface px-3 text-[12px]';

// ---------- Menampilkan daftar ----------

function showNotice(message) {
  $('notice').textContent = message;
  $('notice').hidden = message === '';
}

function showFinding() {
  const done = items.filter((item) => item.status === 'selesai').length;
  $('finding').textContent = items.length === 0 ? 'Belum ada item.' : `${items.length - done} item aktif, ${done} selesai`;
}

function renderList() {
  showFinding();
  $('empty').hidden = items.length > 0;
  $('items').replaceChildren(...items.map((item) => (item.id === editingId ? editRow(item) : readRow(item))));
}

function readRow(item) {
  const status = STATUS[item.status];
  const row = makeElement('li', 'min-h-[45px] px-4 py-2 border-b border-rule last:border-0 flex flex-wrap items-center gap-x-3 gap-y-1');

  const title = makeElement('div', 'min-w-0 flex-1 basis-48');
  title.append(
    makeElement('p', 'font-medium', komoditasNames[item.komoditas] ?? item.komoditas),
    makeElement('p', 'text-[12px] text-muted', formatProvince(item.provinsi)),
  );

  const note = makeElement('p', 'flex-[2] basis-48 min-w-0 break-words text-[12px]', item.catatan || 'Tanpa catatan');
  if (!item.catatan) note.classList.add('text-muted');

  const pill = makeElement('span', `rounded-full px-2 py-0.5 text-[12px] ${status.style}`, status.label);

  const actions = makeElement('div', 'flex gap-2');
  actions.append(
    makeButton('Ubah', ghostButton, () => startEdit(item.id)),
    makeButton('Hapus', ghostButton, () => deleteItem(item)),
  );

  row.append(title, note, pill, actions);
  return row;
}

function editRow(item) {
  const row = makeElement('li', 'px-4 py-3 border-b border-rule last:border-0 flex flex-col gap-2');
  row.append(
    makeElement('p', 'font-medium', `${komoditasNames[item.komoditas] ?? item.komoditas}, ${formatProvince(item.provinsi)}`),
  );

  const noteLabel = makeElement('label', 'text-[12px] text-muted', 'Catatan tindak lanjut');
  const note = makeElement('textarea', 'w-full rounded-md border border-control bg-surface px-2 py-2 text-[14px] text-ink');
  note.rows = 3;
  note.value = item.catatan;
  noteLabel.append(note);
  const noteError = makeElement('p', 'text-[12px] text-danger');
  noteError.hidden = true;

  const statusLabel = makeElement('label', 'text-[12px] text-muted', 'Status');
  const status = makeElement('select', 'mt-1 h-9 w-full rounded-md border border-control bg-surface px-2 text-[14px] text-ink');
  for (const [value, info] of Object.entries(STATUS)) {
    const option = makeElement('option', '', info.label);
    option.value = value;
    status.append(option);
  }
  status.value = item.status;
  statusLabel.append(status);
  const statusError = makeElement('p', 'text-[12px] text-danger');
  statusError.hidden = true;

  const save = makeButton('Simpan', 'h-9 rounded-md bg-accent px-4 text-white', () =>
    saveEdit(item.id, { catatan: note.value, status: status.value }, { catatan: noteError, status: statusError }),
  );
  const cancel = makeButton('Batal', 'h-9 rounded-md border border-control bg-surface px-4', () => {
    editingId = null;
    renderList();
  });
  const buttons = makeElement('div', 'flex gap-2');
  buttons.append(save, cancel);

  row.append(noteLabel, noteError, statusLabel, statusError, buttons);
  return row;
}

// ---------- Aksi ----------

function startEdit(id) {
  showNotice('');
  editingId = id;
  renderList();
}

// Item hilang di server (404): beri tahu pengguna lalu muat ulang daftar.
async function handleMissing() {
  editingId = null;
  await loadItems();
  showNotice('Item tidak ditemukan');
}

async function saveEdit(id, changes, errorElements) {
  showNotice('');
  for (const element of Object.values(errorElements)) element.hidden = true;
  try {
    const { status, body } = await callApi('PUT', `/api/pantauan/${id}`, changes);
    if (status === 404) return handleMissing();
    if (status === 409) return showNotice(body.pesan);
    if (status === 400) {
      // Isian tetap di kotak; hanya pesan yang muncul.
      for (const [field, message] of Object.entries(body.kolom ?? {})) {
        if (errorElements[field]) {
          errorElements[field].textContent = message;
          errorElements[field].hidden = false;
        }
      }
      return;
    }
    if (status !== 200) return showNotice(body.pesan ?? `Server membalas ${status}.`);
    editingId = null;
    await loadItems();
  } catch (error) {
    showNotice(error.message);
  }
}

async function deleteItem(item) {
  const name = `${komoditasNames[item.komoditas] ?? item.komoditas} di ${formatProvince(item.provinsi)}`;
  if (!confirm(`Hapus pantauan ${name}?`)) return;
  showNotice('');
  try {
    const { status, body } = await callApi('DELETE', `/api/pantauan/${item.id}`);
    if (status === 404) return handleMissing();
    if (status !== 204) return showNotice(body.pesan ?? `Server membalas ${status}.`);
    await loadItems();
  } catch (error) {
    showNotice(error.message);
  }
}

// ---------- Memuat daftar ----------

async function loadItems() {
  $('error').hidden = true;
  $('loading').hidden = true;
  try {
    const { status, body } = await callApi('GET', '/api/pantauan');
    if (status !== 200) throw new Error(body.pesan ?? `Server membalas ${status}.`);
    items = body;
    renderList();
  } catch (error) {
    $('error-message').textContent = error.message;
    $('error').hidden = false;
  }
}

async function start() {
  $('loading').hidden = false;
  $('error').hidden = true;
  try {
    const response = await fetch('/api/opsi');
    if (!response.ok) throw new Error('Pilihan komoditas dan provinsi gagal dimuat.');
    const options = await response.json();
    komoditasNames = Object.fromEntries(options.komoditas.map((item) => [item.kode, item.nama]));
    fillSelect($('komoditas'), options.komoditas.map((item) => [item.kode, item.nama]));
    fillSelect($('provinsi'), options.provinsi.map((name) => [name, formatProvince(name)]));
  } catch (error) {
    $('loading').hidden = true;
    $('error-message').textContent = error.message === 'Failed to fetch' ? 'Tidak bisa terhubung ke server.' : error.message;
    $('error').hidden = false;
    return;
  }
  await loadItems();
}

function fillSelect(select, pairs) {
  select.replaceChildren(
    ...pairs.map(([value, label]) => {
      const option = makeElement('option', '', label);
      option.value = value;
      return option;
    }),
  );
}

// ---------- Form tambah ----------

function showFieldErrors(fields) {
  for (const field of ['komoditas', 'provinsi', 'catatan']) {
    const message = fields[field];
    $(`error-${field}`).textContent = message ?? '';
    $(`error-${field}`).hidden = !message;
  }
}

$('catatan').addEventListener('input', () => {
  const length = $('catatan').value.length;
  $('counter').textContent = `${length}/${MAX_NOTE}`;
  $('counter').classList.toggle('text-danger', length > MAX_NOTE);
});

$('add-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  showFieldErrors({});
  $('form-message').hidden = true;
  showNotice('');
  $('save').disabled = true;
  try {
    const { status, body } = await callApi('POST', '/api/pantauan', {
      komoditas: $('komoditas').value,
      provinsi: $('provinsi').value,
      catatan: $('catatan').value,
    });
    if (status === 201) {
      $('catatan').value = '';
      $('counter').textContent = `0/${MAX_NOTE}`;
      await loadItems();
    } else if (status === 400) {
      showFieldErrors(body.kolom ?? {}); // isian pengguna tetap di form
    } else {
      $('form-message').textContent = body.pesan ?? `Server membalas ${status}.`;
      $('form-message').hidden = false;
    }
  } catch (error) {
    $('form-message').textContent = error.message;
    $('form-message').hidden = false;
  } finally {
    $('save').disabled = false;
  }
});

$('retry').addEventListener('click', start);

start();
