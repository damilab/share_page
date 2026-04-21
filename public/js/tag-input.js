document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('tags');
  if (!input) return;

  const suggestions = document.getElementById('tag-suggestions');
  let debounceTimer;

  input.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(async () => {
      const parts = input.value.split(',');
      const current = parts[parts.length - 1].trim();
      if (current.length < 1) { suggestions.classList.add('hidden'); return; }

      try {
        const res = await fetch(`/api/tags?q=${encodeURIComponent(current)}`);
        const tags = await res.json();
        if (tags.length === 0) { suggestions.classList.add('hidden'); return; }

        const existing = new Set(parts.slice(0, -1).map(t => t.trim().toLowerCase()));
        const filtered = tags.filter(t => !existing.has(t.name.toLowerCase()));
        if (filtered.length === 0) { suggestions.classList.add('hidden'); return; }

        suggestions.innerHTML = filtered.map(t =>
          `<div class="px-3 py-1.5 text-sm hover:bg-indigo-50 cursor-pointer" data-tag="${t.name}">${t.name}</div>`
        ).join('');
        suggestions.classList.remove('hidden');
      } catch (err) {
        suggestions.classList.add('hidden');
      }
    }, 200);
  });

  suggestions.addEventListener('click', (e) => {
    const tagEl = e.target.closest('[data-tag]');
    if (!tagEl) return;
    const parts = input.value.split(',').map(t => t.trim()).filter(Boolean);
    parts[parts.length - 1] = tagEl.dataset.tag;
    input.value = parts.join(', ') + ', ';
    suggestions.classList.add('hidden');
    input.focus();
  });

  document.addEventListener('click', (e) => {
    if (!suggestions.contains(e.target) && e.target !== input) {
      suggestions.classList.add('hidden');
    }
  });
});
