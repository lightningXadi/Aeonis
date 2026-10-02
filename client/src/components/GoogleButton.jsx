import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { googleLogin } from '../api/client';
import { setSession } from '../context/auth';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const GSI_SRC = 'https://accounts.google.com/gsi/client';

let gsiPromise = null;
/** Load Google's sign-in script once for the whole app. */
function loadGoogleScript() {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (gsiPromise) return gsiPromise;
  gsiPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = GSI_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => { gsiPromise = null; reject(new Error('load')); };
    document.head.appendChild(s);
  });
  return gsiPromise;
}

/**
 * "Continue with Google". Google renders the button itself (their rules), we
 * receive an ID token and swap it for an Aeonis session via POST /auth/google.
 * That one endpoint handles both sign-in and sign-up: a new Google user gets
 * an account created automatically.
 *
 * Needs VITE_GOOGLE_CLIENT_ID (same value as GOOGLE_CLIENT_ID on the server).
 */
export default function GoogleButton({ text = 'continue_with', onError }) {
  const navigate = useNavigate();
  const holder = useRef(null);
  const [state, setState] = useState(CLIENT_ID ? 'loading' : 'missing'); // loading | ready | failed | missing
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!CLIENT_ID) return undefined;
    let cancelled = false;

    loadGoogleScript()
      .then(() => {
        if (cancelled || !holder.current) return;
        window.google.accounts.id.initialize({
          client_id: CLIENT_ID,
          callback: async ({ credential }) => {
            setBusy(true);
            onError?.('');
            try {
              const { token, user } = await googleLogin(credential);
              setSession(token, user);
              navigate('/chat', { replace: true });
            } catch (err) {
              onError?.(err.message);
              setBusy(false);
            }
          }
        });
        // Google draws the button at a fixed pixel width (200–400).
        const width = Math.min(400, Math.max(200, Math.round(holder.current.offsetWidth || 320)));
        window.google.accounts.id.renderButton(holder.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          shape: 'pill',
          text,
          logo_alignment: 'center',
          width
        });
        setState('ready');
      })
      .catch(() => {
        if (cancelled) return;
        setState('failed');
        onError?.('Couldn’t load Google sign-in. Check your connection or disable any ad blocker, then try again.');
      });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  if (state === 'missing') {
    return (
      <button type="button" className="auth-google-btn" disabled title="Google sign-in isn’t configured (VITE_GOOGLE_CLIENT_ID missing)">
        Continue with Google <span className="pill">Not set up</span>
      </button>
    );
  }

  return (
    <div className={`auth-google${busy ? ' auth-google--busy' : ''}`} aria-busy={busy}>
      <div ref={holder} className="auth-google__slot" />
      {state === 'loading' && <div className="auth-google__placeholder">Loading Google…</div>}
      {busy && <div className="auth-google__overlay">Signing you in…</div>}
    </div>
  );
}
