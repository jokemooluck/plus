/*
 * UI companion for the existing admin. All Firebase create/delete functions
 * stay in jokemoo.js; this file only improves their presentation and guards
 * the high-risk "delete all" confirmation.
 * Editable strings and labels: ../site-config.js -> admin.deletion.
 */
(() => {
  'use strict';

  const cfg = window.JOKEMOO_SITE_CONFIG?.admin || {};
  const copy = cfg.deletion || {};
  const $ = (s) => document.querySelector(s);
  const put = (id, value) => {
    const element = $(id);
    if (element && typeof value === 'string') element.textContent = value;
  };

  const keys = {
    '#deleteExpiredCodesBtn': 'expiredTitle',
    '#deleteAllCodesBtn': 'allTitle',
    '#confirmPreserveText': 'preserveText',
    '#confirmAckText': 'acknowledgement'
  };
  for (const [selector, key] of Object.entries(keys)) put(selector, copy[key]);

  // The original application updates the topbar from an internal lookup;
  // keep it synchronized with the editable menu labels in site-config.js.
  const updatePageHeading = (page) => {
    const label = cfg.menu?.[page];
    const subtitle = cfg.pageSubtitles?.[page];
    if (typeof label === 'string') put('#pageTitle', label);
    if (typeof subtitle === 'string') put('#pageSub', subtitle);
  };
  document.querySelectorAll('.sidebar .nav-item[data-page]').forEach(button => {
    button.addEventListener('click', () => {
      requestAnimationFrame(() => updatePageHeading(button.dataset.page));
    });
  });
  updatePageHeading('overview');

  const modal = $('#confirmModal');
  const ok = $('#confirmOkBtn');
  const cancel = $('#confirmCancelBtn');
  const ackRow = $('#confirmAckRow');
  const ack = $('#confirmAck');
  const preserve = $('#confirmPreserve');
  const footnote = $('#confirmFootnote');
  const close = $('#confirmCloseBtn');
  if (!modal || !ok || !cancel || !ackRow || !ack) return;

  let previousFocus = null;
  let needsAck = false;

  const modeFromTitle = (title) => {
    if (title.startsWith('ลบโค้ดทั้งหมด')) return 'all';
    if (title.startsWith('ลบโค้ดหมดอายุ')) return 'expired';
    if (title.startsWith('ลบโค้ด')) return 'single';
    return 'other';
  };

  const refreshModal = () => {
    const open = modal.classList.contains('show');
    if (!open) {
      modal.dataset.deleteMode = '';
      ack.checked = false;
      needsAck = false;
      return;
    }

    const mode = modeFromTitle($('#confirmTitle')?.textContent.trim() || '');
    modal.dataset.deleteMode = mode;
    const isCodeDeletion = mode !== 'other';
    needsAck = mode === 'all' && copy.requireAcknowledgeAll !== false;
    // Safety acknowledgement for "delete all" is intentionally mandatory.
    ackRow.hidden = !needsAck;
    ack.checked = false;
    preserve.hidden = !isCodeDeletion;
    footnote.hidden = !isCodeDeletion;
    put('#confirmKicker', mode === 'expired' ? 'EXPIRED CODES' : mode === 'all' ? 'DANGER ZONE' : mode === 'single' ? 'DELETE CODE' : 'CONFIRM ACTION');
    ok.disabled = needsAck;
    const dialog = modal.querySelector('.confirm-card');
    dialog?.focus({ preventScroll: true });
  };

  // The application opens/closes this modal by toggling the .show class.
  // Observing that transition avoids changing its existing Firebase callbacks.
  new MutationObserver((records) => {
    if (records.some(r => r.attributeName === 'class')) refreshModal();
  }).observe(modal, { attributes: true, attributeFilter: ['class'] });

  ack.addEventListener('change', () => {
    if (needsAck) ok.disabled = !ack.checked;
  });

  // Secondary guard: no programmatic UI click can bypass the acknowledgement.
  ok.addEventListener('click', (event) => {
    if (needsAck && !ack.checked) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);

  close?.addEventListener('click', () => cancel.click());
  document.addEventListener('keydown', (event) => {
    if (!modal.classList.contains('show')) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      cancel.click();
      previousFocus?.focus?.({ preventScroll: true });
    }
  });
  // Remember which control opened the modal, so cancelling via Escape restores focus.
  document.addEventListener('click', event => {
    if (event.target.closest('#deleteExpiredCodesBtn,#deleteAllCodesBtn,.delete-code')) {
      previousFocus = event.target.closest('button');
    }
  }, true);
})();
