document.addEventListener('DOMContentLoaded', () => {
  // Clipboard helper that works on HTTP (non-secure context)
  function copyToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text);
    }
    // Fallback for HTTP: use textarea + execCommand
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

  // Raw Markdown copy button
  const rawBtn = document.getElementById('copy-raw-btn');
  if (rawBtn) {
    rawBtn.addEventListener('click', async () => {
      const postId = rawBtn.dataset.postId;
      try {
        const res = await fetch(`/posts/${postId}/raw`);
        const text = await res.text();
        await copyToClipboard(text);
        const original = rawBtn.innerHTML;
        rawBtn.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg> Copied!';
        rawBtn.classList.add('text-green-600', 'border-green-300');
        setTimeout(() => {
          rawBtn.innerHTML = original;
          rawBtn.classList.remove('text-green-600', 'border-green-300');
        }, 2000);
      } catch (err) {
        console.error('Copy failed:', err);
        alert('복사에 실패했습니다. 수동으로 복사해주세요.');
      }
    });
  }

  // Per-code-block copy buttons
  document.querySelectorAll('.prose pre').forEach((pre) => {
    const btn = document.createElement('button');
    btn.className = 'copy-btn';
    btn.textContent = 'Copy';
    btn.addEventListener('click', async () => {
      const code = pre.querySelector('code');
      if (!code) return;
      try {
        await copyToClipboard(code.innerText);
        btn.textContent = 'Copied!';
        btn.classList.add('copied');
        setTimeout(() => {
          btn.textContent = 'Copy';
          btn.classList.remove('copied');
        }, 2000);
      } catch (err) {
        console.error('Copy failed:', err);
      }
    });
    pre.appendChild(btn);
  });
});
