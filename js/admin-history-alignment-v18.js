/* JOKEMOO Lucky v18 — presentation-only normalization of history rows.
   Firestore data, pagination, row buttons and existing listeners remain unchanged. */
(() => {
  'use strict';
  const tbody = document.getElementById('historyBody');
  if (!tbody) return;

  function tidyHistoryRow(row) {
    if (!(row instanceof HTMLTableRowElement) || row.dataset.jmHistoryAligned === '1') return;
    const identity = row.cells?.[0];
    if (!identity) return;
    const existingSmall = identity.querySelector(':scope > small');
    const code = identity.querySelector(':scope > .code-pill');
    if (!existingSmall || !code) return;

    const originalNote = [...existingSmall.childNodes]
      .filter(node => node.nodeType === Node.TEXT_NODE)
      .map(node => node.textContent)
      .join('').trim();
    const labels = [...existingSmall.querySelectorAll('.jm-actor-label')];
    const metadata = document.createElement('div');
    metadata.className = 'jm-history-meta';

    if (originalNote && originalNote !== '-') {
      const note = document.createElement('span');
      note.className = 'jm-history-note';
      note.textContent = originalNote;
      note.title = originalNote;
      metadata.append(note);
    }
    for (const label of labels) metadata.append(label);
    // Keep the original label elements (and their content) intact; only their layout changes.
    const lineBreak = code.nextElementSibling;
    if (lineBreak?.tagName === 'BR') lineBreak.remove();
    existingSmall.replaceWith(metadata);
    identity.classList.add('jm-history-identity-cell');
    row.classList.toggle('jm-history-deleted-row', !!metadata.querySelector('.jm-actor-removed'));
    row.dataset.jmHistoryAligned = '1';
  }

  function tidyRows() {
    for (const row of tbody.rows) tidyHistoryRow(row);
  }

  const observer = new MutationObserver(records => {
    if (records.some(r => r.type === 'childList' && r.target === tbody)) tidyRows();
  });
  observer.observe(tbody, {childList: true});
  tidyRows();
})();
