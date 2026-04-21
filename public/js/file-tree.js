document.addEventListener('DOMContentLoaded', () => {
  const tree = document.getElementById('file-tree');
  if (!tree) return;
  const postId = tree.dataset.postId;
  const previewPanel = document.getElementById('file-preview-panel');
  const previewContent = document.getElementById('preview-content');
  const previewFilename = document.getElementById('preview-filename');
  const previewCopyBtn = document.getElementById('preview-copy-btn');
  const previewDownloadLink = document.getElementById('preview-download-link');
  const previewCloseBtn = document.getElementById('preview-close-btn');

  let currentContent = '';

  function encodePath(p) {
    return p.split('/').map(encodeURIComponent).join('/');
  }

  function copyToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text);
    }
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.top = '-9999px';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    return new Promise((resolve, reject) => {
      document.execCommand('copy') ? resolve() : reject(new Error('execCommand failed'));
      document.body.removeChild(textarea);
    });
  }

  function openInNewTabBtn(url) {
    return `<div class="mb-2">
      <a href="${url}" target="_blank"
         class="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"/></svg>
        Open in new tab
      </a>
    </div>`;
  }

  tree.addEventListener('click', async (e) => {
    const fileItem = e.target.closest('.file-item');
    if (!fileItem) return;

    const filePath = fileItem.dataset.path;
    const ext = fileItem.dataset.ext;
    const encoded = encodePath(filePath);

    tree.querySelectorAll('.file-item').forEach(el => el.classList.remove('active'));
    fileItem.classList.add('active');

    previewFilename.textContent = filePath;
    previewDownloadLink.href = `/api/posts/${postId}/download/${encoded}`;
    previewPanel.classList.remove('hidden');
    previewContent.innerHTML = '<p class="text-sm text-gray-400">Loading...</p>';

    try {
      const imageExts = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico', '.bmp'];
      if (imageExts.includes(ext)) {
        previewContent.innerHTML = `<img src="/api/posts/${postId}/files/${encoded}" class="max-w-full rounded" alt="${filePath}">`;
        previewCopyBtn.classList.add('hidden');
        currentContent = '';
        return;
      }

      const res = await fetch(`/api/posts/${postId}/files/${encoded}`);
      const data = await res.json();

      if (data.type === 'html') {
        currentContent = data.content;
        previewContent.innerHTML = openInNewTabBtn(`/api/posts/${postId}/view/${encoded}`)
          + `<pre class="text-xs leading-relaxed overflow-x-auto"><code class="hljs">${data.highlighted}</code></pre>`;
        previewCopyBtn.classList.remove('hidden');
      } else if (data.type === 'markdown') {
        currentContent = data.content;
        previewContent.innerHTML = openInNewTabBtn(`/api/posts/${postId}/view/${encoded}`)
          + `<pre class="text-xs leading-relaxed overflow-x-auto"><code class="hljs">${data.highlighted}</code></pre>`;
        previewCopyBtn.classList.remove('hidden');
      } else if (data.type === 'text') {
        currentContent = data.content;
        previewContent.innerHTML = `<pre class="text-xs leading-relaxed overflow-x-auto"><code class="hljs">${data.highlighted}</code></pre>`;
        previewCopyBtn.classList.remove('hidden');
      } else if (data.type === 'binary') {
        currentContent = '';
        previewContent.innerHTML = `
          <div class="text-center py-6">
            <p class="text-sm text-gray-500 mb-2">Binary file (${formatSize(data.size)})</p>
            <a href="/api/posts/${postId}/download/${encoded}" class="text-sm text-indigo-600 hover:underline">Download</a>
          </div>`;
        previewCopyBtn.classList.add('hidden');
      }
    } catch (err) {
      previewContent.innerHTML = '<p class="text-sm text-red-500">Failed to load file.</p>';
    }
  });

  previewCopyBtn.addEventListener('click', async () => {
    if (!currentContent) return;
    try {
      await copyToClipboard(currentContent);
      previewCopyBtn.textContent = 'Copied!';
      setTimeout(() => { previewCopyBtn.textContent = 'Copy'; }, 1500);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  });

  previewCloseBtn.addEventListener('click', () => {
    previewPanel.classList.add('hidden');
    tree.querySelectorAll('.file-item').forEach(el => el.classList.remove('active'));
  });

  function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }
});
