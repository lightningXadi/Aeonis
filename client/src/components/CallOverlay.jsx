import { useEffect, useState } from 'react';
import { useCall } from '../context/CallContext';
import Avatar from './Avatar';
import AddToCallPanel from './AddToCallPanel';
import './CallOverlay.css';

function useElapsed(startedAt) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!startedAt) return;
    setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => clearInterval(id);
  }, [startedAt]);
  const mins = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const secs = String(elapsed % 60).padStart(2, '0');
  return `${mins}:${secs}`;
}

export default function CallOverlay() {
  const {
    callState, participants, muted, startedAt, error, audioBlocked,
    acceptCall, declineCall, endCall, toggleMute, addToCall
  } = useCall();
  const duration = useElapsed(startedAt);
  const [showAddPanel, setShowAddPanel] = useState(false);

  if (callState === 'idle' || participants.length === 0) return null;

  const primary = participants[0];
  const extraCount = participants.length - 1;
  const anyLive = participants.some((p) => p.audioLive);

  // Ringing states stay full-screen — this needs the person's full attention.
  if (callState === 'outgoing' || callState === 'incoming') {
    return (
      <div className="call-overlay">
        <div className="call-overlay__content">
          <Avatar seed={primary.avatarSeed} size={110} />
          <h2 className="call-overlay__name">{primary.name}</h2>
          <p className="call-overlay__status">
            {callState === 'outgoing' ? 'Calling…' : 'Incoming call…'}
          </p>
          {error && <p className="call-overlay__error">{error}</p>}
          <div className="call-overlay__controls">
            {callState === 'incoming' && (
              <>
                <button className="call-btn call-btn--decline" onClick={declineCall} title="Decline">✕</button>
                <button className="call-btn call-btn--accept" onClick={acceptCall} title="Accept">✓</button>
              </>
            )}
            {callState === 'outgoing' && (
              <button className="call-btn call-btn--decline" onClick={endCall} title="Cancel">✕</button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Connected — a slim bar that stays out of the way so the rest of the
  // app is still usable while the call continues in the background.
  return (
    <div className="call-bar">
      <div className="call-bar__avatars">
        <Avatar seed={primary.avatarSeed} size={34} />
        {extraCount > 0 && <span className="call-bar__extra">+{extraCount}</span>}
      </div>
      <div className="call-bar__info">
        <span className="call-bar__name">
          {primary.name}{extraCount > 0 ? ` +${extraCount} more` : ''}
        </span>
        <span className="call-bar__status">{anyLive ? duration : 'Connecting audio…'}</span>
      </div>

      {audioBlocked && (
        <button className="call-bar__btn call-bar__btn--warn" onClick={() => window.location.reload()} title="Audio blocked — click to retry">
          🔊
        </button>
      )}

      <button className="call-bar__btn" onClick={() => setShowAddPanel(true)} title="Add someone to this call">
        ＋
      </button>
      <button
        className={`call-bar__btn${muted ? ' call-bar__btn--active' : ''}`}
        onClick={toggleMute}
        title={muted ? 'Unmute' : 'Mute'}
      >
        {muted ? '🔇' : '🎙️'}
      </button>
      <button className="call-bar__btn call-bar__btn--end" onClick={endCall} title="End call">✕</button>

      {error && <div className="call-bar__error">{error}</div>}

      {showAddPanel && (
        <AddToCallPanel
          existingIds={participants.map((p) => p._id)}
          onAdd={(user) => { addToCall(user); setShowAddPanel(false); }}
          onClose={() => setShowAddPanel(false)}
        />
      )}
    </div>
  );
}
