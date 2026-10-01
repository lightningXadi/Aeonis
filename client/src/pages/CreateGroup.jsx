import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, Search, UserPlus, X } from 'lucide-react';
import AppShell from '../components/AppShell';
import Avatar from '../components/Avatar';
import { getFriends, createGroup } from '../api/client';
import { getToken, isLoggedIn } from '../context/auth';
import './CreateGroup.css';

const CREATURES = ['fox', 'owl', 'rabbit', 'deer'];

export default function CreateGroup() {
  const navigate = useNavigate();
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [name, setName] = useState('');
  const [selected, setSelected] = useState([]); // array of userIds
  const [avatarSeed, setAvatarSeed] = useState('fox');
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!isLoggedIn()) {
      navigate('/', { replace: true });
      return;
    }
    getFriends(getToken())
      .then(setFriends)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [navigate]);

  const toggle = (userId) =>
    setSelected((sel) => (sel.includes(userId) ? sel.filter((id) => id !== userId) : [...sel, userId]));

  const selectedFriends = useMemo(() => friends.filter((f) => selected.includes(f._id)), [friends, selected]);
  const visible = friends.filter((f) => !query.trim() || f.name.toLowerCase().includes(query.trim().toLowerCase()));

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');
    if (!name.trim()) return setError('Give your group a name.');
    if (selected.length === 0) return setError('Pick at least one friend to add.');

    setCreating(true);
    try {
      const convo = await createGroup(getToken(), { name: name.trim(), participantIds: selected, avatarSeed });
      navigate(`/chat/${convo._id}`);
    } catch (err) {
      setError(err.message);
      setCreating(false);
    }
  };

  return (
    <AppShell>
      <form className="page create-group" onSubmit={handleCreate}>
        <Link to="/chat" className="back-link"><ArrowLeft size={16} /> Chats</Link>

        <div className="page-header" style={{ marginTop: 10 }}>
          <div>
            <p className="page-header__eyebrow">Gather your people</p>
            <h1 className="page-title">New group</h1>
          </div>
        </div>

        {loading && <div className="state">Loading your friends…</div>}

        {!loading && (
          <>
            <section className="card create-group__section">
              <div className="create-group__identity">
                <Avatar seed={avatarSeed} size={72} ring />
                <div className="create-group__name">
                  <label className="eyebrow" htmlFor="group-name">Group name</label>
                  <input
                    id="group-name"
                    className="input"
                    placeholder="e.g. Weekend hikers"
                    value={name}
                    maxLength={40}
                    onChange={(e) => setName(e.target.value)}
                    autoFocus
                  />
                </div>
              </div>
              <p className="eyebrow create-group__label">Group icon</p>
              <div className="create-group__icons" role="radiogroup" aria-label="Group icon">
                {CREATURES.map((c) => (
                  <button
                    type="button"
                    key={c}
                    role="radio"
                    aria-checked={c === avatarSeed}
                    aria-label={c}
                    className={`create-group__icon${c === avatarSeed ? ' create-group__icon--active' : ''}`}
                    onClick={() => setAvatarSeed(c)}
                  >
                    <Avatar seed={c} size={46} />
                  </button>
                ))}
              </div>
            </section>

            <section className="card create-group__section">
              <div className="create-group__members-head">
                <h2 className="card__title">Add members</h2>
                <span className="pill pill--honey">{selected.length} selected</span>
              </div>

              {friends.length === 0 ? (
                <div className="empty">
                  <span className="empty__icon"><UserPlus size={26} /></span>
                  <h3 className="empty__title">No friends to add yet</h3>
                  <p>Groups are made from your friends list — add someone first.</p>
                  <Link to="/friends/add" className="btn btn--primary btn--sm">Find people</Link>
                </div>
              ) : (
                <>
                  {selectedFriends.length > 0 && (
                    <div className="create-group__chips">
                      {selectedFriends.map((f) => (
                        <button type="button" key={f._id} className="create-group__chip" onClick={() => toggle(f._id)} aria-label={`Remove ${f.name}`}>
                          <Avatar seed={f.avatarSeed} size={22} /> {f.name.split(' ')[0]} <X size={13} />
                        </button>
                      ))}
                    </div>
                  )}
                  {friends.length > 5 && (
                    <div className="search-field" style={{ margin: '12px 0 8px' }}>
                      <Search size={17} />
                      <input className="input" placeholder="Search friends" aria-label="Search friends" value={query} onChange={(e) => setQuery(e.target.value)} />
                    </div>
                  )}
                  <ul className="create-group__list">
                    {visible.map((f) => {
                      const on = selected.includes(f._id);
                      return (
                        <li key={f._id}>
                          <label className={`create-group__row${on ? ' create-group__row--on' : ''}`}>
                            <input type="checkbox" className="sr-only" checked={on} onChange={() => toggle(f._id)} />
                            <Avatar seed={f.avatarSeed} size={42} online={f.isOnline} />
                            <span className="create-group__row-name">{f.name}</span>
                            <span className="create-group__box">{on && <Check size={14} strokeWidth={3} />}</span>
                          </label>
                        </li>
                      );
                    })}
                    {visible.length === 0 && <li className="state">No friends match “{query}”.</li>}
                  </ul>
                </>
              )}
            </section>

            {error && <div className="notice">{error}</div>}

            <div className="create-group__submit">
              <button type="submit" className="btn btn--primary btn--block" disabled={creating || friends.length === 0}>
                {creating ? 'Creating…' : selected.length > 0 ? `Create group · ${selected.length + 1} people` : 'Create group'}
              </button>
            </div>
          </>
        )}
      </form>
    </AppShell>
  );
}
