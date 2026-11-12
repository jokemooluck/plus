/* JOKEMOO v21: compact profile photo + immediate persistent removal; no Cloud Storage. */
(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const page = $('#page-profile');
  if (!page) return;
  const getAuth = () => { try { return window.firebase?.apps?.length ? firebase.auth() : null; } catch { return null; } };
  const getDB = () => { try { return window.firebase?.apps?.length ? firebase.firestore() : null; } catch { return null; } };
  const avatarIds = ['#profileAvatar','#profileAvatarPreview','#topAvatar','#sidebarAvatar','#menuAvatar'];
  const maxDataLength = 90000; // < 90 KB of Data URL per Firestore document.
  const cropCanvas = $('#jmCropCanvas');
  const cropModal = $('#jmCropModal');
  const fileInput = $('#profileUploadInput');
  const urlInput = $('#profilePhotoUrl');
  const cropZoom = $('#jmCropZoom');
  const cropContext = cropCanvas?.getContext('2d', { alpha: false });
  const state = {
    uid: '', savedImage: '', draftImage: '', dirty: false, mode: 'none',
    unsub: null, cropImage: null, cropZoom: 1, panX: 0, panY: 0,
    pointer: null, cropReturnFocus: null
  };
  const notify = (message, type = 'success') => {
    try { window.JOKEMOO_NOTIFY?.(message, type); } catch { /* Notifications are optional. */ }
  };
  const msg = (node, message, error = false) => {
    if (!node) return;
    node.textContent = message;
    node.classList.toggle('is-error', error);
    node.classList.toggle('is-success', !error && Boolean(message));
  };
  const initials = text => String(text || 'A').trim().charAt(0).toUpperCase();
  const accountUsername = user => String(user?.email || 'admin').split('@')[0].trim() || 'admin';
  const safeHttps = value => {
    try {
      const url = new URL(String(value || '').trim());
      return url.protocol === 'https:' ? url.href : '';
    } catch { return ''; }
  };
  const safeData = value => typeof value === 'string' && value.length <= maxDataLength &&
    /^data:image\/(?:webp|jpeg);base64,[A-Za-z0-9+/=]+$/.test(value) ? value : '';
  function applyAvatar(el, source, name) {
    if (!el) return;
    const safe = safeData(source) || safeHttps(source);
    el.textContent = safe ? '' : initials(name);
    el.style.backgroundImage = safe ? `url(${JSON.stringify(safe)})` : '';
    el.classList.toggle('has-photo', Boolean(safe));
  }
  function emitImage() {
    window.JOKEMOO_PROFILE_IMAGE_DATA = state.savedImage;
    window.dispatchEvent(new Event('jokemoo-avatar-changed'));
  }
  function applyProfile(user) {
    if (!user) return;
    const username = accountUsername(user);
    const display = (user.displayName || username).trim();
    const savedPhoto = state.savedImage || safeHttps(user.photoURL);
    for (const id of avatarIds) {
      if (id === '#profileAvatarPreview' && state.dirty) continue;
      applyAvatar($(id), savedPhoto, username);
    }
    if ($('#sidebarUsername')) $('#sidebarUsername').textContent = display;
    if ($('#menuDisplayName')) $('#menuDisplayName').textContent = display;
    if ($('#profileHeroName')) $('#profileHeroName').textContent = display;
    if ($('#profileIdentityUsername')) $('#profileIdentityUsername').textContent = '@' + username;
    if (!state.dirty) {
      $('#profileUsername').value = username;
      $('#profileAuthEmail').value = user.email || '';
      $('#profileDisplayName').value = display;
      urlInput.value = state.savedImage ? '' : (safeHttps(user.photoURL) || '');
      state.mode = state.savedImage ? 'upload' : (safeHttps(user.photoURL) ? 'url' : 'none');
    }
  }
  function renderPreview() {
    const user = getAuth()?.currentUser;
    if (!user) return;
    const fallback = accountUsername(user);
    const src = !state.dirty ? (state.savedImage || safeHttps(user.photoURL))
      : state.mode === 'upload' ? state.draftImage
      : state.mode === 'url' ? safeHttps(urlInput.value)
      : '';
    applyAvatar($('#profileAvatarPreview'), src, fallback);
    const modeLabel = $('#profilePhotoMode');
    if (modeLabel) modeLabel.textContent = state.mode === 'upload' ? 'รูปที่อัปโหลด' : state.mode === 'url' ? 'รูปจากลิงก์ HTTPS' : 'ใช้อักษรย่อ';
  }
  function subscribeAvatar(user) {
    state.unsub?.(); state.unsub = null;
    state.uid = user?.uid || '';
    state.savedImage = ''; state.draftImage = ''; state.dirty = false; state.mode = 'none';
    emitImage();
    if (!user) return;
    applyProfile(user);
    const db = getDB();
    if (!db) return;
    state.unsub = db.collection('admin_avatars').doc(user.uid).onSnapshot(snapshot => {
      if (state.uid !== user.uid) return;
      state.savedImage = snapshot.exists ? safeData(snapshot.data()?.imageData) : '';
      applyProfile(getAuth()?.currentUser);
      if (!state.dirty) renderPreview();
      emitImage();
    }, error => {
      console.warn('JOKEMOO avatar read:', error?.code || 'unknown');
      msg($('#profileInfoFeedback'), 'ไม่สามารถอ่านรูปโปรไฟล์จาก Firestore ได้ กรุณาตรวจ Rules', true);
    });
  }
  function switchTab(name) {
    for (const tab of document.querySelectorAll('[data-profile-tab]')) {
      const selected = tab.dataset.profileTab === name;
      tab.classList.toggle('is-current', selected);
      tab.setAttribute('aria-pressed', String(selected));
    }
    for (const pane of document.querySelectorAll('[data-profile-pane]'))
      pane.classList.toggle('is-current', pane.dataset.profilePane === name);
  }
  function openProfile() {
    const user = getAuth()?.currentUser;
    if (!user) return;
    document.querySelectorAll('.page.active').forEach(node => node.classList.remove('active'));
    page.classList.add('active');
    document.querySelectorAll('.sidebar .nav-item.active').forEach(node => node.classList.remove('active'));
    if ($('#pageTitle')) $('#pageTitle').textContent = 'ตั้งค่าโปรไฟล์';
    if ($('#pageSub')) $('#pageSub').textContent = 'ข้อมูลส่วนตัวและรหัสผ่าน';
    $('#sidebar')?.classList.remove('open');
    $('#sidebarOverlay')?.classList.remove('show');
    applyProfile(user); renderPreview(); switchTab('general');
    window.scrollTo({ top: 0, behavior: 'auto' });
  }
  $('#headerProfileBtn')?.addEventListener('click', openProfile);
  $('#sidebarProfileBtn')?.addEventListener('click', openProfile);
  document.querySelectorAll('[data-profile-tab]').forEach(node =>
    node.addEventListener('click', () => switchTab(node.dataset.profileTab)));
  getAuth()?.onAuthStateChanged(user => subscribeAvatar(user));

  urlInput?.addEventListener('input', () => {
    state.dirty = true;
    state.draftImage = '';
    state.mode = urlInput.value.trim() ? 'url' : 'none';
    renderPreview();
  });
  // Explicit delete action: persist immediately. The avatar must not return after reload.
  let removingPhoto = false;
  $('#profileRemovePhoto')?.addEventListener('click', async () => {
    const user = getAuth()?.currentUser;
    if (!user || removingPhoto) return;
    const db = getDB();
    const feedback = $('#profileInfoFeedback');
    const removeButton = $('#profileRemovePhoto');
    if (!db) return msg(feedback, 'Firestore ไม่พร้อมใช้งาน', true);
    removingPhoto = true;
    removeButton.disabled = true;
    removeButton.setAttribute('aria-busy', 'true');
    const before = {savedImage: state.savedImage, draftImage: state.draftImage,
      dirty: state.dirty, mode: state.mode, url: urlInput.value};
    const userId = user.uid;
    // Show the original account monogram right away, while the request is in progress.
    urlInput.value = '';
    state.draftImage = '';
    state.mode = 'none';
    state.dirty = true;
    applyAvatar($('#profileAvatarPreview'), '', accountUsername(user));
    msg(feedback, 'กำลังลบรูปโปรไฟล์…');
    try {
      // The avatar document is optional; delete() is safe if it does not exist.
      await db.collection('admin_avatars').doc(userId).delete();
      await user.updateProfile({photoURL: null});
      if (getAuth()?.currentUser?.uid !== userId) return;
      state.savedImage = '';
      state.draftImage = '';
      state.mode = 'none';
      state.dirty = false;
      // Update all live avatar surfaces immediately, independent of the snapshot delay.
      applyProfile(user);
      renderPreview();
      emitImage();
      window.dispatchEvent(new Event('jokemoo-profile-updated'));
      let directorySynced = true;
      try {
        const adminRef = db.collection('admins').doc(userId);
        const adminDoc = await adminRef.get();
        if (adminDoc.exists) await adminRef.update({photoURL: ''});
      } catch (directoryError) {
        console.warn('JOKEMOO admin directory avatar:', directoryError?.code || directoryError?.message);
        directorySynced = false;
      }
      const result = directorySynced
        ? 'ลบรูปเรียบร้อยแล้ว กลับไปใช้อักษรตัวแรกของ Username'
        : 'ลบรูปจากบัญชีแล้ว แต่ยังปรับรูปในรายชื่อสมาชิกไม่ได้ โปรดตรวจสิทธิ์ Firestore';
      msg(feedback, result, !directorySynced);
      notify(directorySynced ? 'ลบรูปโปรไฟล์เรียบร้อยแล้ว' : 'ลบรูปแล้ว แต่ข้อมูลรายชื่อยังไม่อัปเดต', directorySynced ? 'success' : 'warning');
    } catch (error) {
      console.warn('JOKEMOO remove profile photo:', error?.code || error?.message);
      if (getAuth()?.currentUser?.uid === userId) {
        state.savedImage = before.savedImage;
        state.draftImage = before.draftImage;
        state.dirty = before.dirty;
        state.mode = before.mode;
        urlInput.value = before.url;
        applyProfile(user);
        renderPreview();
        emitImage();
      }
      msg(feedback, error?.code === 'permission-denied'
        ? 'ไม่มีสิทธิ์ลบรูปใน Firestore กรุณาตรวจ Rules ของ admin_avatars'
        : 'ลบรูปไม่สำเร็จ กรุณาตรวจการเชื่อมต่อแล้วลองอีกครั้ง', true);
    } finally {
      removingPhoto = false;
      removeButton.disabled = false;
      removeButton.removeAttribute('aria-busy');
    }
  });
  $('#profileDisplayName')?.addEventListener('input', renderPreview);

  // Canvas cropper: pointer drag moves the photo, zoom is set by the range input.
  const canvasSize = 320;
  function drawCrop() {
    if (!cropCanvas || !cropContext || !state.cropImage) return;
    const img = state.cropImage;
    const cover = Math.max(canvasSize / img.naturalWidth, canvasSize / img.naturalHeight);
    const width = img.naturalWidth * cover * state.cropZoom;
    const height = img.naturalHeight * cover * state.cropZoom;
    const maxX = Math.max(0, (width - canvasSize) / 2);
    const maxY = Math.max(0, (height - canvasSize) / 2);
    state.panX = Math.max(-maxX, Math.min(maxX, state.panX));
    state.panY = Math.max(-maxY, Math.min(maxY, state.panY));
    cropContext.fillStyle = '#0c1826';
    cropContext.fillRect(0, 0, canvasSize, canvasSize);
    cropContext.drawImage(img, (canvasSize - width) / 2 + state.panX,
      (canvasSize - height) / 2 + state.panY, width, height);
  }
  function closeCrop() {
    if (!cropModal || cropModal.hidden) return;
    cropModal.hidden = true;
    document.body.classList.remove('jm-crop-open');
    state.pointer = null;
    const opener = state.cropReturnFocus;
    if (opener?.isConnected) opener.focus();
    state.cropReturnFocus = null;
  }
  function openCrop(file) {
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      msg($('#profileInfoFeedback'), 'รองรับเฉพาะ JPG, PNG และ WebP', true); return;
    }
    if (file.size > 8 * 1024 * 1024) {
      msg($('#profileInfoFeedback'), 'ไฟล์ต้นฉบับใหญ่เกิน 8 MB', true); return;
    }
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      state.cropImage = img;
      state.cropZoom = 1; state.panX = 0; state.panY = 0;
      if (cropZoom) cropZoom.value = '1';
      state.cropReturnFocus = $('#profileUploadBtn') || document.activeElement;
      cropModal.hidden = false;
      document.body.classList.add('jm-crop-open');
      drawCrop();
      $('#jmCropApply')?.focus();
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      msg($('#profileInfoFeedback'), 'เปิดรูปนี้ไม่ได้ กรุณาลองรูปอื่น', true);
    };
    img.src = objectUrl;
  }
  fileInput?.addEventListener('change', event => {
    openCrop(event.target.files?.[0]);
    fileInput.value = ''; // Allows choosing the same picture again.
  });
  $('#profileUploadBtn')?.addEventListener('click', () => fileInput?.click());
  cropZoom?.addEventListener('input', () => {
    const old = state.cropZoom;
    state.cropZoom = Number(cropZoom.value) || 1;
    if (old) { state.panX *= state.cropZoom / old; state.panY *= state.cropZoom / old; }
    drawCrop();
  });
  cropCanvas?.addEventListener('pointerdown', event => {
    event.preventDefault();
    state.pointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
    cropCanvas.setPointerCapture?.(event.pointerId);
  });
  cropCanvas?.addEventListener('pointermove', event => {
    if (!state.pointer || state.pointer.id !== event.pointerId) return;
    const rect = cropCanvas.getBoundingClientRect();
    const factor = canvasSize / (rect.width || canvasSize);
    state.panX += (event.clientX - state.pointer.x) * factor;
    state.panY += (event.clientY - state.pointer.y) * factor;
    state.pointer.x = event.clientX; state.pointer.y = event.clientY;
    drawCrop();
  });
  const endPointer = event => { if (state.pointer?.id === event.pointerId) state.pointer = null; };
  cropCanvas?.addEventListener('pointerup', endPointer);
  cropCanvas?.addEventListener('pointercancel', endPointer);
  cropCanvas?.addEventListener('keydown', event => {
    const step = event.shiftKey ? 16 : 5;
    if (!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    state.panX += event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0;
    state.panY += event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0;
    drawCrop();
  });
  cropModal?.querySelectorAll('[data-jm-crop-close]').forEach(node => node.addEventListener('click', closeCrop));
  document.addEventListener('keydown', event => { if (event.key === 'Escape') closeCrop(); });
  $('#jmCropApply')?.addEventListener('click', () => {
    if (!cropCanvas || !state.cropImage) return;
    const output = document.createElement('canvas');
    output.width = 256; output.height = 256;
    output.getContext('2d').drawImage(cropCanvas, 0, 0, 256, 256);
    let encoded = '';
    for (const quality of [0.78, 0.65, 0.52, 0.4]) {
      encoded = output.toDataURL('image/webp', quality);
      if (!encoded.startsWith('data:image/webp')) encoded = output.toDataURL('image/jpeg', quality);
      if (encoded.length <= maxDataLength) break;
    }
    if (!safeData(encoded)) {
      msg($('#profileInfoFeedback'), 'รูปยังใหญ่เกินไป กรุณาลองภาพที่มีรายละเอียดน้อยลง', true);
      return;
    }
    state.draftImage = encoded;
    state.mode = 'upload'; state.dirty = true;
    urlInput.value = '';
    renderPreview(); closeCrop();
    msg($('#profileInfoFeedback'), 'ครอบตัดรูปเรียบร้อยแล้ว กด “บันทึกข้อมูลโปรไฟล์” เพื่อบันทึก');
  });

  $('#profileInfoForm')?.addEventListener('submit', async event => {
    event.preventDefault();
    const button = $('#profileSaveBtn');
    const feedback = $('#profileInfoFeedback');
    const user = getAuth()?.currentUser;
    const displayName = $('#profileDisplayName').value.trim();
    if (!user) return msg(feedback, 'กรุณาเข้าสู่ระบบใหม่', true);
    if (displayName.length < 2 || displayName.length > 60)
      return msg(feedback, 'โปรดกรอกชื่อ 2–60 ตัวอักษร', true);
    const rawUrl = urlInput.value.trim();
    const photoURL = state.dirty && state.mode === 'url' ? safeHttps(rawUrl)
      : state.dirty ? '' : (state.savedImage ? '' : safeHttps(user.photoURL));
    if (state.mode === 'url' && rawUrl && !photoURL)
      return msg(feedback, 'ลิงก์รูปโปรไฟล์ต้องเป็น HTTPS ที่ถูกต้อง', true);
    const avatarData = state.dirty ? (state.mode === 'upload' ? safeData(state.draftImage) : '') : state.savedImage;
    if (state.mode === 'upload' && !avatarData)
      return msg(feedback, 'รูปที่อัปโหลดไม่ถูกต้อง กรุณาเลือกรูปใหม่', true);
    const shouldChangeAvatar = state.dirty;
    if (removingPhoto) return msg(feedback, 'กำลังลบรูป กรุณารอให้ดำเนินการเสร็จ', true);
    button.disabled = true;
    try {
      const db = getDB();
      if (!db) throw new Error('Firestore ไม่พร้อมใช้งาน');
      const avatarRef = db.collection('admin_avatars').doc(user.uid);
      // Do not pretend avatar was saved if Firestore Rules reject the write.
      if (shouldChangeAvatar) {
        if (avatarData) await avatarRef.set({ imageData: avatarData, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
        else await avatarRef.delete();
      }
      await user.updateProfile({ displayName, photoURL: photoURL || null });
      state.savedImage = avatarData;
      state.dirty = false; state.draftImage = '';
      applyProfile(user); renderPreview(); emitImage();
      window.dispatchEvent(new Event('jokemoo-profile-updated'));
      let synced = true;
      try {
        const ref = db.collection('admins').doc(user.uid);
        const snap = await ref.get();
        if (snap.exists) await ref.update({ displayName, photoURL: photoURL || '' });
      } catch (err) {
        console.warn('Admin directory profile sync:', err?.code || 'unknown');
        synced = false;
      }
      msg(feedback, synced ? 'บันทึกโปรไฟล์เรียบร้อยแล้ว' : 'บันทึกรูปและชื่อแล้ว แต่รายชื่อสมาชิกยังไม่อัปเดต');
      notify('บันทึกโปรไฟล์เรียบร้อยแล้ว');
    } catch (err) {
      console.error('JOKEMOO profile save:', err?.code || err?.message || 'unknown');
      msg(feedback, err?.code === 'permission-denied'
        ? 'Firestore ปฏิเสธการบันทึกรูป กรุณาติดตั้ง Rules สำหรับ admin_avatars ตามคู่มือ'
        : 'บันทึกไม่สำเร็จ กรุณาลองใหม่', true);
    } finally { button.disabled = false; }
  });
})();
