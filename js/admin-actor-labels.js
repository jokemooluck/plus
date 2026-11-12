/* UI labels for existing creator/deleter data. No activity tracking or Firestore listeners. */
(() => {
  'use strict';
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const shorten = value => String(value || '').trim().slice(0,80);
  window.JOKEMOO_CREATOR_LABEL = item => {
    const name = shorten(item?.createdByName || item?.createdBy);
    return name ? `<span class="jm-actor-label" title="ผู้สร้างโค้ด">สร้างโดย <b>@${escape(name)}</b></span>` : '<span class="jm-actor-label jm-actor-unknown">ผู้สร้าง: ไม่พบข้อมูลเดิม</span>';
  };
  window.JOKEMOO_DELETE_LABEL = item => {
    const name = shorten(item?.deletedBy);
    return name ? `<span class="jm-actor-label jm-actor-removed">ลบโดย <b>@${escape(name)}</b></span>` : '';
  };
})();
