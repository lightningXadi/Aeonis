import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AppShell from '../components/AppShell';
import Avatar from '../components/Avatar';
import { searchUsers, sendFriendRequest } from '../api/client';
import { getToken, isLoggedIn } from '../context/auth';
import './AddFriend.css';

export default function AddFriend() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sentTo, setSentTo] = useState({}); // userId -> 'sending' | 'sent' | error message

  useEffect(() => {
    if (!isLoggedIn()) {
      navigate('/', { replace: true });
      return;
    }
  }, [navigate]);

  // Debounced search-as-you-type
  useEffect(() => {
    setLoading(true);
    setError('');
    const t = setTimeout(() => {
      searchUsers(getToken(), query)
        .then(setResults)
        .catch((err) => setError(err.message))
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const handleSend = async (userId) => {
    setSentTo((s) => ({ ...s, [userId]: 'sending' }));
    try {
      await sendFriendRequest(getToken(), userId);
      setSentTo((s) => ({ ...s, [userId]: 'sent' }));
    } catch (err) {
      setSentTo((s) => ({ ...s, [userId]: err.message }));
    }
  };

  return (
    <AppShell>
      <div className="add-friend-page">
        <div className="add-friend-page__header">
          <h1>Add Friend</h1>
          <Link to="/friends" className="add-friend-page__back">← Requests</Link>
        </div>

        <input
          className="add-friend-page__search"
          type="text"
          placeholder="Search by name or email…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />

        {loading && <div className="add-friend-page__state">Searching…</div>}
        {error && <div className="add-friend-page__state add-friend-page__state--error">{error}</div>}

        {!loading && !error && results.length === 0 && (
          <div className="add-friend-page__state">
            {query ? 'No one found with that name or email.' : 'Type a name or email to find people.'}
          </div>
        )}

        <ul className="add-friend-list">
          {results.map((user) => {
            const state = sentTo[user._id];
            const isError = state && state !== 'sending' && state !== 'sent';
            return (
              <li key={user._id} className="add-friend-list__item">
                <Avatar seed={user.avatarSeed} online={user.isOnline} />
                <div className="add-friend-list__body">
                  <span className="add-friend-list__name">{user.name}</span>
                  <span className="add-friend-list__sub">
                    {isError ? state : (user.status || user.email)}
                  </span>
                </div>
                <button
                  className="add-friend-btn"
                  disabled={state === 'sending' || state === 'sent'}
                  onClick={() => handleSend(user._id)}
                >
                  {state === 'sending' ? 'Sending…' : state === 'sent' ? 'Sent ✓' : 'Add'}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </AppShell>
  );
}
