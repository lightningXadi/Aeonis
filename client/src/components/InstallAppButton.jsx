import { useState } from 'react';
import useInstallPrompt from '../hooks/useInstallPrompt';
import './InstallAppButton.css';

export default function InstallAppButton() {
  const { isInstallable, isIOS, isStandalone, promptInstall } = useInstallPrompt();
  const [showIOSHint, setShowIOSHint] = useState(false);

  // Already running as an installed app — nothing to offer.
  if (isStandalone) return null;

  // Neither the native prompt nor iOS — most likely desktop Safari/Firefox
  // without install support. Stay silent rather than show a dead button.
  if (!isInstallable && !isIOS) return null;

  return (
    <div className="install-app">
      <button
        className="install-app__btn"
        onClick={() => (isInstallable ? promptInstall() : setShowIOSHint(true))}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Get the App
      </button>

      {showIOSHint && (
        <div className="install-app__hint" role="dialog" onClick={() => setShowIOSHint(false)}>
          <p>
            On iPhone/iPad: tap the <strong>Share</strong> icon in Safari, then
            <strong> "Add to Home Screen"</strong>.
          </p>
        </div>
      )}
    </div>
  );
}
