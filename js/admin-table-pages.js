/* JOKEMOO v15: small, indexed table pages without recreating hundreds of DOM rows.
   The existing Firebase data subscriptions and search stay in jokemoo.js. */
(() => {
  'use strict';

  const sizes = new Set([5, 10, 50, 100]);
  const selectors = {codes: '#codeSearch', history: '#historySearch'};
  const state = {};

  function loadSize(name) {
    try {
      const value = Number(localStorage.getItem('jokemoo.rows.' + name));
      return sizes.has(value) ? value : 10;
    } catch { return 10; }
  }

  function make(name) {
    const sizeEl = document.getElementById(name + 'PageSize');
    const buttons = document.getElementById(name + 'PageButtons');
    const summary = document.getElementById(name + 'PageSummary');
    const viewport = document.getElementById(name + 'Viewport');
    if (!sizeEl || !buttons || !summary || !viewport) return null;

    const s = {page: 0, size: loadSize(name), total: 0, query: '', sizeEl, buttons, summary, viewport};
    sizeEl.value = String(s.size);

    sizeEl.addEventListener('change', () => {
      const value = Number(sizeEl.value);
      if (!sizes.has(value)) return;
      s.size = value;
      s.page = 0;
      try { localStorage.setItem('jokemoo.rows.' + name, String(value)); } catch {}
      draw(s);
      refresh(name, true);
    });

    buttons.addEventListener('click', event => {
      const button = event.target.closest('button[data-target]');
      if (!button || button.disabled) return;
      const next = Number(button.dataset.target);
      if (!Number.isInteger(next) || next < 0 || next >= pages(s)) return;
      if (next === s.page) return;
      s.page = next;
      draw(s);
      refresh(name, true);
    });

    viewport.addEventListener('keydown', event => {
      if (!['PageDown','PageUp'].includes(event.key)) return;
      // Ordinary keyboard scrolling inside the table; browsers handle this natively.
    });

    return s;
  }

  function pages(s) { return Math.max(1, Math.ceil(s.total / s.size)); }

  function numbers(page, count) {
    if (count <= 7) return Array.from({length: count}, (_, i) => i);
    const out = new Set([0, count - 1]);
    for (let i = Math.max(0, page - 1); i <= Math.min(count - 1, page + 1); i++) out.add(i);
    if (page <= 2) {out.add(1); out.add(2); out.add(3);}
    if (page >= count - 3) {out.add(count - 2); out.add(count - 3); out.add(count - 4);}
    const sorted = [...out].sort((a,b) => a - b);
    const result = [];
    sorted.forEach((number,index) => {
      if (index && number - sorted[index - 1] > 1) result.push(null);
      result.push(number);
    });
    return result;
  }

  function pageButton(target, label, s, cls = '') {
    const disabled = target === s.page;
    return `<button type="button" class="jm-page-button ${cls}${disabled ? ' is-current' : ''}" data-target="${target}" ${disabled ? 'disabled' : ''} ${disabled ? 'aria-current="page"' : ''} aria-label="ไปหน้า ${target + 1}">${label}</button>`;
  }

  function draw(s) {
    const count = pages(s);
    s.page = Math.min(Math.max(0, s.page), count - 1);
    const first = s.total ? s.page * s.size + 1 : 0;
    const last = Math.min((s.page + 1) * s.size, s.total);
    s.summary.textContent = s.total ? `แสดง ${first.toLocaleString('th-TH')}–${last.toLocaleString('th-TH')} จาก ${s.total.toLocaleString('th-TH')} รายการ` : 'ไม่พบรายการ';
    let html = `<button type="button" class="jm-page-button jm-page-arrow" data-target="${Math.max(0,s.page-1)}" aria-label="หน้าก่อนหน้า" ${s.page === 0 ? 'disabled' : ''}>‹</button>`;
    for (const num of numbers(s.page,count)) {
      html += num === null ? '<span class="jm-page-ellipsis" aria-hidden="true">…</span>' : pageButton(num,String(num + 1),s);
    }
    html += `<button type="button" class="jm-page-button jm-page-arrow" data-target="${Math.min(count - 1,s.page + 1)}" aria-label="หน้าถัดไป" ${s.page === count - 1 ? 'disabled' : ''}>›</button>`;
    s.buttons.innerHTML = html;
  }

  function refresh(name, scrollTop = false) {
    if (scrollTop) state[name]?.viewport.scrollTo({top: 0, left: 0, behavior: 'auto'});
    const renderer = name === 'codes' ? window.JM_RENDER_CODES : window.JM_RENDER_HISTORY;
    renderer?.();
  }

  for (const name of Object.keys(selectors)) state[name] = make(name);

  window.JM_PAGINATION = {
    syncTotal(name, value, query = '') {
      const s = state[name];
      if (!s) return;
      const nextQuery = String(query || '').trim().toLowerCase();
      if (s.query !== nextQuery) {s.query = nextQuery; s.page = 0;}
      s.total = Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;
      draw(s);
    },
    start(name) {const s = state[name]; return s ? s.page * s.size : 0;},
    end(name) {const s = state[name]; return s ? (s.page + 1) * s.size : Number.MAX_SAFE_INTEGER;}
  };

  // Visual bulk-delete progress: existing Firebase write functions remain the sole owners of data changes.
  const modal = document.getElementById('confirmModal');
  const progressPanel = document.getElementById('jmBulkProgress');
  const bar = document.getElementById('jmBulkProgressBar');
  const label = document.getElementById('jmBulkProgressLabel');
  window.JM_BULK_PROGRESS = (done, total) => {
    if (!modal?.classList.contains('show') || !progressPanel || !bar || !label) return;
    const count = Number(total) || 0;
    if (count <= 1) return;
    progressPanel.hidden = false;
    const n = Math.max(0, Math.min(Number(done) || 0, count));
    bar.value = n;
    bar.max = count;
    label.textContent = n >= count ? `จัดการครบ ${count.toLocaleString('th-TH')} โค้ดแล้ว` : `กำลังจัดการ ${n.toLocaleString('th-TH')} / ${count.toLocaleString('th-TH')} โค้ด…`;
  };
  if (modal && progressPanel) {
    new MutationObserver(() => {
      if (!modal.classList.contains('show')) progressPanel.hidden = true;
    }).observe(modal,{attributes:true, attributeFilter:['class']});
  }
})();
