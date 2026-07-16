(() => {
  const installButton = document.getElementById("installAppBtn");
  const splash = document.getElementById("pwaSplash");
  let deferredPrompt = null;

  // Splash screen hide on load.
  function hideSplash() {
    if (!splash) return;
    splash.style.opacity = "0";
    splash.style.visibility = "hidden";
  }

  window.addEventListener("load", () => {
    setTimeout(hideSplash, 300);
  });

  // Register service worker in production-safe way.
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", async () => {
      try {
        const registration = await navigator.serviceWorker.register("/service-worker.js", {
          scope: "/"
        });

        registration.update().catch(() => {});
      } catch (error) {
        console.error("Service worker registration failed:", error);
      }
    });
  }

  // Install app flow.
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event;
    if (installButton) {
      installButton.hidden = false;
    }
  });

  if (installButton) {
    installButton.addEventListener("click", async () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      try {
        await deferredPrompt.userChoice;
      } finally {
        deferredPrompt = null;
        installButton.hidden = true;
      }
    });
  }

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    if (installButton) {
      installButton.hidden = true;
    }
  });
})();