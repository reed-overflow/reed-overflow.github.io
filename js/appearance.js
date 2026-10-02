/* Apply the saved appearance before the first paint. */
(() => {
  const root = document.documentElement;
  root.classList.add('js');
  let saved;
  try { saved = localStorage.getItem('terminal-appearance'); } catch (_) { /* Storage may be disabled. */ }
  const mode = saved === 'dark' || saved === 'light' ? saved : root.dataset.theme;
  root.dataset.preference = mode;
  root.dataset.theme = mode === 'auto' ? (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark') : mode;
})();
