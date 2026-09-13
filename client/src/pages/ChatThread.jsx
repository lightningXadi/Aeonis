import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import AppShell from '../components/AppShell';
import Avatar from '../components/Avatar';
import { getToken, isLoggedIn, getStoredUser } from '../context/auth';
import { getConversations, getMessages, getConversationDetails } from '../api/client';
import { getSocket } from '../socket';
import { relativeTime } from '../utils/time';
import { useCall } from '../context/CallContext';
import './ChatThread.css';

export default function ChatThread() {
  const { id: conversationId } = useParams();
  const navigate = useNavigate();
  const me = getStoredUser();
  const { startCall, callState } = useCall();

  const [convo, setConvo] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [typingUserIds, setTypingUserIds] = useState([]); // group-aware: could be more than one person

  const bottomRef = useRef(null);
  const typingTimeout = useRef(null);

  const isGroup = convo?.isGroup;
  const otherUser = useMemo(
    () => (convo && !isGroup ? convo.participants.find((p) => p._id !== me?.id) || convo.participants[0] : null),
    [convo, isGroup, me?.id]
  );
  const participantsById = useMemo(() => {
    const map = {};
    convo?.participants.forEach((p) => { map[p._id] = p; });
    return map;
  }, [convo]);

  useEffect(() => {
    if (!isLoggedIn()) {
      navigate('/', { replace: true });
      return;
    }

    const token = getToken();
    let cancelled = false;

    Promise.all([getConversations(token), getMessages(token, conversationId)])
      .then(([conversations, history]) => {
        if (cancelled) return;
        const found = conversations.find((c) => c._id === conversationId);
        if (!found) {
          setError('Conversation not found.');
          return;
        }
        setConvo(found);
        setMessages(history);
      })
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));

    const socket = getSocket();

    const onNewMessage = (msg) => {
      if (msg.conversation !== conversationId) return;
      setMessages((prev) => [...prev, msg]);
      setTypingUserIds((prev) => prev.filter((id) => id !== msg.sender));

      // A call-log message can mean the conversation itself just changed
      // shape (a 1:1 auto-upgrading into a group because someone was added
      // to the call) — refetch so the header/participant list catch up
      // live instead of only updating after a manual reload.
      if (msg.type === 'call') {
        getConversationDetails(getToken(), conversationId).then(setConvo).catch(() => {});
      }
    };
    const onTypingStart = ({ conversationId: cid, fromUserId }) => {
      if (cid !== conversationId || !fromUserId) return;
      setTypingUserIds((prev) => (prev.includes(fromUserId) ? prev : [...prev, fromUserId]));
    };
    const onTypingStop = ({ conversationId: cid, fromUserId }) => {
      if (cid !== conversationId) return;
      setTypingUserIds((prev) => prev.filter((id) => id !== fromUserId));
    };

    socket.on('message:new', onNewMessage);
    socket.on('typing:start', onTypingStart);
    socket.on('typing:stop', onTypingStop);

    return () => {
      cancelled = true;
      socket.off('message:new', onNewMessage);
      socket.off('typing:start', onTypingStart);
      socket.off('typing:stop', onTypingStop);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, navigate]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingUserIds]);

  // Works for both 1:1 and groups: the server only relays typing to one
  // person per call, so for a group we just call it once per other member —
  // no backend change needed for this to work.
  const notifyTyping = (starting) => {
    if (!convo) return;
    const socket = getSocket();
    const others = convo.participants.filter((p) => p._id !== me?.id);
    others.forEach((p) => {
      socket.emit(starting ? 'typing:start' : 'typing:stop', {
        conversationId,
        toUserId: p._id
      });
    });
  };

  const handleDraftChange = (e) => {
    setDraft(e.target.value);
    notifyTyping(true);
    clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => notifyTyping(false), 1200);
  };

  const handleSend = (e) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text || sending) return;

    setSending(true);
    clearTimeout(typingTimeout.current);
    notifyTyping(false);

    getSocket().emit('message:send', { conversationId, text }, (ack) => {
      setSending(false);
      if (ack?.error) {
        setError(ack.error);
        return;
      }
      setDraft('');
    });
  };

  if (loading) {
    return (
      <AppShell>
        <div className="thread-page__state">Loading conversation…</div>
      </AppShell>
    );
  }

  if (error && !convo) {
    return (
      <AppShell>
        <div className="thread-page__state thread-page__state--error">
          {error} <Link to="/chat">← Back to chats</Link>
        </div>
      </AppShell>
    );
  }

  const headerName = isGroup ? convo.name : otherUser.name;
  const headerAvatarSeed = isGroup ? convo.avatarSeed : otherUser.avatarSeed;
  const typingNames = typingUserIds.map((id) => participantsById[id]?.name?.split(' ')[0]).filter(Boolean);
  const headerSub = typingNames.length > 0
    ? `${typingNames.join(', ')} typing…`
    : isGroup
      ? `${convo.participants.length} members`
      : (otherUser.isOnline ? 'Online' : (otherUser.status || 'Offline'));

  return (
    <AppShell>
      <div className="thread-page">
        <header className="thread-page__header">
          <Link to="/chat" className="thread-page__back">←</Link>
          {isGroup ? (
            <Link to={`/chat/${conversationId}/details`} className="thread-page__header-clickable">
              <Avatar seed={headerAvatarSeed} size={38} />
              <div className="thread-page__header-body">
                <span className="thread-page__name">{headerName}</span>
                <span className="thread-page__status">{headerSub}</span>
              </div>
            </Link>
          ) : (
            <>
              <Avatar seed={headerAvatarSeed} size={38} online={otherUser.isOnline} />
              <div className="thread-page__header-body">
                <span className="thread-page__name">{headerName}</span>
                <span className="thread-page__status">{headerSub}</span>
              </div>
              <button
                className="thread-page__call-btn"
                title={`Call ${otherUser.name}`}
                disabled={callState !== 'idle'}
                onClick={() => startCall(otherUser, conversationId)}
              >
                📞
              </button>
            </>
          )}
        </header>

        <div className="thread-page__messages">
          {messages.length === 0 && (
            <div className="thread-page__empty">
              {isGroup ? `Say hello to ${convo.name} 👋` : `Say hello to ${otherUser.name.split(' ')[0]} 👋`}
            </div>
          )}
          {messages.map((msg) => {
            const mine = msg.sender === me?.id;
            const sender = participantsById[msg.sender];

            if (msg.type === 'call') {
              return (
                <div key={msg._id || msg.id} className="thread-call-log">
                  <span className="thread-call-log__icon">
                    {msg.callStatus === 'answered' ? '📞' : msg.callStatus === 'declined' ? '🚫' : '📵'}
                  </span>
                  <span className="thread-call-log__text">{msg.text}</span>
                  <span className="thread-call-log__time">{relativeTime(msg.createdAt)}</span>
                </div>
              );
            }

            return (
              <div key={msg._id || msg.id} className={`thread-msg${mine ? ' thread-msg--mine' : ''}`}>
                {isGroup && !mine && sender && (
                  <span className="thread-msg__sender">{sender.name}</span>
                )}
                <div className="thread-msg__bubble">{msg.text}</div>
                <span className="thread-msg__time">{relativeTime(msg.createdAt)}</span>
              </div>
            );
          })}
          {typingNames.length > 0 && (
            <div className="thread-msg thread-msg--typing">
              <div className="thread-msg__bubble thread-msg__bubble--typing">
                <span /><span /><span />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {error && <div className="thread-page__error">{error}</div>}

        <form className="thread-page__composer" onSubmit={handleSend}>
          <input
            value={draft}
            onChange={handleDraftChange}
            placeholder="Type a message…"
            disabled={sending}
          />
          <button type="submit" disabled={!draft.trim() || sending}>Send</button>
        </form>
      </div>
    </AppShell>
  );
}
