import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, Search, UserPlus } from 'lucide-react';
import AppShell from '../components/AppShell';
import Avatar from '../components/Avatar';
import { searchUsers, sendFriendRequest, getFriends } from '../api/client';
import { getToken, isLoggedIn } from '../context/auth';
import './AddFriend.css';

export default function AddFriend() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sentTo, setSentTo] = useState({}); // userId -> 'sending' | 'sent' | error message
  const [friendIds, setFriendIds] = useState(new Set());

  useEffect(() => {
    if (!isLoggedIn()) {
      navigate('/', { replace: true });
      return;
    }
    // Know who's already a friend so we don't offer "Add" for them.
    getFriends(getToken()).then((l) => setFriendIds(new Set(l.map((f) => f._id)))).catch(() => {});
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
      <div className="page">
        <Link to="/friends" className="back-link"><ArrowLeft size={16} /> Friends</Link>

        <div className="page-header add-friend__header">
          <div>
            <p className="page-header__eyebrow">Grow your circle</p>
            <h1 className="page-title">Add a friend</h1>
            <p className="page-sub">Search by name or email. They’ll get a request to accept.</p>
          </div>
        </div>

        <div className="search-field">
          <Search size={18} />
          <input
            className="input add-friend__search"
            type="text"
            placeholder="Search by name or email…"
            aria-label="Search people"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
        </div>

        {error && <div className="notice add-friend__notice">{error}</div>}

        <p className="eyebrow add-friend__label">{query ? 'Results' : 'People on Aeris'}</p>

        {loading && results.length === 0 && <div className="state">Searching…</div>}

        {!loading && !error && results.length === 0 && (
          <div className="empty card">
            <span className="empty__icon"><UserPlus size={26} /></span>
            <h2 className="empty__title">{query ? 'No one found' : 'Start typing'}</h2>
            <p>{query ? 'Check the spelling, or try their email address.' : 'Type a name or email to find people.'}</p>
          </div>
        )}

        <ul className="add-friend__list">
          {results.map((user) => {
            const state = sentTo[user._id];
            const isError = state && state !== 'sending' && state !== 'sent';
            return (
              <li key={user._id} className="add-friend__item">
                <Avatar seed={user.avatarSeed} size={48} online={user.isOnline} />
                <div className="add-friend__body">
                  <span className="add-friend__name">{user.name}</span>
                  <span className={`add-friend__sub${isError ? ' add-friend__sub--error' : ''}`}>
                    {isError ? state : (user.status || user.email)}
                  </span>
                </div>
                {friendIds.has(user._id) ? (
                  <span className="pill pill--sage"><Check size={12} /> Friends</span>
                ) : (
                <button
                  className={`btn btn--sm ${state === 'sent' ? 'btn--soft' : 'btn--primary'}`}
                  disabled={state === 'sending' || state === 'sent'}
                  onClick={() => handleSend(user._id)}
                >
                  {state === 'sending' ? 'Sending…' : state === 'sent' ? <><Check size={15} /> Requested</> : <><UserPlus size={15} /> Add</>}
                </button>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </AppShell>
  );
}
