/**
 * Keeps a live voice call working while the app/tab is in the background.
 *
 * A website can't run in the background the way a native app can, so we do
 * everything the browser allows to stop it from treating the call as idle:
 *
 *  1. Media Session  – tells the OS "this is an ongoing call" (shows a call
 *                      notification with Hang up / Mic buttons on Android).
 *  2. Screen Wake Lock – stops the screen auto-locking mid-call.
 *  3. Audio recovery – browsers/OSes pause remote audio when another app takes
 *                      audio focus; we resume it right away.
 *  4. Mic recovery   – if the browser cuts the microphone while hidden, we get
 *                      it back and hot-swap it into every connection, so the
 *                      other person can hear you again without redialling.
 *  5. Socket recovery – make sure signalling reconnects after returning.
 *
 * Every API is feature-detected: on a browser that lacks one, that part is
 * skipped and the call itself is unaffected.
 */
export function startKeepAlive({
  getLocalStream,        // () => MediaStream | null
  setLocalStream,        // (MediaStream) => void
  getPeers,              // () => Map<userId, RTCPeerConnection>
  getAudioEls,           // () => Map<userId, HTMLAudioElement>
  isMuted,               // () => boolean
  onAudioBlocked,        // () => void   – autoplay was refused, ask for a tap
  onHangup,              // () => void
  onToggleMute,          // () => void
  ensureSocket,          // () => void
  intervalMs = 4000
}) {
  let wakeLock = null;
  let stopped = false;
  let recovering = false;

  // ---- 2. Wake lock (released by the browser whenever the page is hidden,
  //         so it must be re-requested when we become visible again) ----
  const acquireWakeLock = async () => {
    try {
      if (stopped || wakeLock || !('wakeLock' in navigator)) return;
      if (document.visibilityState !== 'visible') return;
      const lock = await navigator.wakeLock.request('screen');
      if (stopped) { lock.release().catch(() => {}); return; }
      wakeLock = lock;
      lock.addEventListener('release', () => { if (wakeLock === lock) wakeLock = null; });
    } catch { /* unsupported or denied — fine */ }
  };

  // ---- 3. Resume remote audio the browser paused ----
  const resumeAudio = () => {
    getAudioEls().forEach((el) => {
      if (el.srcObject && el.paused) {
        el.play().catch(() => onAudioBlocked?.());
      }
    });
  };

  // ---- 4. Get the mic back if the browser killed it ----
  const recoverMic = async () => {
    const stream = getLocalStream();
    const track = stream?.getAudioTracks()[0];
    if (!track || track.readyState !== 'ended') return;
    try {
      const fresh = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (stopped) { fresh.getTracks().forEach((t) => t.stop()); return; }
      const newTrack = fresh.getAudioTracks()[0];
      newTrack.enabled = !isMuted();              // keep the user's mute choice
      getPeers().forEach((pc) => {
        pc.getSenders().forEach((sender) => {
          if (sender.track && sender.track.kind === 'audio') sender.replaceTrack(newTrack).catch(() => {});
        });
      });
      stream.getTracks().forEach((t) => t.stop());
      setLocalStream(fresh);
    } catch { /* mic still unavailable (e.g. still hidden) — retry next tick */ }
  };

  const recover = async () => {
    if (stopped || recovering) return;
    recovering = true;
    try {
      resumeAudio();
      await recoverMic();
      ensureSocket?.();
    } finally {
      recovering = false;
    }
  };

  const onVisibilityChange = () => {
    if (document.visibilityState === 'visible') acquireWakeLock();
    recover();
  };

  // ---- 1. Media Session ----
  const ms = 'mediaSession' in navigator ? navigator.mediaSession : null;
  const setAction = (name, handler) => { try { ms?.setActionHandler(name, handler); } catch { /* action unsupported */ } };
  if (ms) {
    try { ms.playbackState = 'playing'; } catch { /* ignore */ }
    setAction('hangup', () => onHangup?.());
    setAction('togglemicrophone', () => onToggleMute?.());
  }

  document.addEventListener('visibilitychange', onVisibilityChange);
  window.addEventListener('pageshow', onVisibilityChange);
  window.addEventListener('online', recover);
  // Safety net while hidden (timers are throttled, but a call keeps them alive).
  const timer = setInterval(recover, intervalMs);
  acquireWakeLock();

  return {
    /** Shown in the OS call notification, e.g. "Call with Rowan". */
    setCallTitle(title) {
      if (!ms || typeof MediaMetadata === 'undefined') return;
      try {
        ms.metadata = new MediaMetadata({
          title,
          artist: 'Aeris',
          artwork: [
            { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' }
          ]
        });
      } catch { /* ignore */ }
    },
    stop() {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pageshow', onVisibilityChange);
      window.removeEventListener('online', recover);
      if (wakeLock) { wakeLock.release().catch(() => {}); wakeLock = null; }
      if (ms) {
        setAction('hangup', null);
        setAction('togglemicrophone', null);
        try { ms.playbackState = 'none'; ms.metadata = null; } catch { /* ignore */ }
      }
    }
  };
}
