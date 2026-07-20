(() => {
  const installButton = document.getElementById("installAppBtn");
  const heroInstallButton = document.getElementById("heroInstallBtn");
  const splash = document.getElementById("pwaSplash");
  const modalBackdrop = document.getElementById("pwaModalBackdrop");
  const modalClose = document.getElementById("pwaModalClose");
  const modalInstall = document.getElementById("pwaInstallAction");
  const modalDismiss = document.getElementById("pwaDismissAction");
  let deferredPrompt = null;

  function hideSplash() {
    if (!splash) return;
    splash.style.opacity = "0";
    splash.style.visibility = "hidden";
  }

  function openPwaModal() {
    if (!modalBackdrop) return;
    modalBackdrop.classList.add("is-open");
    modalBackdrop.setAttribute("aria-hidden", "false");
  }

  function closePwaModal() {
    if (!modalBackdrop) return;
    modalBackdrop.classList.remove("is-open");
    modalBackdrop.setAttribute("aria-hidden", "true");
    try {
      localStorage.setItem("pwaModalDismissed", "true");
    } catch (error) {
      console.warn("Could not save install modal state:", error);
    }
  }

  const fallbackNote = document.getElementById("pwaFallbackNote");

  async function handleInstallClick() {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      try {
        await deferredPrompt.userChoice;
      } finally {
        deferredPrompt = null;
        if (installButton) {
          installButton.hidden = true;
        }
        closePwaModal();
      }
      return;
    }

    if (fallbackNote) {
      fallbackNote.classList.add("visible");
      fallbackNote.textContent = "Installation is not available right now. Please view this site over HTTPS or on localhost to see the native PWA install prompt.";
    }
  }

  window.addEventListener("load", () => {
    setTimeout(() => {
      hideSplash();
      try {
        const dismissed = localStorage.getItem("pwaModalDismissed") === "true";
        if (!dismissed) {
          openPwaModal();
        }
      } catch (error) {
        openPwaModal();
      }
    }, 600);
  });

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

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event;
    if (installButton) {
      installButton.hidden = false;
    }
    openPwaModal();
  });

  if (installButton) {
    installButton.addEventListener("click", handleInstallClick);
  }

  if (heroInstallButton) {
    heroInstallButton.addEventListener("click", openPwaModal);
  }

  if (modalInstall) {
    modalInstall.addEventListener("click", handleInstallClick);
  }

  if (modalDismiss) {
    modalDismiss.addEventListener("click", closePwaModal);
  }

  if (modalClose) {
    modalClose.addEventListener("click", closePwaModal);
  }

  if (modalBackdrop) {
    modalBackdrop.addEventListener("click", (event) => {
      if (event.target === modalBackdrop) {
        closePwaModal();
      }
    });
  }

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    if (installButton) {
      installButton.hidden = true;
    }
    closePwaModal();
  });
})();