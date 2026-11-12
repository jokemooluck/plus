/* Unobtrusive admin account hub; leaves existing navigation, Firebase auth and code management untouched. */
(() => {
  'use strict';
  const $ = (selector) => document.querySelector(selector);
  const page = $('#page-profile');
  if (!page) return;
  const getAuth = () => { try { return window.firebase?.apps?.length ? firebase.auth() : null; } catch { return null; } };
  const msg = (node, message, error = false) => {
    if (!node) return;
    node.textContent = message;
    node.classList.toggle('is-error', error);
    node.classList.toggle('is-success', !error && Boolean(message));
  };
  const initials = (text) => String(text || 'A').trim().charAt(0).toUpperCase();
  function renderProfile(user) {
    if (!user) return;
    const username = (user.email || 'admin').split('@')[0];
    const display = (user.displayName || username).trim();
    $('#profileUsername').value = username;
    $('#profileAuthEmail').value = user.email || '';
    $('#profileDisplayName').value = display;
    $('#profilePhotoUrl').value = user.photoURL || '';
    $('#profileIdentityUsername').textContent = '@' + username;
    if ($('#profileHeroName')) $('#profileHeroName').textContent = display;
    const photo = (() => { try { const url = new URL(user.photoURL || ''); return url.protocol === 'https:' ? url.href : ''; } catch { return ''; } })();
    for (const el of ['#profileAvatar','#topAvatar','#sidebarAvatar']) {
      const avatar = $(el);
      avatar.textContent = photo ? '' : initials(display);
      avatar.style.backgroundImage = photo ? `url(${JSON.stringify(photo)})` : '';
      avatar.classList.toggle('has-photo', Boolean(photo));
    }
    if ($('#sidebarUsername')) $('#sidebarUsername').textContent = display;
  }
  function switchTab(name) {
    for (const tab of document.querySelectorAll('[data-profile-tab]')) {
      const selected = tab.dataset.profileTab === name;
      tab.classList.toggle('is-current', selected);
      tab.setAttribute('aria-pressed', String(selected));
    }
    for (const pane of document.querySelectorAll('[data-profile-pane]')) {
      pane.classList.toggle('is-current', pane.dataset.profilePane === name);
    }
  }
  function openProfile() {
    if (!getAuth()?.currentUser) return;
    document.querySelectorAll('.page.active').forEach((node) => node.classList.remove('active'));
    page.classList.add('active');
    document.querySelectorAll('.sidebar .nav-item.active').forEach((node) => node.classList.remove('active'));
    if ($('#pageTitle')) $('#pageTitle').textContent = 'ตั้งค่าโปรไฟล์';
    if ($('#pageSub')) $('#pageSub').textContent = 'ข้อมูลส่วนตัวและรหัสผ่าน';
    $('#sidebar')?.classList.remove('open');
    $('#sidebarOverlay')?.classList.remove('show');
    renderProfile(getAuth().currentUser);
    switchTab('general');
    window.scrollTo({ top: 0, behavior: 'auto' });
  }
  $('#headerProfileBtn')?.addEventListener('click', openProfile);
  $('#sidebarProfileBtn')?.addEventListener('click', openProfile);
  document.querySelectorAll('[data-profile-tab]').forEach((node) => node.addEventListener('click', () => switchTab(node.dataset.profileTab)));
  getAuth()?.onAuthStateChanged((user) => { if (user) renderProfile(user); });
  $('#profileInfoForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = $('#profileSaveBtn'), feedback = $('#profileInfoFeedback');
    const user = getAuth()?.currentUser;
    const displayName = $('#profileDisplayName').value.trim();
    if (!user) return msg(feedback, 'กรุณาเข้าสู่ระบบใหม่', true);
    if (displayName.length < 2 || displayName.length > 60) return msg(feedback, 'โปรดกรอกชื่อ 2–60 ตัวอักษร', true);
    const rawPhoto = $('#profilePhotoUrl').value.trim();
    let photoURL = null;
    if (rawPhoto) {
      try { const url = new URL(rawPhoto); if (url.protocol !== 'https:') throw new Error('HTTPS required'); photoURL = url.href; }
      catch { return msg(feedback, 'รูปโปรไฟล์ต้องเป็นลิงก์ HTTPS ที่ถูกต้อง', true); }
    }
    button.disabled = true;
    try {
      await user.updateProfile({ displayName, photoURL });
      renderProfile(user);
      window.dispatchEvent(new Event('jokemoo-profile-updated'));
      // Copy public profile details to the existing Firestore admin directory.
      // This is optional for the root account, which may not have an admins document.
      let directorySynced = true;
      try {
        const db = firebase.firestore();
        const ref = db.collection('admins').doc(user.uid);
        const snap = await ref.get();
        if (snap.exists) await ref.update({ displayName, photoURL: photoURL || '' });
      } catch (syncError) {
        directorySynced = false;
        console.warn('JOKEMOO profile directory sync failed:', syncError?.code || 'unknown');
      }
      msg(feedback, directorySynced ? 'บันทึกโปรไฟล์แล้ว' : 'บันทึกโปรไฟล์ใน Firebase Auth แล้ว แต่รูป/ชื่อในรายชื่อทีมยังไม่อัปเดต');
    } catch { msg(feedback, 'ไม่สามารถบันทึกข้อมูลได้ กรุณาลองใหม่', true); }
    finally { button.disabled = false; }
  });
})();
