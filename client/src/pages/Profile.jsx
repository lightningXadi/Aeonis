import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Mail, LogOut, Users } from 'lucide-react';
import AppShell from '../components/AppShell';
import Avatar from '../components/Avatar';
import { getToken, isLoggedIn, getStoredUser, setSession, clearSession } from '../context/auth';
import { disconnectSocket } from '../socket';
import { getMe, updateMe } from '../api/client';
import './Profile.css';

const CREATURES = [
  { id: 'fox', label: 'Fox', tag: 'Clever wanderer' },
  { id: 'owl', label: 'Owl', tag: 'Midnight sage' },
  { id: 'rabbit', label: 'Rabbit', tag: 'Gentle whisperer' },
  { id: 'deer', label: 'Deer', tag: 'Graceful sentinel' }
];

const STATUS_IDEAS = [
  'Resting in the Bracken',
  'Reading by the hearth',
  'Out for a walk',
  'Busy — reply later',
  'Free to chat'
];

const STATUS_MAX = 80;

export default function Profile() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Draft values — nothing is sent until "Save changes".
  const [name, setName] = useState('');
  const [status, setStatus] = useState('');
  const [avatarSeed, setAvatarSeed] = useState('fox');

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
        setAvatarSeed(data.avatarSeed);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [navigate]);

  const dirty = profile && (
    name.trim() !== profile.name ||
    status.trim() !== (profile.status || '') ||
    avatarSeed !== profile.avatarSeed
  );

  const discard = () => {
    setName(profile.name);
    setStatus(profile.status || '');
    setAvatarSeed(profile.avatarSeed);
    setError('');
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');
    if (!name.trim()) return setError('Your name can’t be empty.');

    const updates = {};
    if (name.trim() !== profile.name) updates.name = name.trim();
    if (status.trim() !== (profile.status || '')) updates.status = status.trim();
    if (avatarSeed !== profile.avatarSeed) updates.avatarSeed = avatarSeed;

    setSaving(true);
    try {
      const updated = await updateMe(getToken(), updates);
      setProfile((p) => ({ ...p, ...updated }));
      setSession(getToken(), { ...getStoredUser(), ...updated });
      setSaved(true);
      setTimeout(() => setSaved(false), 2200);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    disconnectSocket();
    clearSession();
    window.location.href = '/';
  };

  if (loading) return <AppShell><div className="state">Loading your profile…</div></AppShell>;
  if (error && !profile) return <AppShell><div className="state state--error">{error}</div></AppShell>;

  const creature = CREATURES.find((c) => c.id === avatarSeed);

  return (
    <AppShell>
      <form className="page profile" onSubmit={handleSave}>
        <section className="card profile__hero">
          <div className="profile__cover" />
          <div className="profile__hero-body">
            <Avatar seed={avatarSeed} size={104} ring />
            <div className="profile__identity">
              <label className="sr-only" htmlFor="profile-name">Display name</label>
              <input
                id="profile-name"
                className="profile__name-input"
                value={name}
                maxLength={40}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
              />
              <p className="profile__status-preview">{status.trim() || 'No status set'}</p>
              <p className="profile__creature">{creature?.label} · {creature?.tag}</p>
            </div>
          </div>
        </section>

        {error && <div className="notice">{error}</div>}

        <section className="card profile__section">
          <h2 className="card__title">Choose your spirit animal</h2>
          <p className="profile__hint">This is how friends see you across Aeris.</p>
          <div className="profile__creatures" role="radiogroup" aria-label="Avatar">
            {CREATURES.map((c) => (
              <button
                type="button"
                key={c.id}
                role="radio"
                aria-checked={avatarSeed === c.id}
                className={`creature${avatarSeed === c.id ? ' creature--active' : ''}`}
                onClick={() => setAvatarSeed(c.id)}
              >
                <Avatar seed={c.id} size={52} />
                <span className="creature__label">{c.label}</span>
                <span className="creature__tag">{c.tag}</span>
                {avatarSeed === c.id && <span className="creature__check"><Check size={13} strokeWidth={3} /></span>}
              </button>
            ))}
          </div>
        </section>

        <section className="card profile__section">
          <h2 className="card__title">Status</h2>
          <p className="profile__hint">A short note that appears under your name.</p>
          <input
            className="input"
            aria-label="Status"
            value={status}
            maxLength={STATUS_MAX}
            onChange={(e) => setStatus(e.target.value)}
            placeholder="What are you up to?"
          />
          <div className="profile__counter">{status.length}/{STATUS_MAX}</div>
          <div className="profile__chips">
            {STATUS_IDEAS.map((idea) => (
              <button
                type="button"
                key={idea}
                className={`chip${status === idea ? ' chip--active' : ''}`}
                onClick={() => setStatus(idea)}
              >
                {idea}
              </button>
            ))}
          </div>
        </section>

        <div className="profile__grid">
          <section className="card profile__section">
            <h2 className="card__title">Account</h2>
            <div className="profile__row">
              <span className="profile__row-icon"><Mail size={17} /></span>
              <div>
                <p className="eyebrow">Email</p>
                <p className="profile__row-value">{profile.email}</p>
              </div>
            </div>
            <div className="profile__row">
              <span className="profile__row-icon"><Users size={17} /></span>
              <div>
                <p className="eyebrow">Friends</p>
                <p className="profile__row-value">{profile.friendCount ?? 0}</p>
              </div>
            </div>
          </section>

          <section className="card profile__section profile__session">
            <h2 className="card__title">Session</h2>
            <p className="profile__hint">Signed in as {profile.name}.</p>
            <button type="button" className="btn btn--danger" onClick={handleLogout}>
              <LogOut size={16} /> Log out
            </button>
          </section>
        </div>

        {/* Save bar slides in only when something changed. */}
        <div className={`profile__savebar${dirty || saved ? ' profile__savebar--visible' : ''}`} aria-live="polite">
          {saved && !dirty ? (
            <span className="profile__saved"><Check size={16} /> Changes saved</span>
          ) : (
            <>
              <span className="profile__unsaved">You have unsaved changes</span>
              <button type="button" className="btn btn--ghost btn--sm" onClick={discard} disabled={saving}>Discard</button>
              <button type="submit" className="btn btn--primary btn--sm" disabled={saving}>
                {saving ? 'Saving…' : 'Save changes'}
              </button>
            </>
          )}
        </div>
      </form>
    </AppShell>
  );
}
