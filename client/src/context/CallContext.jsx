import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { getSocket } from '../socket';
import { getToken, getStoredUser } from './auth';
import { getTurnCredentials, getConversations, addGroupMember } from '../api/client';

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

// idle -> outgoing -> connected -> idle
// idle -> incoming -> connected -> idle
// while connected, more people can be added — still one call session
export function CallProvider({ children }) {
  const [callState, setCallState] = useState('idle');
  const [conversationId, setConversationId] = useState(null);
  const [participants, setParticipants] = useState([]); // [{_id, name, avatarSeed, audioLive}] — everyone but me
  const [muted, setMuted] = useState(false);
  const [startedAt, setStartedAt] = useState(null);
  const [error, setError] = useState('');
  const [audioBlocked, setAudioBlocked] = useState(false);

  // One RTCPeerConnection per other participant — for N people on a call,
  // each client holds N-1 direct connections. This is the "mesh".
  const peersRef = useRef(new Map());
  const audioElsRef = useRef(new Map());
  const localStreamRef = useRef(null);
  const pendingOfferRef = useRef(null);
  const candidateQueueRef = useRef(new Map());
  const connectTimeoutRef = useRef(null);
  const everAnsweredRef = useRef(false);
  const loggedRef = useRef(false);
  const participantsRef = useRef([]);
  useEffect(() => { participantsRef.current = participants; }, [participants]);

  const getAudioEl = (userId) => {
    if (!audioElsRef.current.has(userId)) {
      const el = document.createElement('audio');
      el.autoplay = true;
      el.playsInline = true;
      document.body.appendChild(el);
      audioElsRef.current.set(userId, el);
    }
    return audioElsRef.current.get(userId);
  };

  const setParticipantLive = (userId, live) => {
    setParticipants((prev) => prev.map((p) => (p._id === userId ? { ...p, audioLive: live } : p)));
  };

  const addParticipant = (user) => {
    setParticipants((prev) => (prev.some((p) => p._id === user._id) ? prev : [...prev, { ...user, audioLive: false }]));
  };

  const logCallMessage = useCallback((status, convoId, startTime, participantCount) => {
    if (loggedRef.current || !convoId) return;
    loggedRef.current = true;
    const duration = startTime ? Math.round((Date.now() - startTime) / 1000) : 0;
    const text = status === 'answered'
      ? (participantCount > 1
          ? `Group call · ${participantCount + 1} people · ${formatDuration(duration)}`
          : `Voice call · ${formatDuration(duration)}`)
      : status === 'declined' ? 'Call declined' : 'Missed call';
    getSocket().emit('message:send', { conversationId: convoId, text, type: 'call', callStatus: status, callDuration: duration });
  }, []);

  const cleanup = useCallback((logStatus) => {
    clearTimeout(connectTimeoutRef.current);
    if (logStatus) logCallMessage(logStatus, conversationId, startedAt, participantsRef.current.length);

    peersRef.current.forEach((pc) => pc.close());
    peersRef.current.clear();
    audioElsRef.current.forEach((el) => { el.srcObject = null; el.remove(); });
    audioElsRef.current.clear();
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    candidateQueueRef.current.clear();
    pendingOfferRef.current = null;
    everAnsweredRef.current = false;
    loggedRef.current = false;

    setCallState('idle');
    setParticipants([]);
    setConversationId(null);
    setStartedAt(null);
    setMuted(false);
    setAudioBlocked(false);
    setError('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, startedAt, logCallMessage]);

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
        setParticipantLive(remoteUserId, true);
        setStartedAt((prev) => prev ?? Date.now());
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
    setConversationId(convoId);
    addParticipant(otherUser);
    setCallState('outgoing');
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
      const pc = await connectToPeer(pending.fromUserId);
      await pc.setRemoteDescription(new RTCSessionDescription(pending.offer));
      const queued = candidateQueueRef.current.get(pending.fromUserId) || [];
      for (const candidate of queued) await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
      candidateQueueRef.current.delete(pending.fromUserId);

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      getSocket().emit('call:answer', { toUserId: pending.fromUserId, answer });
      setCallState('connected');

      for (const other of pending.callParticipants || []) {
        if (other._id === getStoredUser()?.id) continue;
        addParticipant(other);
        const otherPc = await connectToPeer(other._id);
        const offer = await otherPc.createOffer();
        await otherPc.setLocalDescription(offer);
        getSocket().emit('call:invite', { toUserId: other._id, conversationId: pending.conversationId, offer });
      }
    } catch (err) {
      setError(err.message || 'Could not answer — check microphone permissions.');
      cleanup();
    }
  }, [connectToPeer, cleanup]);

  const addToCall = useCallback(async (newUser) => {
    if (callState !== 'connected' || peersRef.current.has(newUser._id)) return;
    const existingIds = Array.from(peersRef.current.keys());
    addParticipant(newUser);

    // Persist this on the actual conversation too — not just the live audio
    // mesh — so the new person gets real chat history and everyone sees the
    // eventual call-log message, not just the two original participants.
    // A 1:1 conversation auto-upgrades into a real group the first time
    // this happens (handled server-side).
    try {
      await addGroupMember(getToken(), conversationId, newUser._id);
    } catch (err) {
      setError(`Added to the call, but couldn't add them to the chat: ${err.message}`);
    }

    const pc = await connectToPeer(newUser._id);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    const me = getStoredUser();
    const callParticipants = [
      ...existingIds.map((id) => participantsRef.current.find((p) => p._id === id)).filter(Boolean),
      { _id: me?.id, name: me?.name, avatarSeed: me?.avatarSeed }
    ];
    getSocket().emit('call:invite', {
      toUserId: newUser._id, conversationId, offer, callParticipants,
      fromUser: { name: me?.name, avatarSeed: me?.avatarSeed }
    });

    existingIds.forEach((id) => {
      getSocket().emit('call:peer-joined', { toUserId: id, newUser });
    });
  }, [callState, conversationId, connectToPeer]);

  const declineCall = useCallback(() => {
    const pending = pendingOfferRef.current;
    if (pending) getSocket().emit('call:decline', { toUserId: pending.fromUserId });
    cleanup('declined');
  }, [cleanup]);

  const endCall = useCallback(() => {
    peersRef.current.forEach((_pc, userId) => getSocket().emit('call:end', { toUserId: userId }));
    cleanup(everAnsweredRef.current ? 'answered' : 'missed');
  }, [cleanup]);

  const toggleMute = useCallback(() => {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setMuted(!track.enabled);
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
      const joiningMyOwnCall = callState === 'connected' && cid === conversationId;

      if (callState !== 'idle' && !joiningMyOwnCall) {
        // Genuinely busy with an unrelated call — decline.
        socket.emit('call:decline', { toUserId: fromUserId });
        return;
      }

      if (joiningMyOwnCall) {
        // This is a mesh peer connecting directly as part of the call
        // we're already on (someone got added) — accept silently, no ring.
        try {
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
      setConversationId(cid);
      setCallState('incoming');

      // The caller sends their own name/avatar directly in the invite, so
      // this doesn't depend on the callee sharing a conversation with them
      // (which isn't true for someone being added mid-call).
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
      // The newcomer will send us their own offer shortly (per addToCall) —
      // nothing to send here, this just gets them into the UI right away.
    };

    const onDeclined = ({ fromUserId }) => {
      if (participantsRef.current.length <= 1) {
        cleanup('declined');
      } else {
        peersRef.current.get(fromUserId)?.close();
        peersRef.current.delete(fromUserId);
        setParticipants((prev) => prev.filter((p) => p._id !== fromUserId));
      }
    };

    const onEnded = ({ fromUserId }) => {
      peersRef.current.get(fromUserId)?.close();
      peersRef.current.delete(fromUserId);
      audioElsRef.current.get(fromUserId)?.remove();
      audioElsRef.current.delete(fromUserId);
      setParticipants((prev) => {
        const next = prev.filter((p) => p._id !== fromUserId);
        if (next.length === 0) {
          setTimeout(() => cleanup(everAnsweredRef.current ? 'answered' : 'missed'), 0);
        }
        return next;
      });
    };

    socket.on('call:incoming', onIncoming);
    socket.on('call:answered', onAnswered);
    socket.on('call:ice-candidate', onIceCandidate);
    socket.on('call:peer-joined', onPeerJoined);
    socket.on('call:declined', onDeclined);
    socket.on('call:ended', onEnded);

    return () => {
      socket.off('call:incoming', onIncoming);
      socket.off('call:answered', onAnswered);
      socket.off('call:ice-candidate', onIceCandidate);
      socket.off('call:peer-joined', onPeerJoined);
      socket.off('call:declined', onDeclined);
      socket.off('call:ended', onEnded);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callState, cleanup]);

  useEffect(() => {
    if (callState === 'connected' && !everAnsweredRef.current) {
      connectTimeoutRef.current = setTimeout(() => {
        setError('No audio connection could be established — likely a network/TURN server issue. Ending the call.');
        setTimeout(() => endCall(), 2500);
      }, 15000);
      return () => clearTimeout(connectTimeoutRef.current);
    }
  }, [callState, endCall]);

  return (
    <CallContext.Provider value={{
      callState, conversationId, participants, muted, startedAt, error, audioBlocked,
      startCall, acceptCall, declineCall, endCall, toggleMute, retryAudioPlayback, addToCall
    }}>
      {children}
    </CallContext.Provider>
  );
}
