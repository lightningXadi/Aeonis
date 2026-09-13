import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AppShell from '../components/AppShell';
import Avatar from '../components/Avatar';
import { getFriendRequests, acceptFriendRequest, rejectFriendRequest, getFriends, createConversation } from '../api/client';
import { getToken, isLoggedIn } from '../context/auth';
import './FriendRequests.css';

export default function FriendRequests() {
  const navigate = useNavigate();
  const [friends, setFriends] = useState([]);
  const [incoming, setIncoming] = useState([]);
  const [outgoing, setOutgoing] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  const load = () => {
    Promise.all([getFriends(getToken()), getFriendRequests(getToken())])
      .then(([friendsList, requests]) => {
        setFriends(friendsList);
        setIncoming(requests.incoming);
        setOutgoing(requests.outgoing);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!isLoggedIn()) {
      navigate('/', { replace: true });
      return;
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  const handleAccept = async (id) => {
    setBusyId(id);
    try {
      const accepted = await acceptFriendRequest(getToken(), id);
      setIncoming((list) => list.filter((r) => r._id !== id));
      setFriends((list) => [...list, accepted.from]);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = async (id, isOutgoing) => {
    setBusyId(id);
    try {
      await rejectFriendRequest(getToken(), id);
      if (isOutgoing) setOutgoing((list) => list.filter((r) => r._id !== id));
      else setIncoming((list) => list.filter((r) => r._id !== id));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const handleMessage = async (userId) => {
    setBusyId(userId);
    try {
      const convo = await createConversation(getToken(), userId);
      navigate(`/chat/${convo._id}`);
    } catch (err) {
      setError(err.message);
      setBusyId(null);
    }
  };

  return (
    <AppShell>
      <div className="requests-page">
        <div className="requests-page__header">
          <h1>Friend Requests</h1>
          <Link to="/friends/add" className="requests-page__add-btn">+ Add Friend</Link>
        </div>

        {loading && <div className="requests-page__state">Loading…</div>}
        {error && <div className="requests-page__state requests-page__state--error">{error}</div>}

        {!loading && !error && (
          <>
            <section className="requests-section">
              <h2>My Friends</h2>
              {friends.length === 0 && <p className="requests-section__empty">No friends yet — add someone to start chatting.</p>}
              <ul className="requests-list">
                {friends.map((f) => (
                  <li key={f._id} className="requests-list__item">
                    <Avatar seed={f.avatarSeed} size={44} online={f.isOnline} />
                    <div className="requests-list__body">
                      <span className="requests-list__name">{f.name}</span>
                      <span className="requests-list__sub">{f.status}</span>
                    </div>
                    <div className="requests-list__actions">
                      <button
                        className="requests-btn requests-btn--accept"
                        disabled={busyId === f._id}
                        onClick={() => handleMessage(f._id)}
                      >
                        {busyId === f._id ? 'Opening…' : 'Message'}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            <section className="requests-section">
              <h2>Incoming</h2>
              {incoming.length === 0 && <p className="requests-section__empty">No incoming requests right now.</p>}
              <ul className="requests-list">
                {incoming.map((r) => (
                  <li key={r._id} className="requests-list__item">
                    <Avatar seed={r.from.avatarSeed} size={44} online={r.from.isOnline} />
                    <div className="requests-list__body">
                      <span className="requests-list__name">{r.from.name}</span>
                      <span className="requests-list__sub">{r.from.status}</span>
                    </div>
                    <div className="requests-list__actions">
                      <button
                        className="requests-btn requests-btn--accept"
                        disabled={busyId === r._id}
                        onClick={() => handleAccept(r._id)}
                      >
                        Accept
                      </button>
                      <button
                        className="requests-btn requests-btn--reject"
                        disabled={busyId === r._id}
                        onClick={() => handleReject(r._id, false)}
                      >
                        Decline
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            <section className="requests-section">
              <h2>Sent</h2>
              {outgoing.length === 0 && <p className="requests-section__empty">No pending sent requests.</p>}
              <ul className="requests-list">
                {outgoing.map((r) => (
                  <li key={r._id} className="requests-list__item">
                    <Avatar seed={r.to.avatarSeed} size={44} online={r.to.isOnline} />
                    <div className="requests-list__body">
                      <span className="requests-list__name">{r.to.name}</span>
                      <span className="requests-list__sub">Waiting for response</span>
                    </div>
                    <div className="requests-list__actions">
                      <button
                        className="requests-btn requests-btn--reject"
                        disabled={busyId === r._id}
                        onClick={() => handleReject(r._id, true)}
                      >
                        Cancel
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}
