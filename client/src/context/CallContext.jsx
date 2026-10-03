import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { getSocket } from '../socket';
import { getToken, getStoredUser } from './auth';
import { getTurnCredentials, getConversations, createConversation } from '../api/client';
import { startKeepAlive } from '../utils/callKeepAlive';

const CallContext = createContext(null);

export function useCall() {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error('useCall must be used inside <CallProvider>');
  return ctx;
}

function formatDuration(totalSeconds) {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
}

// A call is just a live audio mesh between N people — it is NOT tied to any
// single conversation. Each pairwise connection independently knows (or
// doesn't know) about a real 1:1 DM behind it:
//   - The original caller/callee pair: shares the DM the call was started
//     from, exactly as before.
//   - Someone added mid-call: gets a real 1:1 DM with WHOEVER ADDED THEM
//     specifically (find-or-create, same as starting a normal 1:1 call).
//   - Everyone else already on the call: connects to the new person for
//     audio only — no conversation is created or referenced for that pair,
//     ever. Two people who never directly added each other never end up
//     sharing a conversation just because they were on a call together.
//
// idle -> outgoing -> connected -> idle
// idle -> incoming -> connected -> idle
// while connected, more people can be added — still one call session
export function CallProvider({ children }) {
  const [callState, setCallState] = useState('idle');
  const [participants, setParticipants] = useState([]); // [{_id, name, avatarSeed, audioLive, muted}] — everyone but me
  const [muted, setMuted] = useState(false);
  const [startedAt, setStartedAt] = useState(null); // first-ever connection, just for the UI timer
  const [error, setError] = useState('');
  const [audioBlocked, setAudioBlocked] = useState(false);
  // Whether the dedicated full-screen CallScreen is showing (vs minimized to
  // the small persistent bar). Auto-opens the moment a call goes live;
  // separate from callState so minimizing never touches the call itself.
  const [callScreenOpen, setCallScreenOpen] = useState(false);

  // One RTCPeerConnection per other participant — for N people on a call,
  // each client holds N-1 direct connections. This is the "mesh".
  const peersRef = useRef(new Map());
  const audioElsRef = useRef(new Map());
  const localStreamRef = useRef(null);
  const pendingOfferRef = useRef(null);
  const candidateQueueRef = useRef(new Map());
  const connectTimeoutRef = useRef(null);
  const everAnsweredRef = useRef(false);
  const participantsRef = useRef([]);
  useEffect(() => { participantsRef.current = participants; }, [participants]);
  const mutedRef = useRef(false);
  useEffect(() => { mutedRef.current = muted; }, [muted]);

  // peerId -> conversationId | null. null means "audio-only mesh peer, no
  // shared conversation exists or should ever exist for this pair."
  const peerConversationsRef = useRef(new Map());
  // peerId -> ms timestamp when THAT peer's connection actually went live —
  // used for accurate per-peer call duration, since people can join a call
  // at different times.
  const peerConnectedAtRef = useRef(new Map());

  const getAudioEl = (userId) => {
    if (!audioElsRef.current.has(userId)) {
      const el = document.createElement('audio');
      el.autoplay = true;
      el.playsInline = true;
      // Another app taking audio focus (or the page being hidden) makes the
      // browser pause this element. On a live call that means you go deaf, so
      // start it again straight away.
      el.addEventListener('pause', () => {
        if (el.srcObject && audioElsRef.current.get(userId) === el) el.play().catch(() => {});
      });
      document.body.appendChild(el);
      audioElsRef.current.set(userId, el);
    }
    return audioElsRef.current.get(userId);
  };

  const setParticipantLive = (userId, live) => {
    setParticipants((prev) => prev.map((p) => (p._id === userId ? { ...p, audioLive: live } : p)));
  };

  const setParticipantMuted = (userId, isMuted) => {
    setParticipants((prev) => prev.map((p) => (p._id === userId ? { ...p, muted: isMuted } : p)));
  };

  const addParticipant = (user) => {
    setParticipants((prev) => (prev.some((p) => p._id === user._id) ? prev : [...prev, { ...user, audioLive: false, muted: false }]));
  };

  // Logs into MY OWN DM with this one specific peer, if one exists — never
  // a shared/group message. Called only by the side that actively hangs up
  // or declines, so the passive side never double-logs the same event.
  const logCallForPeer = useCallback((peerId, statusOverride) => {
    const convoId = peerConversationsRef.current.get(peerId);
    if (!convoId) return; // no real conversation behind this pairing — nothing to log, ever
    const connectedAt = peerConnectedAtRef.current.get(peerId);
    const status = statusOverride || (connectedAt ? 'answered' : 'missed');
    const duration = status === 'answered' && connectedAt ? Math.round((Date.now() - connectedAt) / 1000) : 0;
    const text = status === 'answered' ? `Voice call · ${formatDuration(duration)}`
      : status === 'declined' ? 'Call declined' : 'Missed call';
    getSocket().emit('message:send', { conversationId: convoId, text, type: 'call', callStatus: status, callDuration: duration });
  }, []);

  const cleanup = useCallback(() => {
    clearTimeout(connectTimeoutRef.current);

    peersRef.current.forEach((pc) => pc.close());
    peersRef.current.clear();
    audioElsRef.current.forEach((el) => { el.srcObject = null; el.remove(); });
    audioElsRef.current.clear();
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    candidateQueueRef.current.clear();
    pendingOfferRef.current = null;
    everAnsweredRef.current = false;
    peerConversationsRef.current.clear();
    peerConnectedAtRef.current.clear();

    setCallState('idle');
    setParticipants([]);
    setStartedAt(null);
    setMuted(false);
    setAudioBlocked(false);
    setError('');
    setCallScreenOpen(false);
  }, []);

  const openCallScreen = useCallback(() => setCallScreenOpen(true), []);
  const minimizeCallScreen = useCallback(() => setCallScreenOpen(false), []);

  const getIceServers = async () => {
    try {
      const creds = await getTurnCredentials(getToken());
      return creds.iceServers;
    } catch {
      return [{ urls: 'stun:stun.l.google.com:19302' }];
    }
  };

  const connectToPeer = useCallback(async (remoteUserId) => {
    if (peersRef.current.has(remoteUserId)) return peersRef.current.get(remoteUserId);

    const iceServers = await getIceServers();
    const pc = new RTCPeerConnection({ iceServers });

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        getSocket().emit('call:ice-candidate', { toUserId: remoteUserId, candidate: e.candidate });
      }
    };
    pc.ontrack = (e) => {
      const el = getAudioEl(remoteUserId);
      el.srcObject = e.streams[0];
      el.play().catch(() => setAudioBlocked(true));
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        everAnsweredRef.current = true;
        // Audio is up: the "never connected" watchdog must not fire anymore.
        clearTimeout(connectTimeoutRef.current);
        if (!peerConnectedAtRef.current.has(remoteUserId)) {
          peerConnectedAtRef.current.set(remoteUserId, Date.now());
        }
        setParticipantLive(remoteUserId, true);
        setStartedAt((prev) => prev ?? Date.now());
        // Late joiners otherwise wouldn't know I'm muted until I next
        // toggle it — tell them my current state as soon as we connect.
        if (mutedRef.current) {
          getSocket().emit('call:mute-changed', { toUserId: remoteUserId, muted: true });
        }
      } else if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        setParticipantLive(remoteUserId, false);
      }
    };

    if (!localStreamRef.current) {
      localStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
    }
    localStreamRef.current.getTracks().forEach((track) => pc.addTrack(track, localStreamRef.current));

    peersRef.current.set(remoteUserId, pc);
    return pc;
  }, []);

  const startCall = useCallback(async (otherUser, convoId) => {
    if (callState !== 'idle') return;
    setError('');
    peerConversationsRef.current.set(otherUser._id, convoId);
    addParticipant(otherUser);
    setCallState('outgoing');
    setCallScreenOpen(true);
    try {
      const pc = await connectToPeer(otherUser._id);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      const me = getStoredUser();
      getSocket().emit('call:invite', {
        toUserId: otherUser._id, conversationId: convoId, offer,
        fromUser: { name: me?.name, avatarSeed: me?.avatarSeed }
      });
    } catch (err) {
      setError(err.message || 'Could not start the call — check microphone permissions.');
      cleanup();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callState, connectToPeer, cleanup]);

  const acceptCall = useCallback(async () => {
    const pending = pendingOfferRef.current;
    if (!pending) return;
    setError('');
    try {
      peerConversationsRef.current.set(pending.fromUserId, pending.conversationId || null);
      const pc = await connectToPeer(pending.fromUserId);
      await pc.setRemoteDescription(new RTCSessionDescription(pending.offer));
      const queued = candidateQueueRef.current.get(pending.fromUserId) || [];
      for (const candidate of queued) await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
      candidateQueueRef.current.delete(pending.fromUserId);

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      getSocket().emit('call:answer', { toUserId: pending.fromUserId, answer });
      setCallState('connected');

      // Mesh-spread to whoever else is already on the call — audio only.
      // No conversationId is ever sent for these: we have no DM with them
      // and none should be created just because we're on a call together.
      // Skip both myself AND whoever actually invited me (pending.fromUserId)
      // — that connection already exists from the accept above, with its
      // real conversationId already set correctly; redundantly "joining"
      // them again here would stomp that mapping with null.
      for (const other of pending.callParticipants || []) {
        if (other._id === getStoredUser()?.id || other._id === pending.fromUserId) continue;
        if (peersRef.current.has(other._id)) continue;
        addParticipant(other);
        peerConversationsRef.current.set(other._id, null);
        const otherPc = await connectToPeer(other._id);
        const offer = await otherPc.createOffer();
        await otherPc.setLocalDescription(offer);
        getSocket().emit('call:invite', { toUserId: other._id, offer });
      }
    } catch (err) {
      setError(err.message || 'Could not answer — check microphone permissions.');
      cleanup();
    }
  }, [connectToPeer, cleanup]);

  // Anyone currently on the call can add someone new — not just whoever
  // started it. Adding them creates (or reuses) a normal 1:1 DM between
  // ME and the new person specifically — never touching anyone else's
  // conversations.
  const addToCall = useCallback(async (newUser) => {
    if (callState !== 'connected' || peersRef.current.has(newUser._id)) return;
    const existingIds = Array.from(peersRef.current.keys());
    addParticipant(newUser);

    let dmConversationId = null;
    try {
      const convo = await createConversation(getToken(), newUser._id);
      dmConversationId = convo._id;
    } catch (err) {
      setError(`Added to the call, but couldn't open a chat with them: ${err.message}`);
    }
    peerConversationsRef.current.set(newUser._id, dmConversationId);

    const pc = await connectToPeer(newUser._id);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    const me = getStoredUser();
    const callParticipants = [
      ...existingIds.map((id) => participantsRef.current.find((p) => p._id === id)).filter(Boolean),
      { _id: me?.id, name: me?.name, avatarSeed: me?.avatarSeed }
    ];
    getSocket().emit('call:invite', {
      toUserId: newUser._id, conversationId: dmConversationId, offer, callParticipants,
      fromUser: { name: me?.name, avatarSeed: me?.avatarSeed }
    });

    // Let every other existing participant know, so they can recognize the
    // newcomer's direct offer as part of THIS call rather than an unrelated
    // one — no conversationId involved, this is purely a heads-up.
    existingIds.forEach((id) => {
      getSocket().emit('call:peer-joined', { toUserId: id, newUser });
    });
  }, [callState, connectToPeer]);

  const declineCall = useCallback(() => {
    const pending = pendingOfferRef.current;
    if (pending) {
      getSocket().emit('call:decline', { toUserId: pending.fromUserId });
      if (pending.conversationId) {
        getSocket().emit('message:send', {
          conversationId: pending.conversationId, text: 'Call declined',
          type: 'call', callStatus: 'declined', callDuration: 0
        });
      }
    }
    cleanup();
  }, [cleanup]);

  const endCall = useCallback(() => {
    Array.from(peersRef.current.keys()).forEach((peerId) => {
      getSocket().emit('call:end', { toUserId: peerId });
      logCallForPeer(peerId);
    });
    cleanup();
  }, [cleanup, logCallForPeer]);

  const toggleMute = useCallback(() => {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    const nowMuted = !track.enabled;
    setMuted(nowMuted);
    // WebRTC never tells the other side your mic got disabled — they'd just
    // hear silence with no explanation — so broadcast it explicitly to
    // everyone currently in the mesh.
    Array.from(peersRef.current.keys()).forEach((peerId) => {
      getSocket().emit('call:mute-changed', { toUserId: peerId, muted: nowMuted });
    });
  }, []);

  const retryAudioPlayback = useCallback(() => {
    let anyBlocked = false;
    audioElsRef.current.forEach((el) => {
      el.play().catch(() => { anyBlocked = true; });
    });
    setAudioBlocked(anyBlocked);
  }, []);

  useEffect(() => {
    const socket = getSocket();

    const onIncoming = async ({ fromUserId, fromUser, conversationId: cid, offer, callParticipants }) => {
      // Recognize a mesh-join (someone I already know is on my current
      // call, connecting to me directly) by participant awareness, not by
      // conversationId — most mesh pairs share no conversationId at all.
      const joiningMyOwnCall = callState === 'connected' && participantsRef.current.some((p) => p._id === fromUserId);

      if (callState !== 'idle' && !joiningMyOwnCall) {
        socket.emit('call:decline', { toUserId: fromUserId });
        return;
      }

      if (joiningMyOwnCall) {
        try {
          // Never overwrite an existing mapping — if we already have a real
          // conversationId for this peer (e.g. we're the one who added
          // them), a redundant/duplicate invite must not stomp it to null.
          if (!peerConversationsRef.current.has(fromUserId)) {
            peerConversationsRef.current.set(fromUserId, cid || null);
          }
          const pc = await connectToPeer(fromUserId);
          await pc.setRemoteDescription(new RTCSessionDescription(offer));
          const queued = candidateQueueRef.current.get(fromUserId) || [];
          for (const candidate of queued) await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
          candidateQueueRef.current.delete(fromUserId);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit('call:answer', { toUserId: fromUserId, answer });
          if (fromUser?.name) addParticipant({ _id: fromUserId, name: fromUser.name, avatarSeed: fromUser.avatarSeed || 'fox' });
        } catch {
          // If this silent mesh-join fails, don't blow up the whole call —
          // just skip connecting to this one extra peer.
        }
        return;
      }

      pendingOfferRef.current = { fromUserId, conversationId: cid, offer, callParticipants };
      setCallState('incoming');
      setCallScreenOpen(true);

      if (fromUser?.name) {
        addParticipant({ _id: fromUserId, name: fromUser.name, avatarSeed: fromUser.avatarSeed || 'fox' });
        return;
      }
      try {
        const conversations = await getConversations(getToken());
        const convo = conversations.find((c) => c._id === cid);
        const caller = convo?.participants.find((p) => p._id === fromUserId);
        addParticipant(caller || { _id: fromUserId, name: 'Someone', avatarSeed: 'fox' });
      } catch {
        addParticipant({ _id: fromUserId, name: 'Someone', avatarSeed: 'fox' });
      }
    };

    const onAnswered = async ({ fromUserId, answer }) => {
      const pc = peersRef.current.get(fromUserId);
      if (!pc) return;
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
      const queued = candidateQueueRef.current.get(fromUserId) || [];
      for (const candidate of queued) await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
      candidateQueueRef.current.delete(fromUserId);
      setCallState('connected');
    };

    const onIceCandidate = ({ fromUserId, candidate }) => {
      const pc = peersRef.current.get(fromUserId);
      if (pc && pc.remoteDescription) {
        pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
      } else {
        const list = candidateQueueRef.current.get(fromUserId) || [];
        list.push(candidate);
        candidateQueueRef.current.set(fromUserId, list);
      }
    };

    const onPeerJoined = ({ newUser }) => {
      if (callState !== 'connected' || peersRef.current.has(newUser._id)) return;
      addParticipant(newUser);
      // No conversationId set here — we'll only learn it (or that there
      // isn't one) once their actual offer arrives via onIncoming.
    };

    const onDeclined = ({ fromUserId }) => {
      // The decliner already logged "Call declined" into their own shared
      // conversation with the caller, if one exists — we don't log again.
      if (participantsRef.current.length <= 1) {
        cleanup();
      } else {
        peersRef.current.get(fromUserId)?.close();
        peersRef.current.delete(fromUserId);
        peerConversationsRef.current.delete(fromUserId);
        peerConnectedAtRef.current.delete(fromUserId);
        setParticipants((prev) => prev.filter((p) => p._id !== fromUserId));
      }
    };

    const onEnded = ({ fromUserId }) => {
      // Passive side: the peer who hung up already logged their own
      // message into whatever conversation we share (if any) — we just
      // tear down our side of that one connection, no logging here.
      peersRef.current.get(fromUserId)?.close();
      peersRef.current.delete(fromUserId);
      peerConversationsRef.current.delete(fromUserId);
      peerConnectedAtRef.current.delete(fromUserId);
      audioElsRef.current.get(fromUserId)?.remove();
      audioElsRef.current.delete(fromUserId);
      setParticipants((prev) => {
        const next = prev.filter((p) => p._id !== fromUserId);
        if (next.length === 0) setTimeout(() => cleanup(), 0);
        return next;
      });
    };

    const onMuteChanged = ({ fromUserId, muted: isMuted }) => {
      setParticipantMuted(fromUserId, isMuted);
    };

    socket.on('call:incoming', onIncoming);
    socket.on('call:answered', onAnswered);
    socket.on('call:ice-candidate', onIceCandidate);
    socket.on('call:peer-joined', onPeerJoined);
    socket.on('call:declined', onDeclined);
    socket.on('call:ended', onEnded);
    socket.on('call:mute-changed', onMuteChanged);

    return () => {
      socket.off('call:incoming', onIncoming);
      socket.off('call:answered', onAnswered);
      socket.off('call:ice-candidate', onIceCandidate);
      socket.off('call:peer-joined', onPeerJoined);
      socket.off('call:declined', onDeclined);
      socket.off('call:ended', onEnded);
      socket.off('call:mute-changed', onMuteChanged);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callState, cleanup, connectToPeer]);

  useEffect(() => {
    if (callState === 'connected' && !everAnsweredRef.current) {
      connectTimeoutRef.current = setTimeout(() => {
        // Re-check now: audio may have connected after this timer was armed.
        // (Before, the timer ignored that and ended every call at ~15s.)
        if (everAnsweredRef.current) return;
        setError('No audio connection could be established — likely a network/TURN server issue. Ending the call.');
        setTimeout(() => endCall(), 2500);
      }, 20000);
      return () => clearTimeout(connectTimeoutRef.current);
    }
  }, [callState, endCall]);

  // Keep the call alive when the app is backgrounded (see utils/callKeepAlive.js).
  const keepAliveRef = useRef(null);
  useEffect(() => {
    if (callState !== 'connected') return undefined;
    const keepAlive = startKeepAlive({
      getLocalStream: () => localStreamRef.current,
      setLocalStream: (stream) => { localStreamRef.current = stream; },
      getPeers: () => peersRef.current,
      getAudioEls: () => audioElsRef.current,
      isMuted: () => mutedRef.current,
      onAudioBlocked: () => setAudioBlocked(true),
      onHangup: () => endCall(),
      onToggleMute: () => toggleMute(),
      ensureSocket: () => { const sock = getSocket(); if (!sock.connected) sock.connect(); }
    });
    keepAliveRef.current = keepAlive;
    return () => { keepAlive.stop(); keepAliveRef.current = null; };
  }, [callState, endCall, toggleMute]);

  // Title shown in the OS call notification.
  useEffect(() => {
    if (callState !== 'connected' || participants.length === 0) return;
    const names = participants.map((p) => p.name).join(', ');
    keepAliveRef.current?.setCallTitle(`Call with ${names}`);
  }, [callState, participants]);

  return (
    <CallContext.Provider value={{
      callState, participants, muted, startedAt, error, audioBlocked,
      callScreenOpen, openCallScreen, minimizeCallScreen,
      startCall, acceptCall, declineCall, endCall, toggleMute, retryAudioPlayback, addToCall
    }}>
      {children}
    </CallContext.Provider>
  );
}
