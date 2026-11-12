/* JOKEMOO Lucky v8 — Firebase Auth + Firestore ONLY.
   - No custom endpoints, Workers, password recovery, or email services.
   - Firestore role writes MUST be authorized by deployed Firestore Security Rules.
   - Firebase client SDK cannot change another user's Auth password or delete that Auth user.
*/
(() => {
  'use strict';
  const $ = (selector) => document.querySelector(selector);
  const cfg = window.JOKEMOO_SITE_CONFIG || {};
  const rootEmail = String(cfg.admin?.rootEmail || '').trim().toLowerCase();
  const roles = Object.freeze({ dev: 'DEV', owner: 'OWNER', admin: 'ADMIN' });
  const state = { user: null, role: null, users: [], selected: null, adminsUnsubscribe: null, selfUnsubscribe: null, epoch: 0 };
  const accountModal = $('#v7AccountModal');
  const createModal = $('#roleCreateModal');
  let createReturnFocus = null;
  const auth = () => { try { return firebase.apps.length ? firebase.auth() : null; } catch { return null; } };
  const firestore = () => { try { return firebase.apps.length ? firebase.firestore() : null; } catch { return null; } };
  const getRoot = (user) => Boolean(user && rootEmail && String(user.email || '').toLowerCase() === rootEmail);
  const isManager = () => state.role === 'dev' || state.role === 'owner';
  const safeImage = (value) => { try { const u = new URL(value || ''); return u.protocol === 'https:' ? u.href : ''; } catch { return ''; } };
  const initials = (text) => String(text || 'A').trim().substring(0, 1).toUpperCase();
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const displayRole = (role) => roles[role] || '—';
  function message(selector, value, error = false) {
    const el = $(selector); if (!el) return;
    el.textContent = value;
    el.classList.toggle('error', error); el.classList.toggle('success', !error && Boolean(value));
  }
  function humanError(error) {
    switch (error?.code) {
      case 'permission-denied': return 'Firestore ปฏิเสธคำสั่ง โปรดตรวจสอบ Security Rules ของ admins';
      case 'auth/email-already-in-use': return 'Username นี้มีบัญชี Firebase อยู่แล้ว';
      case 'auth/weak-password': return 'รหัสผ่านสั้นหรือไม่ปลอดภัย';
      case 'auth/network-request-failed': return 'เครือข่ายมีปัญหา กรุณาลองใหม่';
      case 'auth/operation-not-allowed': return 'ต้องเปิด Email/Password ใน Firebase Authentication';
      default: return error?.message || 'ดำเนินการไม่สำเร็จ';
    }
  }
  function roleBadge(el, role) {
    if (!el) return;
    el.textContent = displayRole(role);
    el.classList.remove('dev','owner','admin');
    if (roles[role]) el.classList.add(role);
  }
  function setAvatar(el, url, text) {
    if (!el) return;
    const photo = safeImage(url);
    el.textContent = photo ? '' : initials(text);
    el.style.backgroundImage = photo ? `url(${JSON.stringify(photo)})` : '';
    el.classList.toggle('has-photo', Boolean(photo));
  }
  function renderIdentity(user) {
    if (!user) return;
    const username = String(user.email || 'admin').split('@')[0];
    const name = user.displayName || username;
    $('#menuDisplayName').textContent = name;
    $('#menuUsername').textContent = '@' + username;
    ['#menuAvatar','#topAvatar','#sidebarAvatar','#profileAvatarPreview'].forEach(id => setAvatar($(id), user.photoURL, name));
  }
  function toggleMenu(open) {
    const dropdown = $('#accountDropdown');
    if (!dropdown) return;
    dropdown.hidden = !open;
    $('#headerProfileBtn')?.setAttribute('aria-expanded', String(Boolean(open)));
  }
  // Capture phase wins over the older v6 profile click handler.
  $('#headerProfileBtn')?.addEventListener('click', event => {
    event.preventDefault(); event.stopImmediatePropagation();
    toggleMenu($('#accountDropdown').hidden);
  }, true);
  $('#profileMenuSettings')?.addEventListener('click', () => {
    toggleMenu(false);
    $('#sidebarProfileBtn')?.click();
  });
  $('#logoutBtn')?.addEventListener('click', () => toggleMenu(false));
  document.addEventListener('click', event => {
    if (!event.target.closest('#topAccountWrapper')) toggleMenu(false);
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') { toggleMenu(false); closeAccount(); closeCreateModal(); }
  });
  $('#profilePhotoUrl')?.addEventListener('input', () =>
    setAvatar($('#profileAvatarPreview'), $('#profilePhotoUrl').value, $('#profileDisplayName')?.value)
  );
  window.addEventListener('jokemoo-profile-updated', () => {
    renderIdentity(auth()?.currentUser);
  });
  function syncRole() {
    if(state.user){ window.JOKEMOO_ADMIN_IDENTITY={uid:state.user.uid,name:state.user.displayName||(state.user.email||'admin').split('@')[0],role:state.role||'admin'};window.dispatchEvent(new CustomEvent('jokemoo-role-synced',{detail:{role:state.role}})); }
    roleBadge($('#menuRole'), state.role);
    if ($('#topRoleMark')) $('#topRoleMark').textContent = displayRole(state.role);
    if ($('#profileRoleBadge')) $('#profileRoleBadge').textContent = displayRole(state.role);
    if ($('#roleCurrentLabel')) $('#roleCurrentLabel').textContent = displayRole(state.role);
    if ($('#accountCurrentRole')) $('#accountCurrentRole').textContent = 'ยศปัจจุบัน: ' + displayRole(state.role);
    const menu = $('.sidebar [data-page="accounts"]');
    if (menu) menu.style.display = isManager() ? '' : 'none';
    if (!isManager() && $('#page-accounts')?.classList.contains('active')) $('#sidebarProfileBtn')?.click();
    if ($('#rolesAccountControls')) $('#rolesAccountControls').hidden = !isManager();
    if ($('#roleOpenCreateBtn')) $('#roleOpenCreateBtn').hidden = !isManager();
    if (!isManager()) closeCreateModal(true);
    const roleField = $('#roleNewRole');
    if (roleField) {
      roleField.querySelectorAll('option').forEach(option => {
        option.disabled = state.role === 'owner' && option.value !== 'admin';
      });
      if (state.role === 'owner') roleField.value = 'admin';
    }
  }
  function clearListeners() {
    if (state.selfUnsubscribe) { state.selfUnsubscribe(); state.selfUnsubscribe = null; }
    if (state.adminsUnsubscribe) { state.adminsUnsubscribe(); state.adminsUnsubscribe = null; }
  }
  const isActive = data => data?.active !== false;
  function dataRole(data) {
    // Documents created before v8 have no role field and remain ADMIN.
    return Object.hasOwn(roles, data?.role) ? data.role : 'admin';
  }
  function setNotice(note, show = true) {
    const el = $('#roleConnectionNote'); if (!el) return;
    el.hidden = !show; el.textContent = note;
  }
  function signOutRevoked() {
    setNotice('บัญชีนี้ถูกถอนสิทธิ์เข้าหลังบ้านแล้ว', true);
    state.role = null; syncRole();
    auth()?.signOut().catch(() => {});
  }
  function attachMembers() {
    if (!isManager()) {
      if (state.adminsUnsubscribe) { state.adminsUnsubscribe(); state.adminsUnsubscribe = null; }
      return;
    }
    if (state.adminsUnsubscribe) return;
    state.adminsUnsubscribe = firestore().collection('admins').onSnapshot(snapshot => {
      const records = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), role: dataRole(doc.data()) }));
      // The original root may not have a Firestore admins document.
      if (getRoot(state.user) && !records.some(record => record.id === state.user.uid)) {
        records.unshift({ id: state.user.uid, username: cfg.admin.rootUsername || 'devbank',
          email: state.user.email, displayName: state.user.displayName,
          photoURL: state.user.photoURL, role: 'dev', isRoot: true });
      }
      state.users = records;
      $('#roleAccountCount').textContent = String(records.length);
      renderMembers();
      setNotice('', false);
    }, error => {
      setNotice('อ่านรายชื่อสมาชิกไม่ได้: ' + humanError(error) + ' (ถ้ายังไม่ได้ตั้ง Firestore Rules โปรดดูคู่มือ)', true);
    });
  }
  function updateRole(role) {
    state.role = role; syncRole();
    if (isManager()) attachMembers();
    else if (state.adminsUnsubscribe) { state.adminsUnsubscribe(); state.adminsUnsubscribe = null; }
  }
  function bootAuth() {
    const a = auth();
    if (!a) { setNotice('ไม่พบ Firebase Authentication กรุณาตรวจไฟล์ตั้งค่า', true); return; }
    a.onAuthStateChanged(user => {
      state.epoch++;
      const ownEpoch = state.epoch;
      clearListeners();
      closeAccount();
      state.user = user; state.users = []; state.selected = null;
      updateRole(null);
      if (!user) { toggleMenu(false); return; }
      renderIdentity(user);
      if (getRoot(user)) {
        updateRole('dev');
      } else {
        state.selfUnsubscribe = firestore().collection('admins').doc(user.uid).onSnapshot(doc => {
          if (ownEpoch !== state.epoch) return;
          if (!doc.exists || !isActive(doc.data())) { signOutRevoked(); return; }
          updateRole(dataRole(doc.data()));
        }, error => {
          if (ownEpoch !== state.epoch) return;
          updateRole(null);
          setNotice('ไม่สามารถตรวจสอบสิทธิ์ Firestore ได้: ' + humanError(error), true);
        });
      }
    });
  }
  // Main app normally initializes Firebase synchronously; DOMContentLoaded fallback for slow scripts.
  if (auth()) bootAuth(); else document.addEventListener('DOMContentLoaded', bootAuth, { once: true });

  function canManage(member) {
    if (!member || !state.user || member.id === state.user.uid || member.isRoot ||
      String(member.email || '').toLowerCase() === rootEmail) return false;
    return state.role === 'dev' || (state.role === 'owner' && member.role === 'admin');
  }
  function renderMembers() {
    const listNode = $('#secureAdminsList'); if (!listNode) return;
    const needle = ($('#roleSearch')?.value || '').trim().toLowerCase();
    const visible = state.users.filter(item =>
      (String(item.username || '') + ' ' + String(item.displayName || '')).toLowerCase().includes(needle));
    listNode.innerHTML = visible.length ? visible.map(item => {
      const username = String(item.username || (item.email || 'admin').split('@')[0]);
      const name = item.displayName || username;
      const photo = safeImage(item.photoURL);
      const content = photo
        ? `<img src="${esc(photo)}" alt="" loading="lazy" referrerpolicy="no-referrer">`
        : esc(initials(name));
      return `<div class="role-user-row">
        <div class="role-user-avatar">${content}</div>
        <div class="role-user-meta"><strong>${esc(name)}</strong><small>@${esc(username)}</small><small class="jm-added-by">${item.createdBy ? `เพิ่มโดย @${esc(item.createdBy)}` : (item.isRoot ? "บัญชีหลัก DEV" : "ไม่พบผู้เพิ่มในข้อมูลเดิม")}</small></div>
        <span class="role-badge ${esc(item.role)}">${esc(displayRole(item.role))}</span>
        <button class="role-user-manage" data-manage-user="${esc(item.id)}" type="button" ${canManage(item) ? '' : 'disabled title="ไม่มีสิทธิ์จัดการ"'}>จัดการ</button>
      </div>`;
    }).join('') : '<p class="role-empty">ไม่พบผู้ดูแล</p>';
  }
  $('#roleSearch')?.addEventListener('input', renderMembers);
  $('#secureAdminsList')?.addEventListener('click', event => {
    const btn = event.target.closest('[data-manage-user]');
    if (!btn || btn.disabled) return;
    const member = state.users.find(item => item.id === btn.dataset.manageUser);
    if (canManage(member)) openAccount(member);
  });

  function openCreateModal() {
    if (!isManager() || !state.user || !createModal) return;
    createReturnFocus = document.activeElement;
    const form = $('#roleCreateAccountForm');
    form?.reset();
    message('#roleCreateFeedback', '');
    const chooseRole = $('#roleNewRole');
    if (chooseRole && state.role === 'owner') chooseRole.value = 'admin';
    createModal.hidden = false;
    document.body.classList.add('role-dialog-open');
    $('#roleOpenCreateBtn')?.setAttribute('aria-expanded', 'true');
    requestAnimationFrame(() => $('#roleNewUsername')?.focus());
  }
  function closeCreateModal(force = false) {
    if (!createModal || createModal.hidden) return;
    if (!force && $('#roleCreateAccountBtn')?.disabled) return;
    createModal.hidden = true;
    document.body.classList.remove('role-dialog-open');
    $('#roleOpenCreateBtn')?.setAttribute('aria-expanded', 'false');
    $('#roleNewPassword').value = '';
    if (createReturnFocus && typeof createReturnFocus.focus === 'function' && createReturnFocus.isConnected) createReturnFocus.focus();
    createReturnFocus = null;
  }
  $('#roleOpenCreateBtn')?.addEventListener('click', openCreateModal);
  createModal?.querySelectorAll('[data-close-role-create]').forEach(node => node.addEventListener('click', () => closeCreateModal()));
  createModal?.addEventListener('keydown', event => {
    if (event.key !== 'Tab') return;
    const focusables = [...createModal.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled)')];
    if (!focusables.length) return;
    const first = focusables[0], last = focusables.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });

  $('#roleCreateAccountForm')?.addEventListener('submit', async event => {
    event.preventDefault();
    if (!isManager() || !state.user) return;
    const username = $('#roleNewUsername').value.trim().toLowerCase();
    const password = $('#roleNewPassword').value;
    const role = $('#roleNewRole').value;
    if (!/^[a-z0-9_.-]{3,30}$/.test(username)) return message('#roleCreateFeedback','Username ต้องมี 3–30 ตัว และใช้เฉพาะ a–z 0–9 . _ -',true);
    if (password.length < 8 || password.length > 128) return message('#roleCreateFeedback','Password ต้องมี 8–128 ตัวอักษร',true);
    if (!(role in roles) || (state.role === 'owner' && role !== 'admin')) return message('#roleCreateFeedback','ยศนี้ไม่อยู่ในสิทธิ์ของคุณ',true);
    const button = $('#roleCreateAccountBtn');
    button.disabled = true; button.textContent = 'กำลังสร้างบัญชี...';
    message('#roleCreateFeedback','กำลังสร้างบัญชีใน Firebase...');
    let secondaryApp, newUser, saved = false;
    try {
      // Dedicated app prevents changing the currently signed-in admin.
      secondaryApp = firebase.initializeApp(cfg.firebase, `jokemoo-signup-${Date.now()}-${Math.random().toString(36).slice(2)}`);
      const secondaryAuth = secondaryApp.auth();
      await secondaryAuth.setPersistence(firebase.auth.Auth.Persistence.NONE);
      const email = `${username}@jokemoo.local`;
      const result = await secondaryAuth.createUserWithEmailAndPassword(email, password);
      newUser = result.user;
      const data = { username, email, role, active: true, createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        createdBy: String(state.user.email || '').split('@')[0], displayName: username, photoURL: '' };
      await firestore().collection('admins').doc(newUser.uid).set(data);
      saved = true;
      window.JOKEMOO_LOG_ACTION?.('account_created',username,'ยศ '+displayRole(role));
      $('#roleCreateAccountForm').reset();
      closeCreateModal(true);
      if (window.JOKEMOO_NOTIFY) window.JOKEMOO_NOTIFY(`สร้างบัญชี ${username} ยศ ${displayRole(role)} สำเร็จ`, 'success');
      else setNotice(`สร้างบัญชี ${username} ยศ ${displayRole(role)} ผ่าน Firebase แล้ว`, true);
    } catch (error) {
      // If Firestore refused the role record, roll back the just-created Auth user.
      if (!saved && newUser) {
        try { await newUser.delete(); }
        catch { message('#roleCreateFeedback','สร้าง Auth สำเร็จแต่บันทึกสิทธิ์ไม่ผ่าน และไม่สามารถลบบัญชีใหม่อัตโนมัติได้ กรุณาตรวจ Firebase Console',true); }
      }
      message('#roleCreateFeedback','สร้างบัญชีไม่สำเร็จ: ' + humanError(error),true);
      if (window.JOKEMOO_NOTIFY) window.JOKEMOO_NOTIFY('สร้างบัญชีไม่สำเร็จ: ' + humanError(error), 'error');
    } finally {
      if (secondaryApp) {
        try { await secondaryApp.auth().signOut(); } catch {}
        try { await secondaryApp.delete(); } catch {}
      }
      button.disabled = false; button.textContent = 'สร้างบัญชีใหม่';
    }
  });

  function openAccount(member) {
    if (!canManage(member)) return;
    state.selected = member;
    $('#v7TargetUsername').textContent = member.username || 'admin';
    $('#v7TargetUid').textContent = 'UID ' + String(member.id).slice(0, 10) + '…';
    setAvatar($('#v7TargetAvatar'), member.photoURL, member.username);
    roleBadge($('#v7TargetRole'), member.role);
    $('#v7EditRole').value = member.role;
    const canChangeRole = state.role === 'dev';
    $('#v8EditRoleGroup').hidden = !canChangeRole;
    $('#v7SaveRole').hidden = !canChangeRole;
    $('#v7DeleteConfirm').value = '';
    message('#v7AccountFeedback', '');
    accountModal.hidden = false;
  }
  function closeAccount() {
    if (accountModal) accountModal.hidden = true;
    state.selected = null;
  }
  document.querySelectorAll('[data-v7-close]').forEach(el => el.addEventListener('click', closeAccount));
  $('#v7SaveRole')?.addEventListener('click', async () => {
    const member = state.selected;
    const role = $('#v7EditRole').value;
    if (state.role !== 'dev' || !canManage(member) || !(role in roles)) return;
    const button = $('#v7SaveRole'); button.disabled = true;
    try {
      await firestore().collection('admins').doc(member.id).update({ role });
      message('#v7AccountFeedback', 'บันทึกยศใน Firestore แล้ว');
      roleBadge($('#v7TargetRole'), role);
      state.selected = { ...member, role };
      window.JOKEMOO_LOG_ACTION?.('role_changed',String(member.username||member.id),'จาก '+displayRole(member.role)+' เป็น '+displayRole(role));
      window.JOKEMOO_NOTIFY?.('บันทึกยศของ @'+String(member.username)+' สำเร็จ','success');
    } catch (error) { message('#v7AccountFeedback', humanError(error), true); }
    finally { button.disabled = false; }
  });
  $('#v7DeleteAccount')?.addEventListener('click', async () => {
    const member = state.selected;
    if (!canManage(member)) return;
    const input = $('#v7DeleteConfirm').value.trim().toLowerCase();
    if (input !== String(member.username).toLowerCase())
      return message('#v7AccountFeedback', 'กรุณาพิมพ์ Username ให้ตรงก่อนถอนสิทธิ์', true);
    if (!(await window.JOKEMOO_CONFIRM_REVOKE?.(member.username))) return;
    const button = $('#v7DeleteAccount'); button.disabled = true;
    try {
      await firestore().collection('admins').doc(member.id).delete();
      closeAccount();
      setNotice(`ถอนสิทธิ์ ${member.username} แล้ว (บัญชี Auth ยังอยู่)`, true);
      window.JOKEMOO_LOG_ACTION?.('access_removed',String(member.username||member.id));
      window.JOKEMOO_NOTIFY?.('ถอนสิทธิ์ @'+String(member.username)+' สำเร็จ','success');
    } catch (error) { message('#v7AccountFeedback', humanError(error), true); }
    finally { button.disabled = false; }
  });
})();
