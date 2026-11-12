/* Admin password management: uses Firebase Authentication directly.
 * No passwords are written to Firestore, localStorage or site-config.js.
 * An account may change ONLY its own password after reauthentication.
 */
(() => {
  'use strict';

  const $ = (selector) => document.querySelector(selector);
  const changeForm = $('#changePasswordForm');
  if (!changeForm) return;

  const changeButton = $('#changePasswordBtn');
  const feedback = $('#securityFeedback');
  const accountName = $('#securityAccountName');

  function notify(node, message, error = false) {
    node.textContent = message;
    node.classList.toggle('is-error', error);
    node.classList.toggle('is-success', !error && Boolean(message));
  }
  function authInstance() {
    try { return window.firebase?.apps?.length ? firebase.auth() : null; }
    catch { return null; }
  }
  function describeError(error) {
    switch (error?.code) {
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
      case 'auth/invalid-login-credentials':
        return 'รหัสผ่านปัจจุบันไม่ถูกต้อง';
      case 'auth/weak-password': return 'รหัสผ่านใหม่ยังไม่ปลอดภัย กรุณาใช้รหัสที่ยาวขึ้น';
      case 'auth/requires-recent-login': return 'เซสชันหมดอายุ กรุณาออกจากระบบแล้วเข้าสู่ระบบใหม่';
      case 'auth/too-many-requests': return 'มีการลองหลายครั้งเกินไป กรุณาลองใหม่ภายหลัง';
      case 'auth/network-request-failed': return 'การเชื่อมต่ออินเทอร์เน็ตมีปัญหา กรุณาลองใหม่';
      case 'auth/operation-not-allowed': return 'Firebase Authentication ยังไม่เปิดใช้งานวิธีนี้';
      case 'auth/invalid-email': return 'รูปแบบอีเมลไม่ถูกต้อง';
      default: return 'ดำเนินการไม่สำเร็จ กรุณาลองใหม่อีกครั้ง';
    }
  }

  function refreshUser() {
    const user = authInstance()?.currentUser;
    accountName.textContent = user?.email ? user.email.split('@')[0] : 'ยังไม่ได้เข้าสู่ระบบ';
  }
  const authReady = () => {
    const auth = authInstance();
    if (auth) auth.onAuthStateChanged(refreshUser);
    else refreshUser();
  };
  authReady();

  changeForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const auth = authInstance();
    const user = auth?.currentUser;
    if (!user || !user.email) {
      notify(feedback, 'กรุณาเข้าสู่ระบบอีกครั้งก่อนเปลี่ยนรหัสผ่าน', true);
      return;
    }
    const oldPassword = $('#currentAdminPassword').value;
    const nextPassword = $('#newAdminPassword').value;
    const confirmation = $('#confirmAdminPassword').value;
    if (nextPassword.length < 8 || nextPassword.length > 128) {
      notify(feedback, 'รหัสผ่านใหม่ต้องมี 8–128 ตัวอักษร', true);
      return;
    }
    if (nextPassword !== confirmation) {
      notify(feedback, 'รหัสผ่านใหม่และช่องยืนยันไม่ตรงกัน', true);
      return;
    }
    if (oldPassword === nextPassword) {
      notify(feedback, 'กรุณาตั้งรหัสผ่านใหม่ที่ไม่ซ้ำรหัสเดิม', true);
      return;
    }

    changeButton.disabled = true;
    changeButton.textContent = 'กำลังเปลี่ยนรหัสผ่าน...';
    notify(feedback, 'กำลังตรวจสอบรหัสผ่านเดิมและบันทึกรหัสใหม่');
    try {
      const credential = firebase.auth.EmailAuthProvider.credential(user.email, oldPassword);
      await user.reauthenticateWithCredential(credential);
      await user.updatePassword(nextPassword);
      changeForm.reset();
      notify(feedback, 'เปลี่ยนรหัสผ่านสำเร็จ ใช้รหัสใหม่ในการเข้าสู่ระบบครั้งถัดไป');
    } catch (error) {
      notify(feedback, describeError(error), true);
    } finally {
      changeButton.disabled = false;
      changeButton.textContent = 'เปลี่ยนรหัสผ่าน';
    }
  });

})();
