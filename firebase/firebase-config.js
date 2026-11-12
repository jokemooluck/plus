/* Compatibility adapter: edit site-config.js at the project root instead. */
(function () {
  "use strict";
  if (!window.JOKEMOO_SITE_CONFIG || !window.JOKEMOO_SITE_CONFIG.firebase) {
    console.error("Missing site-config.js: Firebase configuration is unavailable.");
    return;
  }
  window.JOKEMOO_FIREBASE_CONFIG = window.JOKEMOO_SITE_CONFIG.firebase;
  window.JOKEMOO_ROOT_USERNAME = window.JOKEMOO_SITE_CONFIG.admin.rootUsername;
  window.JOKEMOO_ROOT_EMAIL = window.JOKEMOO_SITE_CONFIG.admin.rootEmail;
})();
