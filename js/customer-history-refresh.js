/* Visual enhancement for the existing customer history dialog.
 * The original application still queries Firestore and renders results.
 * We only summarize already-rendered rows; no change to its logic or sounds.
 */
(() => {
  'use strict';
  const body = document.getElementById('historyModalBody');
  const count = document.getElementById('historyEntryCount');
  if (!body || !count) return;
  const update = () => {
    const rows = body.querySelectorAll('.customer-history-row');
    const busy = body.querySelector('.history-loading');
    count.textContent = busy ? '—' : String(rows.length);
  };
  const observer = new MutationObserver(update);
  observer.observe(body, { childList: true, subtree: false });
  update();
})();
