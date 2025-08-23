// pdf-merge.js — client-side PDF merge using pdf-lib (lazy-load)
// Minimal implementation: drag/drop, file list with reorder buttons, merge and download.

const state = {
  files: [] // array of File
};

function $(id) { return document.getElementById(id); }

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B','KB','MB','GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function renderFileList() {
  const ul = $('file-list');
  ul.innerHTML = '';
  state.files.forEach((file, idx) => {
    const li = document.createElement('li');
    li.className = 'file-item';
    li.setAttribute('data-index', idx);

    const name = document.createElement('div');
    name.className = 'file-name';
    name.textContent = file.name;

    const meta = document.createElement('div');
    meta.className = 'file-meta';
    meta.textContent = formatBytes(file.size);

    const controls = document.createElement('div');
    controls.className = 'file-controls';

    const up = document.createElement('button');
    up.textContent = '↑';
    up.title = 'Move up';
    up.disabled = idx === 0;
    up.addEventListener('click', () => { swapFiles(idx, idx - 1); });

    const down = document.createElement('button');
    down.textContent = '↓';
    down.title = 'Move down';
    down.disabled = idx === state.files.length - 1;
    down.addEventListener('click', () => { swapFiles(idx, idx + 1); });

    const remove = document.createElement('button');
    remove.textContent = 'Remove';
    remove.title = 'Remove file';
    remove.addEventListener('click', () => { removeFile(idx); });

    controls.appendChild(up);
    controls.appendChild(down);
    controls.appendChild(remove);

    li.appendChild(name);
    li.appendChild(meta);
    li.appendChild(controls);

    ul.appendChild(li);
  });

  $('merge-btn').disabled = state.files.length < 2;
}

function swapFiles(a, b) {
  if (a < 0 || b < 0 || a >= state.files.length || b >= state.files.length) return;
  const tmp = state.files[a];
  state.files[a] = state.files[b];
  state.files[b] = tmp;
  renderFileList();
}

function removeFile(idx) {
  state.files.splice(idx, 1);
  renderFileList();
}

function addFiles(fileList) {
  for (const f of fileList) {
    if (f.type !== 'application/pdf') continue;
    state.files.push(f);
  }
  renderFileList();
}

async function mergeAndDownload() {
  if (state.files.length < 2) return;
  const status = $('status');
  $('merge-btn').disabled = true;
  status.textContent = 'Loading library...';

  try {
    const module = await import('https://unpkg.com/pdf-lib?module');
    const { PDFDocument } = module;

    status.textContent = 'Merging PDFs...';
    const mergedPdf = await PDFDocument.create();

    for (let i = 0; i < state.files.length; i++) {
      const file = state.files[i];
      status.textContent = `Processing ${file.name} (${i+1}/${state.files.length})`;
      const bytes = await file.arrayBuffer();
      const pdf = await PDFDocument.load(bytes);
      const copied = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
      copied.forEach(p => mergedPdf.addPage(p));
    }

    const mergedBytes = await mergedPdf.save();
    const blob = new Blob([mergedBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'merged.pdf';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    status.textContent = 'Merge complete. Download should start.';
  } catch (err) {
    console.error(err);
    $('status').textContent = 'Error during merge: ' + (err.message || err);
  } finally {
    $('merge-btn').disabled = false;
    setTimeout(() => { $('status').textContent = ''; }, 5000);
  }
}

function preventDefaults(e) {
  e.preventDefault();
  e.stopPropagation();
}

function setupDragAndDrop() {
  const dropArea = $('drop-area');
  const fileInput = $('file-input');
  const browseBtn = $('browse-btn');

  ['dragenter','dragover','dragleave','drop'].forEach(evt => {
    dropArea.addEventListener(evt, preventDefaults, false);
  });

  dropArea.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    if (dt && dt.files) addFiles(dt.files);
  });

  dropArea.addEventListener('click', () => fileInput.click());
  browseBtn.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', (e) => {
    addFiles(e.target.files);
    fileInput.value = '';
  });

  // keyboard support: Enter to open file picker
  dropArea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') fileInput.click();
  });

  $('merge-btn').addEventListener('click', mergeAndDownload);
}

document.addEventListener('DOMContentLoaded', () => {
  setupDragAndDrop();
  renderFileList();
});
