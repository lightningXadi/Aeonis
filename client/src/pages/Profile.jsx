import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppShell from '../components/AppShell';
import Avatar from '../components/Avatar';
import { getToken, isLoggedIn, getStoredUser, setSession } from '../context/auth';
import { getMe, updateMe } from '../api/client';
import './Profile.css';

const CREATURES = ['fox', 'owl', 'rabbit', 'deer'];

export default function Profile() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const savedTimeout = useRef(null);

  const [name, setName] = useState('');
  const [status, setStatus] = useState('');

  useEffect(() => {
    if (!isLoggedIn()) {
      navigate('/', { replace: true });
      return;
    }
    getMe(getToken())
      .then((data) => {
        setProfile(data);
        setName(data.name);
        setStatus(data.status || '');
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));

    return () => clearTimeout(savedTimeout.current);
  }, [navigate]);

  const flashSaved = () => {
    setSaved(true);
    clearTimeout(savedTimeout.current);
    savedTimeout.current = setTimeout(() => setSaved(false), 1800);
  };

  const persist = async (updates) => {
    setError('');
    try {
      const updated = await updateMe(getToken(), updates);
      setProfile((p) => ({ ...p, ...updated }));
      setSession(getToken(), { ...getStoredUser(), ...updated });
      flashSaved();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleNameBlur = () => {
    const trimmed = name.trim();
    if (!trimmed) return setError('Name cannot be empty.');
    if (trimmed !== profile.name) persist({ name: trimmed });
  };

  const handleStatusBlur = () => {
    if (status.trim() !== (profile.status || '')) persist({ status: status.trim() });
  };

  const pickAvatar = (seed) => {
    if (seed !== profile.avatarSeed) persist({ avatarSeed: seed });
  };

  if (loading) {
    return (
      <AppShell>
        <div className="profile-page__state">Loading your profile…</div>
      </AppShell>
    );
  }

  if (error && !profile) {
    return (
      <AppShell>
        <div className="profile-page__state">{error}</div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="profile-page">
        <div className="profile-page__avatar-row">
          <Avatar seed={profile.avatarSeed} size={96} />
          <div className="profile-page__avatar-picker">
            {CREATURES.map((c) => (
              <button
                key={c}
                className={`profile-page__avatar-option${c === profile.avatarSeed ? ' profile-page__avatar-option--active' : ''}`}
                onClick={() => pickAvatar(c)}
                title={`Use ${c} avatar`}
              >
                <Avatar seed={c} size={36} />
              </button>
            ))}
          </div>
        </div>

        {error && <div className="profile-page__error">{error}</div>}

        <div className="profile-page__field">
          <label htmlFor="profile-name">Name</label>
          <input
            id="profile-name"
            className="profile-page__name-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={handleNameBlur}
            onKeyDown={(e) => e.key === 'Enter' && e.target.blur()}
          />
        </div>

        <div className="profile-page__field">
          <label htmlFor="profile-status">Status</label>
          <input
            id="profile-status"
            className="profile-page__status-input"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            onBlur={handleStatusBlur}
            onKeyDown={(e) => e.key === 'Enter' && e.target.blur()}
            placeholder="What are you up to?"
          />
        </div>

        <div className="profile-page__save-indicator">{saved ? 'Saved' : ''}</div>

        <div className="profile-page__stats">
          <div className="profile-page__stat">
            <span className="profile-page__stat-number">{profile.friendCount ?? 0}</span>
            <span className="profile-page__stat-label">{profile.friendCount === 1 ? 'FRIEND' : 'FRIENDS'}</span>
          </div>
        </div>

        <p className="profile-page__email">{profile.email}</p>
      </div>
    </AppShell>
  );
}
