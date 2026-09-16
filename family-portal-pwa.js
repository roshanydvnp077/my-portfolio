(() => {
  'use strict';

  let deferredPrompt = null;
  const installButton = document.getElementById('installAppButton');
  if (!installButton) return;

  const showInstallButton = () => {
    if (window.matchMedia('(display-mode: standalone)').matches) {
      installButton.hidden = true;
      return;
    }
    installButton.hidden = false;
    installButton.title = 'Install Family Portal';
  };

  const hideInstallButton = () => {
    installButton.hidden = true;
    installButton.title = 'Install Family Portal';
  };

  const syncInstallVisibility = async () => {
    if (window.matchMedia('(display-mode: standalone)').matches) {
      hideInstallButton();
      return;
    }

    const client = window.supabaseClient;
    if (!client || !client.auth) {
      hideInstallButton();
      return;
    }

    try {
      const { data: { session } } = await client.auth.getSession();
      if (session) {
        showInstallButton();
      } else {
        hideInstallButton();
      }
    } catch (error) {
      console.warn('Could not determine family portal auth state:', error);
      hideInstallButton();
    }
  };

  installButton.hidden = true;

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    deferredPrompt = event;
    showInstallButton();
  });

  installButton.addEventListener('click', async () => {
    if (!deferredPrompt) {
      installButton.title = 'Open this portal in Chrome or Edge over HTTPS or localhost to install it.';
      showInstallButton();
      return;
    }

    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    hideInstallButton();
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    hideInstallButton();
  });

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/service-worker.js', { scope: '/' }).catch(error => {
        console.warn('Family portal service worker registration failed:', error);
      });
    });
  }

  void syncInstallVisibility();
  if (window.supabaseClient && window.supabaseClient.auth) {
    window.supabaseClient.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
        void syncInstallVisibility();
      }
    });
  }
})();
