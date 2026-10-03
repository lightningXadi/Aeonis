import { useEffect, useState } from 'react';

/**
 * Captures the browser's `beforeinstallprompt` event (Chrome/Edge/Android)
 * so we can show our own "Install App" button instead of relying on the
 * browser's default mini-infobar. On iOS Safari this event never fires —
 * there's no programmatic install prompt there, so we separately detect
 * iOS and show "Add to Home Screen" instructions instead.
 */
export default function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    const ua = window.navigator.userAgent || '';
    setIsIOS(/iphone|ipad|ipod/i.test(ua) && !window.MSStream);
    setIsStandalone(
      window.matchMedia?.('(display-mode: standalone)').matches ||
      window.navigator.standalone === true
    );

    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };
    window.addEventListener('beforeinstallprompt', handler);

    const installedHandler = () => {
      setIsInstallable(false);
      setDeferredPrompt(null);
    };
    window.addEventListener('appinstalled', installedHandler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', installedHandler);
    };
  }, []);

  const promptInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    setIsInstallable(false);
  };

  return { isInstallable, isIOS, isStandalone, promptInstall };
}
