import { useEffect, useRef, useState } from 'react';
import { useCall } from '../context/CallContext';
import { getStoredUser } from '../context/auth';
import Avatar from './Avatar';
import AddToCallPanel from './AddToCallPanel';
import { ChevronDown, Volume2, Mic, MicOff, Plus, X } from 'lucide-react';
import './CallScreen.css';

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

// How far down (px) a swipe has to travel before it counts as "minimize".
const SWIPE_THRESHOLD = 90;

export default function CallScreen() {
  const {
    participants, muted, startedAt, error, audioBlocked,
    endCall, toggleMute, addToCall, minimizeCallScreen, retryAudioPlayback
  } = useCall();
  const me = getStoredUser();
  const duration = useElapsed(startedAt);
  const [showAddPanel, setShowAddPanel] = useState(false);

  const dragStartY = useRef(null);
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);

  const statusFor = (p) => {
    if (!p.audioLive) return 'Connecting…';
    if (p.muted) return 'Muted';
    return 'Connected';
  };

  const handlePointerDown = (e) => {
    dragStartY.current = e.clientY;
    setDragging(true);
  };
  const handlePointerMove = (e) => {
    if (dragStartY.current == null) return;
    const delta = e.clientY - dragStartY.current;
    setDragY(Math.max(0, delta));
  };
  const handlePointerUp = () => {
    if (dragY > SWIPE_THRESHOLD) {
      minimizeCallScreen();
    }
    setDragY(0);
    setDragging(false);
    dragStartY.current = null;
  };

  return (
    <div
      className="call-screen"
      style={{
        transform: dragY ? `translateY(${dragY}px)` : undefined,
        transition: dragging ? 'none' : 'transform 0.2s ease'
      }}
    >
      <div
        className="call-screen__drag-handle"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        title="Drag down to minimize"
      >
        <span className="call-screen__drag-bar" />
      </div>

      <div className="call-screen__header">
        <span className="call-screen__duration">{startedAt ? duration : 'Connecting…'}</span>
        <button className="call-screen__minimize-btn" onClick={minimizeCallScreen} title="Minimize">
          <ChevronDown size={20} />
        </button>
      </div>

      {error && <div className="call-screen__error">{error}</div>}
      {audioBlocked && (
        <button className="call-screen__audio-blocked" onClick={retryAudioPlayback}>
          <Volume2 size={16} /> Tap to enable audio
        </button>
      )}

      <div className="call-screen__people">
        <div className="call-screen__person call-screen__person--me">
          <Avatar seed={me?.avatarSeed || 'fox'} size={84} />
          <span className="call-screen__person-name">You</span>
          <span className="call-screen__person-status">{muted ? 'Muted' : 'Connected'}</span>
        </div>

        {participants.map((p) => (
          <div className="call-screen__person" key={p._id}>
            <Avatar seed={p.avatarSeed} size={84} />
            <span className="call-screen__person-name">{p.name}</span>
            <span className={`call-screen__person-status${!p.audioLive ? ' call-screen__person-status--pending' : ''}`}>
              {statusFor(p)}
            </span>
          </div>
        ))}
      </div>

      <div className="call-screen__controls">
        <div className="call-action">
          <button
            className={`call-screen__ctrl-btn${muted ? ' call-screen__ctrl-btn--active' : ''}`}
            onClick={toggleMute}
            aria-label={muted ? 'Unmute' : 'Mute'}
            aria-pressed={muted}
          >
            {muted ? <MicOff size={22} /> : <Mic size={22} />}
          </button>
          <span>{muted ? 'Unmute' : 'Mute'}</span>
        </div>
        <div className="call-action">
          <button className="call-screen__ctrl-btn" onClick={() => setShowAddPanel(true)} aria-label="Add someone">
            <Plus size={22} />
          </button>
          <span>Add</span>
        </div>
        <div className="call-action">
          <button className="call-screen__ctrl-btn call-screen__ctrl-btn--end" onClick={endCall} aria-label="End call">
            <X size={22} />
          </button>
          <span>End</span>
        </div>
      </div>

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
