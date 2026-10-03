import { useCall } from '../context/CallContext';
import Avatar from './Avatar';
import CallScreen from './CallScreen';
import './CallOverlay.css';
import { Phone, PhoneOff } from 'lucide-react';

export default function CallOverlay() {
  const {
    callState, participants, error,
    acceptCall, declineCall, endCall,
    callScreenOpen
  } = useCall();

  if (callState === 'idle' || participants.length === 0) return null;

  const primary = participants[0];

  // Ringing states stay full-screen — this needs the person's full attention,
  // there's no minimized form of "someone is calling you right now".
  if (callState === 'outgoing' || callState === 'incoming') {
    return (
      <div className="call-overlay">
        <div className="call-overlay__content">
          <div className="call-overlay__avatar">
            <span className="call-overlay__ring" />
            <span className="call-overlay__ring call-overlay__ring--2" />
            <Avatar seed={primary.avatarSeed} size={124} />
          </div>
          <h2 className="call-overlay__name">{primary.name}</h2>
          <p className="call-overlay__status">
            {callState === 'outgoing' ? 'Calling…' : 'Incoming call…'}
          </p>
          {error && <p className="call-overlay__error">{error}</p>}
          <div className="call-overlay__controls">
            {callState === 'incoming' && (
              <>
                <div className="call-action">
                  <button className="call-btn call-btn--decline" onClick={declineCall} aria-label="Decline"><PhoneOff size={26} /></button>
                  <span>Decline</span>
                </div>
                <div className="call-action">
                  <button className="call-btn call-btn--accept" onClick={acceptCall} aria-label="Accept"><Phone size={26} /></button>
                  <span>Accept</span>
                </div>
              </>
            )}
            {callState === 'outgoing' && (
              <div className="call-action">
                <button className="call-btn call-btn--decline" onClick={endCall} aria-label="Cancel call"><PhoneOff size={26} /></button>
                <span>Cancel</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Connected + full screen open — the dedicated CallScreen with everyone's
  // live status and controls.
  if (callScreenOpen) {
    return <CallScreen />;
  }

  // Connected + minimized — nothing to render here anymore. AppShell's nav
  // circle is the only "minimized" representation of an active call now.
  return null;
}
