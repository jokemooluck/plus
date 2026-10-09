(() => {
  'use strict';

  document.documentElement.style.touchAction = 'pan-x pan-y';

  window.addEventListener('touchmove', event => {
    if (event.touches.length > 1) event.preventDefault();
  }, { passive: false });

  for (const eventName of ['gesturestart', 'gesturechange', 'gestureend']) {
    window.addEventListener(eventName, event => event.preventDefault(), { passive: false });
  }

  window.addEventListener('wheel', event => {
    if (event.ctrlKey || event.metaKey) event.preventDefault();
  }, { passive: false });

  window.addEventListener('keydown', event => {
    if (!(event.ctrlKey || event.metaKey)) return;
    if (['+', '-', '=', '0'].includes(event.key) || ['NumpadAdd', 'NumpadSubtract'].includes(event.code)) {
      event.preventDefault();
    }
  }, true);
})();