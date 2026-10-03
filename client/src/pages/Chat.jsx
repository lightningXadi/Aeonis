import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useMatch, useNavigate } from 'react-router-dom';
import { Search, SquarePen, Users, MessageCircle, UserPlus, Phone } from 'lucide-react';
import AppShell from '../components/AppShell';
import Avatar from '../components/Avatar';
import { relativeTime } from '../utils/time';
import { isUnread, seedSeen } from '../utils/seen';
import { getToken, isLoggedIn, getStoredUser } from '../context/auth';
import { getConversations, getFriends, createConversation } from '../api/client';
import { getSocket } from '../socket';
import { useCall } from '../context/CallContext';
import './Chat.css';

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'direct', label: 'Direct' },
  { id: 'groups', label: 'Groups' }
];

/** Popover: pick a friend to start (or reopen) a 1:1 chat. */
function NewChatMenu({ onClose, onCreated }) {
  const navigate = useNavigate();
  const [friends, setFriends] = useState(null);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    getFriends(getToken()).then(setFriends).catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const start = async (friend) => {
    setBusyId(friend._id);
    try {
      const convo = await createConversation(getToken(), friend._id);
      await onCreated();
      onClose();
      navigate(`/chat/${convo._id}`);
    } catch (e) {
      setError(e.message);
      setBusyId(null);
    }
  };

  return (
    <>
      <div className="new-chat__backdrop" onClick={onClose} />
      <div className="new-chat" role="dialog" aria-label="Start a chat">
        <p className="eyebrow">Start a chat with</p>
        {error && <div className="notice">{error}</div>}
        {!friends && !error && <p className="new-chat__state">Loading friends…</p>}
        {friends && friends.length === 0 && (
          <p className="new-chat__state">You haven’t added anyone yet.</p>
        )}
        <ul className="new-chat__list">
          {friends?.map((f) => (
            <li key={f._id}>
              <button className="new-chat__item" disabled={busyId === f._id} onClick={() => start(f)}>
                <Avatar seed={f.avatarSeed} size={36} online={f.isOnline} />
                <span>{f.name}</span>
              </button>
            </li>
          ))}
        </ul>
        <div className="new-chat__footer">
          <Link to="/friends/add" onClick={onClose}><UserPlus size={15} /> Find people</Link>
          <Link to="/groups/new" onClick={onClose}><Users size={15} /> New group</Link>
        </div>
      </div>
    </>
  );
}

/**
 * Chats screen = conversation list + <Outlet/> for the open thread.
 * Desktop: both panes side by side. Phones: one pane at a time.
 */
export default function Chat() {
  const navigate = useNavigate();
  const me = getStoredUser();
  const match = useMatch('/chat/:id');
  const activeId = match?.params.id;

  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [seenTick, setSeenTick] = useState(0);
  const [, setClock] = useState(0);
  const convosRef = useRef([]);
  convosRef.current = conversations;

  const { callState, participants: callPeers, startedAt } = useCall();

  const load = useCallback(
    () =>
      getConversations(getToken())
        .then((list) => {
          seedSeen(list);
          setConversations(list);
          setError('');
        })
        .catch((err) => setError(err.message))
        .finally(() => setLoading(false)),
    []
  );

  useEffect(() => {
    if (!isLoggedIn()) {
      navigate('/', { replace: true });
      return;
    }
    load();
  }, [navigate, load]);

  // Live updates: new messages bubble a chat to the top; presence dots stay current.
  useEffect(() => {
    const socket = getSocket();
    const onNew = (msg) => {
      if (!convosRef.current.some((c) => c._id === msg.conversation)) {
        load();
        return;
      }
      setConversations((prev) => {
        const idx = prev.findIndex((c) => c._id === msg.conversation);
        if (idx === -1) return prev;
        const updated = { ...prev[idx], lastMessage: msg.text, lastMessageAt: msg.createdAt };
        return [updated, ...prev.filter((_, i) => i !== idx)];
      });
    };
    const onPresence = ({ userId, isOnline }) =>
      setConversations((prev) =>
        prev.map((c) => ({
          ...c,
          participants: c.participants.map((p) => (p._id === userId ? { ...p, isOnline } : p))
        }))
      );
    socket.on('message:new', onNew);
    socket.on('presence:update', onPresence);
    return () => {
      socket.off('message:new', onNew);
      socket.off('presence:update', onPresence);
    };
  }, [load]);

  // Re-render the ongoing-call duration in the list every second.
  useEffect(() => {
    if (callState !== 'connected') return;
    const id = setInterval(() => setClock((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [callState]);

  const markRead = useCallback(() => setSeenTick((t) => t + 1), []);

  const otherParticipant = (convo) =>
    convo.participants.find((p) => p._id !== me?.id) || convo.participants[0];

  const displayInfo = (convo) => {
    if (convo.isGroup) {
      return { name: convo.name, avatarSeed: convo.avatarSeed, online: false, sub: `${convo.participants.length} members` };
    }
    const other = otherParticipant(convo);
    return { name: other.name, avatarSeed: other.avatarSeed, online: other.isOnline, sub: null };
  };

  const callDuration = () => {
    if (!startedAt) return 'Connecting…';
    const secs = Math.floor((Date.now() - startedAt) / 1000);
    return `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`;
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const unreadIds = useMemo(() => new Set(conversations.filter(isUnread).map((c) => c._id)), [conversations, seenTick]);

  const visible = conversations.filter((c) => {
    if (filter === 'direct' && c.isGroup) return false;
    if (filter === 'groups' && !c.isGroup) return false;
    const q = query.trim().toLowerCase();
    return !q || displayInfo(c).name.toLowerCase().includes(q);
  });

  const ctx = { conversations, loadingList: loading, markRead, reload: load };

  return (
    <AppShell fullHeight hideMobileNav={Boolean(activeId)} unreadCount={unreadIds.size}>
      <div className={`chat-layout${activeId ? ' chat-layout--thread' : ''}`}>
        <aside className="chat-sidebar">
          <div className="chat-sidebar__head">
            <div className="chat-sidebar__title">
              <h1>Chats</h1>
              {unreadIds.size > 0 && <span className="pill pill--honey">{unreadIds.size} unread</span>}
            </div>
            <div className="chat-sidebar__actions">
              <Link to="/groups/new" className="icon-btn" title="New group" aria-label="New group"><Users size={19} /></Link>
              <button
                className="icon-btn icon-btn--filled"
                title="New chat"
                aria-label="New chat"
                onClick={() => setNewChatOpen((o) => !o)}
              >
                <SquarePen size={18} />
              </button>
            </div>
            {newChatOpen && <NewChatMenu onClose={() => setNewChatOpen(false)} onCreated={load} />}
          </div>

          <div className="chat-sidebar__tools">
            <div className="search-field">
              <Search size={17} />
              <input
                className="input"
                placeholder="Search chats"
                aria-label="Search chats"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <div className="seg seg--sm" role="tablist">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  role="tab"
                  aria-selected={filter === f.id}
                  className={`seg__item${filter === f.id ? ' seg__item--active' : ''}`}
                  onClick={() => setFilter(f.id)}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="chat-sidebar__scroll">
            {loading && [0, 1, 2, 3, 4].map((i) => (
              <div className="skeleton-row" key={i}>
                <div className="skeleton skeleton--circle" style={{ width: 46, height: 46 }} />
                <div style={{ flex: 1 }}>
                  <div className="skeleton" style={{ width: '45%', height: 12, marginBottom: 8 }} />
                  <div className="skeleton" style={{ width: '75%', height: 10 }} />
                </div>
              </div>
            ))}

            {error && <div className="state state--error">{error}</div>}

            {!loading && !error && conversations.length === 0 && (
              <div className="empty">
                <span className="empty__icon"><MessageCircle size={26} /></span>
                <h2 className="empty__title">No chats yet</h2>
                <p>Start a conversation with a friend, or gather a few of them into a group.</p>
                <button className="btn btn--primary" onClick={() => setNewChatOpen(true)}>Start a chat</button>
              </div>
            )}

            {!loading && !error && conversations.length > 0 && visible.length === 0 && (
              <div className="state">No chats match “{query || filter}”.</div>
            )}

            <ul className="convo-list">
              {visible.map((convo) => {
                const info = displayInfo(convo);
                const unread = unreadIds.has(convo._id) && convo._id !== activeId;
                const isOnCall = !convo.isGroup && callState === 'connected'
                  && callPeers.some((p) => p._id === otherParticipant(convo)._id);
                return (
                  <li key={convo._id}>
                    <NavLink
                      to={`/chat/${convo._id}`}
                      className={({ isActive }) =>
                        `convo${isActive ? ' convo--active' : ''}${unread ? ' convo--unread' : ''}`}
                    >
                      <Avatar seed={info.avatarSeed} size={46} online={info.online} />
                      <div className="convo__body">
                        <div className="convo__top">
                          <span className="convo__name">
                            {info.name}
                            {convo.isGroup && <span className="pill pill--sage">GROUP</span>}
                          </span>
                          {!isOnCall && <span className="convo__time">{relativeTime(convo.lastMessageAt)}</span>}
                        </div>
                        <div className="convo__bottom">
                          {isOnCall ? (
                            <span className="convo__call"><Phone size={13} /> Call ongoing · {callDuration()}</span>
                          ) : (
                            <span className="convo__preview">{convo.lastMessage || info.sub || 'No messages yet'}</span>
                          )}
                          {unread && <span className="convo__unread" aria-label="Unread" />}
                        </div>
                      </div>
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </div>
        </aside>

        <section className="chat-main">
          <Outlet context={ctx} />
        </section>
      </div>
    </AppShell>
  );
}

/** Index route — shown on desktop when no thread is open. */
export function ChatEmpty() {
  return (
    <div className="chat-empty">
      <img src="/emoji/wave.svg" alt="" width={72} height={72} />
      <h2>Pick up where you left off</h2>
      <p>Select a conversation on the left, or start a new one with a friend.</p>
    </div>
  );
}
