/* Presentation-only enhancement for the existing admin toast.
 * The legacy application still controls its message and lifetime; this file
 * mirrors the same information into a polished accessible notification.
 * It deliberately does not change Firebase requests or customer sounds.
 */
(() => {
  'use strict';

  const source = document.getElementById('toast');
  if (!source) return;

  const labels = window.JOKEMOO_SITE_CONFIG?.admin?.notifications || {};
  const titleByTone = {
    success: labels.successTitle || 'ดำเนินการสำเร็จ',
    error: labels.errorTitle || 'เกิดข้อผิดพลาด',
    warning: labels.warningTitle || 'โปรดตรวจสอบ',
    info: labels.infoTitle || 'แจ้งเตือน'
  };
  const icons = {
    success: '<path d="m5 12 4.5 4.5L19 7"/>',
    error: '<path d="M12 8v5m0 4h.01"/><circle cx="12" cy="12" r="9"/>',
    warning: '<path d="M12 3 2.5 19.5h19L12 3Zm0 6v4m0 4h.01"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-8h.01"/>'
  };
  const svg = content => `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${content}</svg>`;

  const shell = document.createElement('div');
  shell.className = 'admin-notification';
  shell.dataset.tone = 'info';
  shell.setAttribute('role', 'status');
  shell.setAttribute('aria-live', 'polite');
  shell.setAttribute('aria-atomic', 'true');
  shell.innerHTML = `
    <span class="admin-notification-icon" aria-hidden="true"></span>
    <div class="admin-notification-copy">
      <strong class="admin-notification-title"></strong>
      <span class="admin-notification-message"></span>
    </div>
    <button class="admin-notification-close" type="button" aria-label="${String(labels.dismissLabel || 'ปิดแจ้งเตือน').replace(/"/g, '&quot;')}">
      ${svg('<path d="M18 6 6 18M6 6l12 12"/>')}
    </button>`;
  document.body.appendChild(shell);
  source.classList.add('toast-source');
  source.setAttribute('aria-hidden', 'true');

  const icon = shell.querySelector('.admin-notification-icon');
  const title = shell.querySelector('.admin-notification-title');
  const message = shell.querySelector('.admin-notification-message');
  const close = shell.querySelector('.admin-notification-close');

  let lastMessage = '';
  let dismissed = false;
  let shown = false;

  function inferTone(value) {
    if (/(ผิดพลาด|ไม่สำเร็จ|ไม่สามารถ|ล้มเหลว|ไม่ถูกต้อง|ผิด|ปฏิเสธ|ไม่พบ|error|fail|denied)/i.test(value)) return 'error';
    if (/(สำเร็จ|เรียบร้อย|คัดลอก|บันทึก|ลบแล้ว|ลบโค้ดแล้ว|เพิ่มแล้ว|สร้างแล้ว|อัปเดตแล้ว)/i.test(value)) return 'success';
    if (/(กรุณา|โปรด|ระวัง|หมดอายุ|ไม่ได้|ต้อง|ยกเลิก|ไม่มี|กำลัง)/i.test(value)) return 'warning';
    return 'info';
  }

  function sync() {
    const active = source.classList.contains('show');
    const raw = source.textContent.trim();
    if (!active || !raw) {
      shell.classList.remove('show');
      shown = false;
      if (!active) dismissed = false;
      return;
    }
    if (raw !== lastMessage) {
      lastMessage = raw;
      dismissed = false;
    }
    if (dismissed) return;

    const tone = inferTone(raw);
    if (shell.dataset.tone !== tone || !shown) icon.innerHTML = svg(icons[tone]);
    shell.dataset.tone = tone;
    shell.setAttribute('role', tone === 'error' ? 'alert' : 'status');
    shell.setAttribute('aria-live', tone === 'error' ? 'assertive' : 'polite');
    title.textContent = titleByTone[tone];
    message.textContent = raw;
    shell.classList.add('show');
    shown = true;
  }

  close.addEventListener('click', () => {
    dismissed = true;
    shell.classList.remove('show');
    shown = false;
  });

  new MutationObserver(sync).observe(source, {
    attributes: true,
    attributeFilter: ['class'],
    childList: true,
    characterData: true,
    subtree: true
  });
  sync();
})();
