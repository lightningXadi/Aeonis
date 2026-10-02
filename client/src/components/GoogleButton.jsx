import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { googleLogin } from '../api/client';
import { setSession } from '../context/auth';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const GSI_SRC = 'https://accounts.google.com/gsi/client';
const GSI_BUTTON_HEIGHT = 40; // Google's "large" button is fixed at 40px tall
const FACE_HEIGHT = 48;       // our button is 48px tall, same as "Re-enter Aeonis"

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

function GoogleG() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

/**
 * "Continue with Google", styled to match the rest of Aeonis.
 *
 * How it works: Google only issues a login token through ITS OWN button (an
 * iframe we can't restyle). So we draw our own pill-shaped button (the "face")
 * and lay Google's real button on top of it, invisible and stretched to cover
 * the whole face. You see the Aeonis button; your click lands on Google's one.
 * The result is the same token, same POST /auth/google, same server — only the
 * look changes.
 *
 * Needs VITE_GOOGLE_CLIENT_ID (same value as GOOGLE_CLIENT_ID on the server).
 */
export default function GoogleButton({ label = 'Continue with Google', onError }) {
  const navigate = useNavigate();
  const holder = useRef(null);
  const [state, setState] = useState(CLIENT_ID ? 'loading' : 'missing'); // loading | ready | failed | missing
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!CLIENT_ID) return undefined;
    let cancelled = false;
    setState('loading');

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
        holder.current.innerHTML = '';
        const width = Math.min(400, Math.max(200, Math.round(holder.current.offsetWidth || 320)));
        window.google.accounts.id.renderButton(holder.current, {
          type: 'standard', theme: 'outline', size: 'large', shape: 'rectangular', width
        });
        setState('ready');
      })
      .catch(() => {
        if (cancelled) return;
        setState('failed');
        onError?.('Couldn’t load Google sign-in. Check your connection or disable any ad blocker, then tap the button to try again.');
      });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  if (state === 'missing') {
    return (
      <button type="button" className="auth-google-btn" disabled title="Google sign-in isn’t configured (VITE_GOOGLE_CLIENT_ID missing)">
        {label} <span className="pill">Not set up</span>
      </button>
    );
  }

  const face = (
    <>
      <GoogleG />
      <span>{state === 'loading' ? 'Loading Google…' : label}</span>
    </>
  );

  // Script failed to load: the face becomes a plain retry button.
  if (state === 'failed') {
    return (
      <div className="auth-google">
        <button type="button" className="auth-google__face" onClick={() => setAttempt((a) => a + 1)}>{face}</button>
      </div>
    );
  }

  return (
    <div className={`auth-google${state === 'loading' ? ' auth-google--loading' : ''}${busy ? ' auth-google--busy' : ''}`} aria-busy={busy || state === 'loading'}>
      <div className="auth-google__face" aria-hidden="true">{face}</div>
      {/* Google's real button: invisible, scaled to cover the whole face. */}
      <div className="auth-google__hit">
        <div ref={holder} className="auth-google__slot" style={{ height: GSI_BUTTON_HEIGHT, transform: `scaleY(${FACE_HEIGHT / GSI_BUTTON_HEIGHT})` }} />
      </div>
      {busy && <div className="auth-google__overlay">Signing you in…</div>}
    </div>
  );
}
