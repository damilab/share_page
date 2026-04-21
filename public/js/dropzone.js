document.addEventListener('DOMContentLoaded', () => {
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('file-input');
  const fileInfo = document.getElementById('file-info');
  const fileName = document.getElementById('file-name');
  const fileSize = document.getElementById('file-size');
  const removeBtn = document.getElementById('remove-file');
  const progressWrap = document.getElementById('zip-progress');
  const progressBar = document.getElementById('zip-progress-bar');
  const progressText = document.getElementById('zip-progress-text');
  const form = document.getElementById('post-form');

  let pendingFile = null;

  function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function showFile(file) {
    pendingFile = file;
    fileName.textContent = file.name;
    fileSize.textContent = formatSize(file.size);
    fileInfo.classList.remove('hidden');
    dropzone.classList.add('hidden');
    progressWrap.classList.add('hidden');
  }

  function clearFile() {
    pendingFile = null;
    fileInput.value = '';
    fileInfo.classList.add('hidden');
    dropzone.classList.remove('hidden');
  }

  removeBtn.addEventListener('click', clearFile);
  fileInput.addEventListener('change', async () => {
    if (fileInput.files.length > 1) {
      await zipMultipleFiles(Array.from(fileInput.files));
    } else if (fileInput.files.length === 1) {
      showFile(fileInput.files[0]);
    }
  });

  dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('dragover'); });
  dropzone.addEventListener('dragleave', () => { dropzone.classList.remove('dragover'); });
  dropzone.addEventListener('drop', async (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');

    const items = e.dataTransfer.items;
    if (!items || items.length === 0) return;

    const entry = items[0].webkitGetAsEntry ? items[0].webkitGetAsEntry() : null;

    if (entry && entry.isDirectory) {
      progressWrap.classList.remove('hidden');
      dropzone.classList.add('hidden');
      try {
        const zip = new JSZip();
        await addDirectoryToZip(zip, entry, entry.name);
        const blob = await zip.generateAsync({ type: 'blob' }, (meta) => {
          progressBar.style.width = meta.percent.toFixed(0) + '%';
          progressText.textContent = meta.percent.toFixed(0) + '%';
        });
        const file = new File([blob], entry.name + '.zip', { type: 'application/zip' });
        const dt = new DataTransfer();
        dt.items.add(file);
        fileInput.files = dt.files;
        showFile(file);
      } catch (err) {
        console.error('Zip creation failed:', err);
        alert('폴더 압축 중 오류가 발생했습니다.');
        clearFile();
      }
    } else if (e.dataTransfer.files.length > 1) {
      await zipMultipleFiles(Array.from(e.dataTransfer.files));
    } else {
      const file = e.dataTransfer.files[0];
      if (file) {
        const dt = new DataTransfer();
        dt.items.add(file);
        fileInput.files = dt.files;
        showFile(file);
      }
    }
  });

  async function zipMultipleFiles(files) {
    progressWrap.classList.remove('hidden');
    dropzone.classList.add('hidden');
    try {
      const zip = new JSZip();
      for (const file of files) {
        zip.file(file.name, file);
      }
      const blob = await zip.generateAsync({ type: 'blob' }, (meta) => {
        progressBar.style.width = meta.percent.toFixed(0) + '%';
        progressText.textContent = meta.percent.toFixed(0) + '%';
      });
      const zipFile = new File([blob], 'files.zip', { type: 'application/zip' });
      const dt = new DataTransfer();
      dt.items.add(zipFile);
      fileInput.files = dt.files;
      showFile(zipFile);
    } catch (err) {
      console.error('Multi-file zip failed:', err);
      alert('파일 압축 중 오류가 발생했습니다.');
      clearFile();
    }
  }

  async function addDirectoryToZip(zip, dirEntry, path) {
    const entries = await readEntries(dirEntry);
    for (const entry of entries) {
      const entryPath = path + '/' + entry.name;
      if (entry.isDirectory) {
        await addDirectoryToZip(zip, entry, entryPath);
      } else {
        const file = await getFile(entry);
        zip.file(entryPath, file);
      }
    }
  }

  function readEntries(dirEntry) {
    return new Promise((resolve) => {
      const reader = dirEntry.createReader();
      const allEntries = [];
      const readBatch = () => {
        reader.readEntries((entries) => {
          if (entries.length === 0) { resolve(allEntries); return; }
          allEntries.push(...entries);
          readBatch();
        });
      };
      readBatch();
    });
  }

  function getFile(fileEntry) {
    return new Promise((resolve) => fileEntry.file(resolve));
  }
});
