import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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

  const toggle = (userId) => {
    setSelected((sel) => (sel.includes(userId) ? sel.filter((id) => id !== userId) : [...sel, userId]));
  };

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
      <div className="create-group-page">
        <div className="create-group-page__header">
          <h1>New Group</h1>
          <Link to="/chat" className="create-group-page__back">← Chats</Link>
        </div>

        {loading && <div className="create-group-page__state">Loading your friends…</div>}

        {!loading && (
          <form onSubmit={handleCreate}>
            <div className="create-group-page__avatar-row">
              {CREATURES.map((c) => (
                <button
                  type="button"
                  key={c}
                  className={`create-group-page__avatar-option${c === avatarSeed ? ' create-group-page__avatar-option--active' : ''}`}
                  onClick={() => setAvatarSeed(c)}
                >
                  <Avatar seed={c} size={44} />
                </button>
              ))}
            </div>

            <input
              className="create-group-page__name-input"
              placeholder="Group name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />

            {error && <div className="create-group-page__error">{error}</div>}

            {friends.length === 0 ? (
              <p className="create-group-page__empty">
                You don't have any friends yet — <Link to="/friends/add">add some</Link> before starting a group.
              </p>
            ) : (
              <>
                <p className="create-group-page__label">Add members ({selected.length} selected)</p>
                <ul className="create-group-page__friend-list">
                  {friends.map((f) => (
                    <li key={f._id}>
                      <label className="create-group-page__friend-row">
                        <input
                          type="checkbox"
                          checked={selected.includes(f._id)}
                          onChange={() => toggle(f._id)}
                        />
                        <Avatar seed={f.avatarSeed} size={38} online={f.isOnline} />
                        <span>{f.name}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              </>
            )}

            <button
              type="submit"
              className="create-group-page__submit"
              disabled={creating || friends.length === 0}
            >
              {creating ? 'Creating…' : 'Create Group'}
            </button>
          </form>
        )}
      </div>
    </AppShell>
  );
}
