import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { UserPlus, Search, MessageCircle, MoreHorizontal, UserMinus, Inbox, Users, Check, X } from 'lucide-react';
import AppShell from '../components/AppShell';
import Avatar from '../components/Avatar';
import {
  getFriendRequests, acceptFriendRequest, rejectFriendRequest,
  getFriends, createConversation, removeFriend
} from '../api/client';
import { getToken, isLoggedIn } from '../context/auth';
import './FriendRequests.css';

function Skeleton() {
  return [0, 1, 2].map((i) => (
    <div className="person person--skeleton" key={i}>
      <div className="skeleton skeleton--circle" style={{ width: 52, height: 52 }} />
      <div style={{ flex: 1 }}>
        <div className="skeleton" style={{ width: '35%', height: 13, marginBottom: 8 }} />
        <div className="skeleton" style={{ width: '60%', height: 10 }} />
      </div>
    </div>
  ));
}

export default function FriendRequests() {
  const navigate = useNavigate();
  const [friends, setFriends] = useState([]);
  const [incoming, setIncoming] = useState([]);
  const [outgoing, setOutgoing] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [tab, setTab] = useState('friends');
  const [query, setQuery] = useState('');
  const [menuFor, setMenuFor] = useState(null);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!isLoggedIn()) {
      navigate('/', { replace: true });
      return;
    }
    Promise.all([getFriends(getToken()), getFriendRequests(getToken())])
      .then(([friendsList, requests]) => {
        setFriends(friendsList);
        setIncoming(requests.incoming);
        setOutgoing(requests.outgoing);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [navigate]);

  useEffect(() => {
    if (!menuFor) return;
    const close = (e) => { if (!menuRef.current?.contains(e.target)) setMenuFor(null); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menuFor]);

  const run = async (id, fn) => {
    setBusyId(id);
    setError('');
    try { await fn(); } catch (err) { setError(err.message); } finally { setBusyId(null); }
  };

  const handleAccept = (id) => run(id, async () => {
    const accepted = await acceptFriendRequest(getToken(), id);
    setIncoming((l) => l.filter((r) => r._id !== id));
    setFriends((l) => [...l, accepted.from]);
  });

  const handleReject = (id, isOutgoing) => run(id, async () => {
    await rejectFriendRequest(getToken(), id);
    (isOutgoing ? setOutgoing : setIncoming)((l) => l.filter((r) => r._id !== id));
  });

  const handleMessage = (userId) => run(userId, async () => {
    const convo = await createConversation(getToken(), userId);
    navigate(`/chat/${convo._id}`);
  });

  const handleRemove = (friend) => {
    setMenuFor(null);
    if (!window.confirm(`Remove ${friend.name} from your friends?`)) return;
    run(friend._id, async () => {
      await removeFriend(getToken(), friend._id);
      setFriends((l) => l.filter((f) => f._id !== friend._id));
    });
  };

  const onlineCount = friends.filter((f) => f.isOnline).length;

  const { online, offline } = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = friends.filter((f) => !q || f.name.toLowerCase().includes(q));
    return { online: list.filter((f) => f.isOnline), offline: list.filter((f) => !f.isOnline) };
  }, [friends, query]);

  const friendRow = (f) => (
    <li key={f._id} className="person">
      <Avatar seed={f.avatarSeed} size={52} online={f.isOnline} />
      <div className="person__body">
        <span className="person__name">{f.name}</span>
        <span className="person__sub">{f.status || (f.isOnline ? 'Online' : 'Offline')}</span>
      </div>
      <div className="person__actions">
        <button className="btn btn--primary btn--sm" disabled={busyId === f._id} onClick={() => handleMessage(f._id)}>
          <MessageCircle size={15} /> {busyId === f._id ? 'Opening…' : 'Message'}
        </button>
        <div className="person__more" ref={menuFor === f._id ? menuRef : null}>
          <button
            className="icon-btn"
            aria-label={`More options for ${f.name}`}
            aria-haspopup="menu"
            onClick={() => setMenuFor((m) => (m === f._id ? null : f._id))}
          >
            <MoreHorizontal size={18} />
          </button>
          {menuFor === f._id && (
            <div className="person__menu" role="menu">
              <button role="menuitem" onClick={() => handleRemove(f)}><UserMinus size={15} /> Remove friend</button>
            </div>
          )}
        </div>
      </div>
    </li>
  );

  return (
    <AppShell>
      <div className="page">
        <div className="page-header">
          <div>
            <p className="page-header__eyebrow">Your people</p>
            <h1 className="page-title">Friends</h1>
            {!loading && (
              <p className="page-sub">
                {friends.length} {friends.length === 1 ? 'friend' : 'friends'}
                {friends.length > 0 && ` · ${onlineCount} online now`}
              </p>
            )}
          </div>
          <Link to="/friends/add" className="btn btn--primary"><UserPlus size={17} /> Add friend</Link>
        </div>

        <div className="seg" role="tablist">
          <button role="tab" aria-selected={tab === 'friends'} className={`seg__item${tab === 'friends' ? ' seg__item--active' : ''}`} onClick={() => setTab('friends')}>
            <Users size={16} /> Friends
          </button>
          <button role="tab" aria-selected={tab === 'requests'} className={`seg__item${tab === 'requests' ? ' seg__item--active' : ''}`} onClick={() => setTab('requests')}>
            <Inbox size={16} /> Requests
            {incoming.length > 0 && <span className="count-badge">{incoming.length}</span>}
          </button>
        </div>

        {error && <div className="notice friends__notice">{error}</div>}

        {loading && <div className="friends__stack"><Skeleton /></div>}

        {!loading && tab === 'friends' && (
          <>
            {incoming.length > 0 && (
              <button className="friends__banner" onClick={() => setTab('requests')}>
                <span className="count-badge">{incoming.length}</span>
                <span>
                  {incoming.length === 1 ? 'Someone wants' : `${incoming.length} people want`} to be your friend
                </span>
                <strong>Review</strong>
              </button>
            )}

            {friends.length === 0 ? (
              <div className="empty card">
                <span className="empty__icon"><Users size={26} /></span>
                <h2 className="empty__title">No friends yet</h2>
                <p>Add someone by name or email to start chatting and calling.</p>
                <Link to="/friends/add" className="btn btn--primary"><UserPlus size={16} /> Find people</Link>
              </div>
            ) : (
              <>
                {friends.length > 4 && (
                  <div className="search-field friends__search">
                    <Search size={17} />
                    <input className="input" placeholder="Search your friends" aria-label="Search your friends" value={query} onChange={(e) => setQuery(e.target.value)} />
                  </div>
                )}
                {online.length + offline.length === 0 && <div className="state">No friends match “{query}”.</div>}
                {online.length > 0 && (
                  <section className="friends__group">
                    <h2 className="eyebrow">Online · {online.length}</h2>
                    <ul className="friends__stack">{online.map(friendRow)}</ul>
                  </section>
                )}
                {offline.length > 0 && (
                  <section className="friends__group">
                    <h2 className="eyebrow">{online.length > 0 ? `Offline · ${offline.length}` : `All friends · ${offline.length}`}</h2>
                    <ul className="friends__stack">{offline.map(friendRow)}</ul>
                  </section>
                )}
              </>
            )}
          </>
        )}

        {!loading && tab === 'requests' && (
          <>
            <section className="friends__group">
              <h2 className="eyebrow">Incoming · {incoming.length}</h2>
              {incoming.length === 0 ? (
                <p className="friends__none">No incoming requests right now.</p>
              ) : (
                <ul className="friends__stack">
                  {incoming.map((r) => (
                    <li key={r._id} className="person person--request">
                      <Avatar seed={r.from.avatarSeed} size={52} online={r.from.isOnline} />
                      <div className="person__body">
                        <span className="person__name">{r.from.name}</span>
                        <span className="person__sub">{r.from.status || 'Wants to connect'}</span>
                      </div>
                      <div className="person__actions">
                        <button className="btn btn--primary btn--sm" disabled={busyId === r._id} onClick={() => handleAccept(r._id)}>
                          <Check size={15} /> Accept
                        </button>
                        <button className="btn btn--ghost btn--sm" disabled={busyId === r._id} onClick={() => handleReject(r._id, false)}>
                          Decline
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="friends__group">
              <h2 className="eyebrow">Sent · {outgoing.length}</h2>
              {outgoing.length === 0 ? (
                <p className="friends__none">You have no pending sent requests.</p>
              ) : (
                <ul className="friends__stack">
                  {outgoing.map((r) => (
                    <li key={r._id} className="person">
                      <Avatar seed={r.to.avatarSeed} size={52} online={r.to.isOnline} />
                      <div className="person__body">
                        <span className="person__name">{r.to.name}</span>
                        <span className="person__sub">Waiting for a response</span>
                      </div>
                      <div className="person__actions">
                        <button className="btn btn--ghost btn--sm" disabled={busyId === r._id} onClick={() => handleReject(r._id, true)}>
                          <X size={15} /> Cancel
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}
