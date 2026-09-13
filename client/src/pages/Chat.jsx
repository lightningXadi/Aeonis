import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AppShell from '../components/AppShell';
import Avatar from '../components/Avatar';
import { relativeTime } from '../utils/time';
import { getToken, isLoggedIn, getStoredUser } from '../context/auth';
import { getConversations } from '../api/client';
import { useCall } from '../context/CallContext';
import './Chat.css';

export default function Chat() {
  const navigate = useNavigate();
  const me = getStoredUser();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { callState, conversationId: activeCallConvoId, startedAt } = useCall();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!isLoggedIn()) {
      navigate('/', { replace: true });
      return;
    }

    getConversations(getToken())
      .then(setConversations)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [navigate]);

  // Just to re-render the ongoing-call duration in the list every second.
  useEffect(() => {
    if (callState !== 'connected') return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [callState]);

  const otherParticipant = (convo) =>
    convo.participants.find((p) => p._id !== me?.id) || convo.participants[0];

  const displayInfo = (convo) => {
    if (convo.isGroup) {
      return {
        name: convo.name,
        avatarSeed: convo.avatarSeed,
        online: false,
        sub: `${convo.participants.length} members`
      };
    }
    const other = otherParticipant(convo);
    return { name: other.name, avatarSeed: other.avatarSeed, online: other.isOnline, sub: null };
  };

  const callDurationFor = () => {
    if (!startedAt) return 'Connecting…';
    const secs = Math.floor((Date.now() - startedAt) / 1000);
    const m = String(Math.floor(secs / 60)).padStart(2, '0');
    const s = String(secs % 60).padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <AppShell>
      <div className="chat-list-page">
        <div className="chat-list-page__header">
          <h1>Chats</h1>
          <div className="chat-list-page__header-actions">
            <Link to="/groups/new" className="chat-list-page__new-btn chat-list-page__new-btn--secondary">+ Group</Link>
            <Link to="/friends/add" className="chat-list-page__new-btn">+ New</Link>
          </div>
        </div>

        {loading && <div className="chat-list-page__state">Loading your conversations…</div>}
        {error && <div className="chat-list-page__state chat-list-page__state--error">{error}</div>}

        {!loading && !error && conversations.length === 0 && (
          <div className="chat-list-page__empty">
            <p>No conversations yet.</p>
            <p className="chat-list-page__empty-sub">
              Message a friend from your <Link to="/friends">friends list</Link>, or start a <Link to="/groups/new">group</Link>.
            </p>
          </div>
        )}

        {!loading && !error && conversations.length > 0 && (
          <ul className="chat-list">
            {conversations.map((convo) => {
              const info = displayInfo(convo);
              const isOnCall = callState === 'connected' && convo._id === activeCallConvoId;
              return (
                <li key={convo._id}>
                  <Link to={`/chat/${convo._id}`} className={`chat-list__item${isOnCall ? ' chat-list__item--on-call' : ''}`}>
                    <Avatar seed={info.avatarSeed} online={info.online} />
                    <div className="chat-list__item-body">
                      <div className="chat-list__item-top">
                        <span className="chat-list__item-name">
                          {info.name}
                          {convo.isGroup && <span className="chat-list__item-group-tag">GROUP</span>}
                        </span>
                        <span className="chat-list__item-time">
                          {isOnCall ? '' : relativeTime(convo.lastMessageAt)}
                        </span>
                      </div>
                      <div className="chat-list__item-bottom">
                        {isOnCall ? (
                          <span className="chat-list__ongoing-call">
                            <span className="chat-list__ongoing-dot" />
                            Call ongoing · {callDurationFor()}
                          </span>
                        ) : (
                          <span className="chat-list__item-preview">
                            {convo.lastMessage || info.sub || 'No messages yet'}
                          </span>
                        )}
                        {!isOnCall && convo.unread && <span className="chat-list__item-dot" />}
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
