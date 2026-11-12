/* JOKEMOO v19: one accessible, responsive notification system for storefront/admin.
 * Presentation only; no Firebase requests or authentication behaviour is changed.
 */
(() => {
  'use strict';
  if (window.JOKEMOO_NOTIFY_V19_READY) return;
  window.JOKEMOO_NOTIFY_V19_READY = true;

  const host = document.createElement('div');
  host.className = 'jm-toast-host jm-notice-v19';
  host.setAttribute('aria-live', 'polite');
  host.setAttribute('aria-atomic', 'true');
  const box = document.createElement('section');
  box.className = 'jm-toast jm-notice-card';
  box.setAttribute('role', 'status');
  const paths = {
    success: '<path d="m5 12 4 4L19 7"/>',
    error: '<circle cx="12" cy="12" r="9"/><path d="M12 7v6m0 4h.01"/>',
    warning: '<path d="M10.3 3.7 2.2 18a2 2 0 0 0 1.8 3h16a2 2 0 0 0 1.8-3L13.7 3.7a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4m0 4h.01"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10h.01"/>'
  };
  const labels = {
    success: 'สำเร็จแล้ว',
    error: 'ดำเนินการไม่สำเร็จ',
    warning: 'โปรดตรวจสอบ',
    info: 'แจ้งเตือนจาก JOKEMOO'
  };
  box.innerHTML = '<span class="jm-notice-icon" aria-hidden="true"></span>' +
    '<div class="jm-notice-copy"><span class="jm-notice-label">JOKEMOO CONTROL</span>' +
    '<strong class="jm-toast-heading"></strong><p class="jm-toast-description"></p></div>' +
    '<button type="button" class="jm-toast-close" aria-label="ปิดการแจ้งเตือน">' +
    '<svg viewBox="0 0 24 24" aria-hidden="true" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg></button>' +
    '<span class="jm-notice-progress" aria-hidden="true"></span>';
  host.appendChild(box);
  document.body.appendChild(host);
  const icon = box.querySelector('.jm-notice-icon');
  const heading = box.querySelector('.jm-toast-heading');
  const description = box.querySelector('.jm-toast-description');
  const progress = box.querySelector('.jm-notice-progress');
  let timeout = 0, frame = 0, previousText = '', previousAt = 0;

  function inferTone(message) {
    if (/(ไม่สำเร็จ|ไม่สามารถ|เกิดข้อผิดพลาด|ข้อผิดพลาด|ปฏิเสธ|ไม่ถูกต้อง|ไม่พบ|ไม่มีสิทธิ์|ล้มเหลว|error|failed|denied)/i.test(message)) return 'error';
    if (/(หมดอายุ|กรุณา|โปรด|คำเตือน|ต้อง|ระวัง|warning)/i.test(message)) return 'warning';
    if (/(เรียบร้อย|สำเร็จ|คัดลอก|บันทึก|สร้างแล้ว|ลบแล้ว|เปลี่ยนแล้ว|อัปเดตแล้ว|ส่งแล้ว)/i.test(message)) return 'success';
    return 'info';
  }
  function isVisible(element) {
    if (!element || element.hidden || element.closest('[hidden], [aria-hidden="true"]')) return false;
    if (!element.isConnected || !element.getClientRects().length) return false;
    const styles = getComputedStyle(element);
    return styles.visibility !== 'hidden' && styles.display !== 'none';
  }
  const intersectionArea = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) *
    Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));

  function position() {
    if (!host.classList.contains('is-visible')) return;
    const viewport = window.visualViewport;
    const ox = viewport ? viewport.offsetLeft : 0;
    const oy = viewport ? viewport.offsetTop : 0;
    const vw = viewport ? viewport.width : innerWidth;
    const vh = viewport ? viewport.height : innerHeight;
    const compact = vw <= 640;
    const inset = compact ? 12 : 22;
    const width = Math.min(compact ? 330 : 354, Math.max(220, vw - inset * 2));
    // Keep the toast away from the top account button and iOS safe area.
    const header = document.querySelector('#adminApp:not([hidden]) .topbar');
    const headerRect = isVisible(header) ? header.getBoundingClientRect() : null;
    const topBoundary = Math.max(inset + (compact ? 5 : 0), (headerRect && headerRect.bottom > 0 ? headerRect.bottom + 14 : 0));
    const height = Math.max(64, box.offsetHeight || 76);
    const topY = oy + Math.min(topBoundary, Math.max(inset, vh - height - inset));
    const bottomY = oy + Math.max(topBoundary, vh - height - inset - (compact ? 8 : 0));
    const leftX = ox + inset, rightX = ox + vw - inset - width;
    const candidates = compact ? [[leftX, bottomY], [leftX, topY]] :
      [[rightX, topY], [rightX, bottomY], [leftX, bottomY], [leftX, topY]];

    const controls = [...document.querySelectorAll('button, input, select, textarea, a[href], [role="dialog"]')]
      .filter(el => !host.contains(el) && isVisible(el)).slice(0, 240)
      .map(el => ({rect: el.getBoundingClientRect(), weight: el === document.activeElement ? 5 : el.matches('[role="dialog"]') ? 2 : 1}));
    const modal = document.querySelector('.history-modal.show, .result-modal.show, .v7-modal:not([hidden]), .admin-modal[aria-hidden="false"]');
    if (isVisible(modal)) controls.push({rect: modal.querySelector('[role="dialog"], .result-card')?.getBoundingClientRect() || modal.getBoundingClientRect(), weight: 3});
    let choice = candidates[0], best = Infinity;
    for (const [x, y] of candidates) {
      const rect = {left:x, top:y, right:x+width, bottom:y+height};
      const score = controls.reduce((sum, item) => sum + intersectionArea(rect,item.rect)*item.weight,0);
      if (score < best) { best = score; choice = [x,y]; }
    }
    host.style.setProperty('left', Math.round(choice[0])+'px', 'important');
    host.style.setProperty('top', Math.round(choice[1])+'px', 'important');
    host.style.setProperty('width', Math.round(width)+'px', 'important');
  }
  function reposition() {
    if (frame || !host.classList.contains('is-visible')) return;
    frame = requestAnimationFrame(() => { frame = 0; position(); });
  }
  function dismiss() {
    clearTimeout(timeout);
    box.classList.remove('jm-toast-open');
    host.classList.remove('is-visible');
  }
  function notify(message, type) {
    const text = String(message == null ? '' : message).trim().replace(/\s+/g, ' ').slice(0, 300);
    if (!text) return;
    const time = Date.now();
    if (text === previousText && time - previousAt < 1200) return;
    previousText = text; previousAt = time;
    const tone = paths[type] ? type : inferTone(text);
    box.dataset.tone = tone;
    icon.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+paths[tone]+'</svg>';
    heading.textContent = labels[tone];
    description.textContent = text;
    box.setAttribute('role', tone==='error'?'alert':'status');
    host.setAttribute('aria-live', tone==='error'?'assertive':'polite');
    clearTimeout(timeout);
    // Restart progress bar without repeated timers or layout polling.
    progress.style.animation = 'none';
    void progress.offsetWidth;
    progress.style.animation = '';
    host.classList.add('is-visible');
    box.classList.add('jm-toast-open');
    reposition();
    timeout = setTimeout(dismiss, 4400);
  }
  window.JOKEMOO_NOTIFY = notify;
  box.querySelector('.jm-toast-close').addEventListener('click',dismiss);
  window.addEventListener('resize', reposition, {passive:true});
  window.addEventListener('scroll', reposition, {passive:true, capture:true});
  window.visualViewport?.addEventListener('resize',reposition,{passive:true});
  window.visualViewport?.addEventListener('scroll',reposition,{passive:true});

  // Keep compatibility with existing status messages; do not change Firebase flow.
  const oldToast = document.getElementById('toast');
  if (oldToast) {
    oldToast.classList.add('jm-old-toast-hidden');
    const sync = () => {if (oldToast.classList.contains('show')) notify(oldToast.textContent);};
    new MutationObserver(sync).observe(oldToast,{attributes:true,attributeFilter:['class'],childList:true,subtree:true,characterData:true});
    sync();
  }
  const ids = ['loginMessage','profileInfoFeedback','securityFeedback','roleCreateFeedback','v7AccountFeedback','roleConnectionNote','formMessage'];
  ids.forEach(id=>{
    const element = document.getElementById(id);
    if (!element) return;
    let previous = '', delay;
    new MutationObserver(()=>{
      clearTimeout(delay);
      delay = setTimeout(()=>{
        const message = element.textContent.trim();
        if (!message || message === previous || /(กำลัง|loading|เชื่อมต่อ|ตรวจสอบสิทธิ์|พร้อมใช้งาน)/i.test(message)) return;
        if (id === 'roleConnectionNote' && !/(ผิด|ไม่สำเร็จ|ไม่มีสิทธิ์)/i.test(message)) return;
        previous = message;
        notify(message,element.classList.contains('error')?'error':undefined);
      }, 100);
    }).observe(element,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['class']});
  });
})();
