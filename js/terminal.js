(() => {
  'use strict';
  const root = document.documentElement;
  const prefersReducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const systemAppearance = matchMedia('(prefers-color-scheme: light)');
  const setAppearance = mode => {
    root.dataset.theme = mode;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = mode === 'light' ? '#f4f5ef' : '#101411';
    document.querySelectorAll('.giscus-frame').forEach(frame => {
      frame.contentWindow?.postMessage({ giscus: { setConfig: { theme: mode } } }, 'https://giscus.app');
    });
  };
  setAppearance(root.dataset.theme);
  document.querySelector('.theme-toggle')?.addEventListener('click', () => {
    const mode = root.dataset.theme === 'dark' ? 'light' : 'dark';
    root.dataset.preference = mode;
    setAppearance(mode);
    try { localStorage.setItem('terminal-appearance', mode); } catch (_) { /* Optional persistence. */ }
  });
  systemAppearance.addEventListener('change', event => {
    if (root.dataset.preference === 'auto') setAppearance(event.matches ? 'light' : 'dark');
  });

  const menuButton = document.querySelector('.menu-toggle');
  const nav = document.querySelector('.main-nav');
  const closeMenu = () => { nav?.classList.remove('open'); menuButton?.setAttribute('aria-expanded', 'false'); };
  menuButton?.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    menuButton.setAttribute('aria-expanded', String(open));
  });
  nav?.addEventListener('click', event => { if (event.target.closest('a')) closeMenu(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') closeMenu(); });

  const article = document.querySelector('.article');
  document.querySelectorAll('.prose figure.highlight, .prose > pre, .prose :not(figure):not(td) > pre').forEach(block => {
    if (block.closest('.code-wrapper, figure.highlight') && !block.matches('figure.highlight')) return;
    const wrapper = document.createElement('div');
    wrapper.className = 'code-wrapper';
    const toolbar = document.createElement('div');
    toolbar.className = 'code-toolbar';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'copy-button';
    button.textContent = article?.dataset.copyLabel || 'Copy';
    button.setAttribute('aria-live', 'polite');
    button.addEventListener('click', async () => {
      const code = block.querySelector('.code pre, code') || block;
      const text = code.textContent;
      try {
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(text);
        } else {
          const textarea = document.createElement('textarea');
          textarea.value = text;
          textarea.style.cssText = 'position:fixed;left:-9999px;top:0';
          document.body.append(textarea);
          let success = false;
          try { textarea.select(); success = document.execCommand('copy'); } finally { textarea.remove(); button.focus({ preventScroll: true }); }
          if (!success) throw new Error('Copy unavailable');
        }
        button.textContent = article?.dataset.copiedLabel || 'Copied!';
      } catch (_) {
        button.textContent = article?.dataset.copyError || 'Select to copy';
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(code);
        selection.removeAllRanges();
        selection.addRange(range);
      }
      window.setTimeout(() => { button.textContent = article?.dataset.copyLabel || 'Copy'; }, 2000);
    });
    block.before(wrapper);
    toolbar.append(button);
    wrapper.append(toolbar, block);
  });

  const progress = document.querySelector('.reading-progress');
  const topButton = document.querySelector('.back-top');
  const articleContent = document.getElementById('article-content');
  let scrollScheduled = false;
  const updateScroll = () => {
    if (topButton) topButton.hidden = window.scrollY < 500;
    if (progress && articleContent) {
      const bounds = articleContent.getBoundingClientRect();
      const start = bounds.top + window.scrollY;
      const range = Math.max(1, articleContent.offsetHeight - window.innerHeight);
      const fraction = Math.min(1, Math.max(0, (window.scrollY - start) / range));
      progress.style.transform = `scaleX(${fraction})`;
    }
    scrollScheduled = false;
  };
  const scheduleScroll = () => { if (!scrollScheduled) { scrollScheduled = true; requestAnimationFrame(updateScroll); } };
  window.addEventListener('scroll', scheduleScroll, { passive: true });
  window.addEventListener('resize', scheduleScroll, { passive: true });
  window.addEventListener('load', scheduleScroll);
  topButton?.addEventListener('click', () => window.scrollTo({ top: 0, behavior: prefersReducedMotion.matches ? 'instant' : 'smooth' }));
  updateScroll();

  const tocLinks = [...document.querySelectorAll('.toc-link')];
  if ('IntersectionObserver' in window && tocLinks.length) {
    const headings = [...document.querySelectorAll('.prose h1[id], .prose h2[id], .prose h3[id], .prose h4[id], .prose h5[id], .prose h6[id]')];
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        tocLinks.forEach(link => {
          let id;
          try { id = decodeURIComponent(link.hash.slice(1)); } catch (_) { id = link.hash.slice(1); }
          const active = id === entry.target.id;
          link.classList.toggle('active', active);
          if (active) link.setAttribute('aria-current', 'location'); else link.removeAttribute('aria-current');
        });
      });
    }, { rootMargin: '0px 0px -65% 0px', threshold: 0 });
    headings.forEach(heading => observer.observe(heading));
  }

  const giscus = document.querySelector('.giscus');
  if (giscus) {
    const script = document.createElement('script');
    script.src = 'https://giscus.app/client.js';
    script.async = true;
    script.crossOrigin = 'anonymous';
    Object.entries(giscus.dataset).forEach(([key, value]) => { script.dataset[key] = value; });
    Object.assign(script.dataset, { theme: root.dataset.theme, reactionsEnabled: '1', emitMetadata: '0', inputPosition: 'top', strict: '1', loading: 'lazy' });
    giscus.append(script);
  }

  const dialog = document.getElementById('search-dialog');
  if (!dialog) return;
  const input = document.getElementById('search-input');
  const status = document.getElementById('search-status');
  const results = document.getElementById('search-results');
  let indexPromise;
  let queryVersion = 0;
  let searchTimer;
  let returnFocus;
  const loadIndex = () => {
    if (!indexPromise) {
      indexPromise = fetch(dialog.dataset.index, { credentials: 'same-origin' })
        .then(response => { if (!response.ok) throw new Error('Index unavailable'); return response.json(); })
        .then(posts => {
          if (!Array.isArray(posts)) throw new Error('Invalid index');
          return posts.map(post => ({ ...post, title: String(post.title || ''), content: String(post.content || ''),
            searchTitle: String(post.title || '').toLocaleLowerCase(),
            searchTags: [...(post.tags || []), ...(post.categories || [])].join(' ').toLocaleLowerCase(),
            searchContent: String(post.content || '').toLocaleLowerCase() }));
        })
        .catch(error => { indexPromise = undefined; throw error; });
    }
    return indexPromise;
  };
  const highlight = (element, text, tokens) => {
    const lowered = text.toLocaleLowerCase();
    let cursor = 0;
    while (cursor < text.length) {
      let earliest = -1;
      let matchLength = 0;
      tokens.forEach(token => {
        const position = lowered.indexOf(token, cursor);
        if (position >= 0 && (earliest === -1 || position < earliest)) { earliest = position; matchLength = token.length; }
      });
      if (earliest === -1) { element.append(document.createTextNode(text.slice(cursor))); break; }
      element.append(document.createTextNode(text.slice(cursor, earliest)));
      const mark = document.createElement('mark');
      mark.textContent = text.slice(earliest, earliest + matchLength);
      element.append(mark);
      cursor = earliest + matchLength;
    }
  };
  const performSearch = async () => {
    const version = ++queryVersion;
    const tokens = [...new Set(input.value.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean))].slice(0, 12);
    results.replaceChildren();
    if (!tokens.length) { status.textContent = dialog.dataset.idle; return; }
    status.textContent = dialog.dataset.loading;
    try {
      const posts = await loadIndex();
      if (version !== queryVersion || !dialog.open) return;
      const matches = posts.map(post => {
        let score = 0;
        for (const token of tokens) {
          if (post.searchTitle.includes(token)) score += 6;
          else if (post.searchTags.includes(token)) score += 3;
          else if (post.searchContent.includes(token)) score += 1;
          else return null;
        }
        return { post, score };
      }).filter(Boolean).sort((a, b) => b.score - a.score);
      status.textContent = matches.length ? `${matches.length} ${dialog.dataset.results}` : dialog.dataset.empty;
      const fragment = document.createDocumentFragment();
      matches.slice(0, Number(dialog.dataset.limit) || 30).forEach(({ post }) => {
        const url = new URL(post.url, window.location.href);
        if (url.origin !== window.location.origin || !['https:', 'http:'].includes(url.protocol)) return;
        const li = document.createElement('li');
        const link = document.createElement('a');
        link.href = url.href;
        link.className = 'search-result';
        const title = document.createElement('h3');
        highlight(title, post.title, tokens);
        const date = document.createElement('time');
        date.textContent = post.date;
        date.dateTime = post.date;
        const excerpt = document.createElement('p');
        const positions = tokens.map(token => post.searchContent.indexOf(token)).filter(position => position >= 0);
        const start = Math.max(0, (positions.length ? Math.min(...positions) : 0) - 35);
        const snippet = (start ? '…' : '') + post.content.slice(start, start + 170) + (post.content.length > start + 170 ? '…' : '');
        highlight(excerpt, snippet, tokens);
        link.append(title, date, excerpt);
        li.append(link);
        fragment.append(li);
      });
      results.append(fragment);
    } catch (_) {
      if (version === queryVersion) status.textContent = dialog.dataset.error;
    }
  };
  const openSearch = () => {
    if (dialog.open) return;
    returnFocus = document.activeElement;
    dialog.showModal();
    document.body.classList.add('search-open');
    input.focus();
    performSearch();
  };
  document.querySelectorAll('[data-search-open]').forEach(button => button.addEventListener('click', openSearch));
  dialog.querySelector('[data-search-close]').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => {
    queryVersion++;
    clearTimeout(searchTimer);
    document.body.classList.remove('search-open');
    returnFocus?.focus();
  });
  dialog.addEventListener('click', event => {
    const bounds = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)) dialog.close();
  });
  input.addEventListener('input', () => {
    queryVersion++;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(performSearch, 140);
  });
  input.addEventListener('keydown', event => {
    if (event.key === 'Enter' && !event.isComposing) { clearTimeout(searchTimer); performSearch(); }
  });
  dialog.addEventListener('keydown', event => {
    if (!['ArrowDown', 'ArrowUp'].includes(event.key)) return;
    const links = [...results.querySelectorAll('a')];
    if (!links.length) return;
    event.preventDefault();
    const current = links.indexOf(document.activeElement);
    if (event.key === 'ArrowUp' && current === 0) { input.focus(); return; }
    const next = event.key === 'ArrowDown' ? Math.min(current + 1, links.length - 1) : current < 0 ? links.length - 1 : current - 1;
    links[next]?.focus();
  });
  document.addEventListener('keydown', event => {
    const editing = event.target.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]');
    if (event.isComposing || editing || event.altKey) return;
    if ((event.key === '/' && !event.metaKey && !event.ctrlKey) || (event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey))) {
      event.preventDefault();
      openSearch();
    }
  });
})();
