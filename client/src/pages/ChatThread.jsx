import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useParams, useOutletContext, Link } from 'react-router-dom';
import { ArrowLeft, ArrowUp, Info, Phone, PhoneOff, PhoneMissed } from 'lucide-react';
import Avatar from '../components/Avatar';
import { getToken, getStoredUser } from '../context/auth';
import { getMessages } from '../api/client';
import { getSocket } from '../socket';
import { clockTime, dayLabel, sameDay } from '../utils/time';
import { markSeen } from '../utils/seen';
import { useCall } from '../context/CallContext';
import './ChatThread.css';

const GROUP_GAP_MS = 5 * 60 * 1000; // messages further apart than this start a new cluster

const gapOf = (a, b) => Math.abs(new Date(b.createdAt) - new Date(a.createdAt));

function formatDuration(secs) {
  return secs >= 60 ? `${Math.floor(secs / 60)}m ${secs % 60}s` : `${secs}s`;
}

export default function ChatThread() {
  const { id: conversationId } = useParams();
  const { conversations, loadingList, markRead } = useOutletContext();
  const me = getStoredUser();
  const { startCall, callState, participants: callPeers } = useCall();

  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState('');
  const [typingUserIds, setTypingUserIds] = useState([]);

  const listRef = useRef(null);
  const inputRef = useRef(null);
  const stickToBottom = useRef(true);
  const firstLoad = useRef(true);
  const sendingRef = useRef(false);
  const typingTimeout = useRef(null);

  const convo = useMemo(() => conversations.find((c) => c._id === conversationId), [conversations, conversationId]);
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

  // Load history + subscribe whenever the open conversation changes.
  useEffect(() => {
    let cancelled = false;
    setMessages([]);
    setLoading(true);
    setError('');
    setDraft('');
    setTypingUserIds([]);
    firstLoad.current = true;
    stickToBottom.current = true;

    getMessages(getToken(), conversationId)
      .then((history) => !cancelled && setMessages(history))
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));

    const socket = getSocket();
    const onNewMessage = (msg) => {
      if (msg.conversation !== conversationId) return;
      setMessages((prev) => (prev.some((m) => (m._id || m.id) === msg.id) ? prev : [...prev, msg]));
      setTypingUserIds((prev) => prev.filter((id) => id !== msg.sender));
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
      clearTimeout(typingTimeout.current);
      socket.off('message:new', onNewMessage);
      socket.off('typing:start', onTypingStart);
      socket.off('typing:stop', onTypingStop);
    };
  }, [conversationId]);

  // Opening a chat (or receiving into it while open) clears its unread state.
  useEffect(() => {
    if (!convo) return;
    markSeen(conversationId, convo.lastMessageAt);
    markRead();
  }, [conversationId, convo?.lastMessageAt, markRead]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!loading && convo) inputRef.current?.focus({ preventScroll: true });
  }, [loading, conversationId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Scrolling: jump instantly on first load; afterwards follow new messages
  // only if you're already near the bottom (or you just sent one).
  const onScroll = () => {
    const el = listRef.current;
    if (el) stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 140;
  };
  useLayoutEffect(() => {
    const el = listRef.current;
    if (!el || loading) return;
    if (firstLoad.current) {
      el.scrollTop = el.scrollHeight;
      firstLoad.current = false;
      return;
    }
    const last = messages[messages.length - 1];
    if (stickToBottom.current || last?.sender === me?.id) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, typingUserIds.length, loading]); // eslint-disable-line react-hooks/exhaustive-deps

  // Render model: day separators + clustered messages.
  const items = useMemo(() => {
    const out = [];
    let prev = null;
    messages.forEach((msg, i) => {
      if (!prev || !sameDay(prev.createdAt, msg.createdAt)) {
        out.push({ kind: 'day', key: `day-${msg.createdAt}`, label: dayLabel(msg.createdAt) });
      }
      if (msg.type === 'call') {
        out.push({ kind: 'call', key: msg._id || msg.id, msg });
        prev = msg;
        return;
      }
      const next = messages[i + 1];
      const startsGroup = !prev || prev.type === 'call' || prev.sender !== msg.sender
        || !sameDay(prev.createdAt, msg.createdAt) || gapOf(prev, msg) > GROUP_GAP_MS;
      const endsGroup = !next || next.type === 'call' || next.sender !== msg.sender
        || !sameDay(msg.createdAt, next.createdAt) || gapOf(msg, next) > GROUP_GAP_MS;
      out.push({ kind: 'msg', key: msg._id || msg.id, msg, startsGroup, endsGroup });
      prev = msg;
    });
    return out;
  }, [messages]);

  // The server relays typing to one person per call, so groups fan out client-side.
  const notifyTyping = (starting) => {
    if (!convo) return;
    const socket = getSocket();
    convo.participants
      .filter((p) => p._id !== me?.id)
      .forEach((p) => socket.emit(starting ? 'typing:start' : 'typing:stop', { conversationId, toUserId: p._id }));
  };

  const resizeInput = () => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  };

  const handleDraftChange = (e) => {
    setDraft(e.target.value);
    resizeInput();
    notifyTyping(true);
    clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => notifyTyping(false), 1200);
  };

  const handleSend = (e) => {
    e?.preventDefault();
    const text = draft.trim();
    if (!text || sendingRef.current) return;

    sendingRef.current = true;
    clearTimeout(typingTimeout.current);
    notifyTyping(false);
    setDraft('');
    requestAnimationFrame(resizeInput);
    setError('');

    getSocket().emit('message:send', { conversationId, text }, (ack) => {
      sendingRef.current = false;
      if (ack?.error) {
        setError(ack.error);
        setDraft(text); // give the message back instead of silently losing it
      }
    });
    inputRef.current?.focus();
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSend();
    }
  };

  if (loadingList || (!convo && !error)) {
    return <div className="state thread-state">Loading conversation…</div>;
  }

  if (!convo) {
    return (
      <div className="state thread-state">
        <p>Conversation not found.</p>
        <Link to="/chat" className="btn btn--outline btn--sm" style={{ marginTop: 12 }}>
          <ArrowLeft size={14} /> Back to chats
        </Link>
      </div>
    );
  }

  const headerName = isGroup ? convo.name : otherUser.name;
  const headerAvatar = isGroup ? convo.avatarSeed : otherUser.avatarSeed;
  const typingNames = typingUserIds.map((id) => participantsById[id]?.name?.split(' ')[0]).filter(Boolean);
  const alreadyOnCall = !isGroup && callState === 'connected' && callPeers.some((p) => p._id === otherUser._id);

  let statusLine;
  if (typingNames.length > 0) {
    statusLine = <span className="thread__typing">{typingNames.join(', ')} typing…</span>;
  } else if (isGroup) {
    statusLine = <span>{convo.participants.length} members</span>;
  } else {
    statusLine = (
      <>
        <span className={otherUser.isOnline ? 'thread__online' : ''}>
          {otherUser.isOnline && <span className="dot" />} {otherUser.isOnline ? 'Online' : 'Offline'}
        </span>
        {otherUser.status && <em className="thread__note">{otherUser.status}</em>}
      </>
    );
  }

  const headerIdentity = (
    <>
      <Avatar seed={headerAvatar} size={44} online={!isGroup && otherUser.isOnline} />
      <div className="thread__who">
        <span className="thread__name">{headerName}</span>
        <span className="thread__status">{statusLine}</span>
      </div>
    </>
  );

  return (
    <div className="thread">
      <header className="thread__header">
        <Link to="/chat" className="icon-btn thread__back" aria-label="Back to chats"><ArrowLeft size={20} /></Link>

        {isGroup ? (
          <Link to={`/chat/${conversationId}/details`} className="thread__identity thread__identity--link">{headerIdentity}</Link>
        ) : (
          <div className="thread__identity">{headerIdentity}</div>
        )}

        <div className="thread__actions">
          {!isGroup && (alreadyOnCall ? (
            <span className="btn btn--sage btn--sm thread__oncall"><Phone size={15} /> On call</span>
          ) : (
            <button
              className="btn btn--primary btn--sm"
              title={`Call ${otherUser.name}`}
              disabled={callState !== 'idle'}
              onClick={() => startCall(otherUser, conversationId)}
            >
              <Phone size={15} /> <span className="thread__call-label">Call</span>
            </button>
          ))}
          {isGroup && (
            <Link to={`/chat/${conversationId}/details`} className="icon-btn" title="Group info" aria-label="Group info">
              <Info size={20} />
            </Link>
          )}
        </div>
      </header>

      <div className="thread__messages" ref={listRef} onScroll={onScroll}>
        {loading && (
          <div className="thread__loading">
            <div className="skeleton" style={{ width: '46%', height: 42, borderRadius: 20 }} />
            <div className="skeleton" style={{ width: '32%', height: 42, borderRadius: 20, alignSelf: 'flex-end' }} />
            <div className="skeleton" style={{ width: '54%', height: 42, borderRadius: 20 }} />
          </div>
        )}

        {!loading && messages.length === 0 && (
          <div className="thread__empty">
            <Avatar seed={headerAvatar} size={72} />
            <h2>{isGroup ? `Welcome to ${convo.name}` : `Say hello to ${otherUser.name.split(' ')[0]}`}</h2>
            <p>This is the start of your conversation.</p>
          </div>
        )}

        {items.map((item) => {
          if (item.kind === 'day') {
            return <div key={item.key} className="thread__day"><span>{item.label}</span></div>;
          }

          if (item.kind === 'call') {
            const { msg } = item;
            const answered = msg.callStatus === 'answered';
            const declined = msg.callStatus === 'declined';
            const title = answered ? 'Voice call ended' : declined ? 'Call declined' : 'Missed call';
            const sub = answered && msg.callDuration
              ? `${formatDuration(msg.callDuration)} · ${clockTime(msg.createdAt)}`
              : clockTime(msg.createdAt);
            return (
              <div key={item.key} className="call-log">
                <span className={`call-log__icon${answered ? '' : ' call-log__icon--bad'}`}>
                  {answered ? <Phone size={16} /> : declined ? <PhoneOff size={16} /> : <PhoneMissed size={16} />}
                </span>
                <div className="call-log__body">
                  <span className="call-log__title">{title}</span>
                  <span className="call-log__sub">{sub}</span>
                </div>
                {!isGroup && (
                  <button
                    className="btn btn--soft btn--sm"
                    disabled={callState !== 'idle'}
                    onClick={() => startCall(otherUser, conversationId)}
                  >
                    Call back
                  </button>
                )}
              </div>
            );
          }

          const { msg, startsGroup, endsGroup } = item;
          const mine = msg.sender === me?.id;
          const sender = participantsById[msg.sender];
          return (
            <div
              key={item.key}
              className={`msg${mine ? ' msg--mine' : ''}${startsGroup ? ' msg--first' : ''}${endsGroup ? ' msg--last' : ''}`}
            >
              {isGroup && !mine && (
                <span className="msg__avatar">{endsGroup && sender && <Avatar seed={sender.avatarSeed} size={28} />}</span>
              )}
              <div className="msg__col">
                {isGroup && !mine && startsGroup && sender && <span className="msg__sender">{sender.name}</span>}
                <div className="msg__bubble">{msg.text}</div>
                {endsGroup && <span className="msg__time">{clockTime(msg.createdAt)}</span>}
              </div>
            </div>
          );
        })}

        {typingNames.length > 0 && (
          <div className="msg msg--typing msg--last">
            {isGroup && <span className="msg__avatar" />}
            <div className="msg__col">
              <div className="msg__bubble msg__bubble--typing"><span /><span /><span /></div>
            </div>
          </div>
        )}
      </div>

      {error && <div className="notice thread__error">{error}</div>}

      <div className="thread__composer-wrap">
        <form className="composer" onSubmit={handleSend}>
          <textarea
            ref={inputRef}
            rows={1}
            value={draft}
            onChange={handleDraftChange}
            onKeyDown={onKeyDown}
            placeholder={`Message ${headerName}…`}
            aria-label="Message"
          />
          <button type="submit" className="composer__send" disabled={!draft.trim()} aria-label="Send message">
            <ArrowUp size={20} strokeWidth={2.4} />
          </button>
        </form>
        <p className="composer__hint">Enter to send · Shift+Enter for a new line</p>
      </div>
    </div>
  );
}
