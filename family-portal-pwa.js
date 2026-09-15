(() => {
  'use strict';

  let deferredPrompt = null;
  const installButton = document.getElementById('installAppButton');
  if (!installButton) return;

  installButton.hidden = true;

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    deferredPrompt = event;
    installButton.hidden = false;
  });

  installButton.addEventListener('click', async () => {
    if (!deferredPrompt) {
      installButton.title = 'Open this portal in Chrome or Edge over HTTPS or localhost to install it.';
      return;
    }

    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    installButton.hidden = true;
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    installButton.hidden = true;
  });

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/service-worker.js', { scope: '/' }).catch(error => {
        console.warn('Family portal service worker registration failed:', error);
      });
    });
  }
})();
