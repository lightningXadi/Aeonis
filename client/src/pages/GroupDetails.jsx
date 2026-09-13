import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import AppShell from '../components/AppShell';
import Avatar from '../components/Avatar';
import { getToken, isLoggedIn, getStoredUser } from '../context/auth';
import {
  getConversationDetails, getFriends, addGroupMember,
  removeGroupMember, promoteModerator, demoteModerator
} from '../api/client';
import './GroupDetails.css';

export default function GroupDetails() {
  const { id: conversationId } = useParams();
  const navigate = useNavigate();
  const me = getStoredUser();

  const [convo, setConvo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  const [showAddPanel, setShowAddPanel] = useState(false);
  const [friends, setFriends] = useState([]);
  const [addBusyId, setAddBusyId] = useState(null);

  const load = () => {
    getConversationDetails(getToken(), conversationId)
      .then((data) => {
        if (!data.isGroup) {
          navigate(`/chat/${conversationId}`, { replace: true });
          return;
        }
        setConvo(data);
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
  }, [navigate, conversationId]);

  const isCreator = convo?.createdBy === me?.id;
  const isModerator = convo?.moderators?.includes(me?.id);
  const canAddMembers = isCreator || isModerator;

  const roleOf = (userId) => {
    if (convo.createdBy === userId) return 'Creator';
    if (convo.moderators?.includes(userId)) return 'Moderator';
    return 'Member';
  };

  const handlePromote = async (userId) => {
    setBusyId(userId);
    try {
      const updated = await promoteModerator(getToken(), conversationId, userId);
      setConvo(updated);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const handleDemote = async (userId) => {
    setBusyId(userId);
    try {
      const updated = await demoteModerator(getToken(), conversationId, userId);
      setConvo(updated);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const openAddPanel = async () => {
    setShowAddPanel(true);
    if (friends.length === 0) {
      try {
        const list = await getFriends(getToken());
        setFriends(list);
      } catch (err) {
        setError(err.message);
      }
    }
  };

  const handleAdd = async (userId) => {
    setAddBusyId(userId);
    try {
      const updated = await addGroupMember(getToken(), conversationId, userId);
      setConvo(updated);
    } catch (err) {
      setError(err.message);
    } finally {
      setAddBusyId(null);
    }
  };

  const handleRemove = async (userId) => {
    setBusyId(userId);
    try {
      const updated = await removeGroupMember(getToken(), conversationId, userId);
      setConvo(updated);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const handleLeave = async () => {
    setBusyId(me.id);
    try {
      await removeGroupMember(getToken(), conversationId, me.id);
      navigate('/chat', { replace: true });
    } catch (err) {
      setError(err.message);
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <AppShell>
        <div className="group-details__state">Loading group…</div>
      </AppShell>
    );
  }

  if (error && !convo) {
    return (
      <AppShell>
        <div className="group-details__state group-details__state--error">
          {error} <Link to="/chat">← Back to chats</Link>
        </div>
      </AppShell>
    );
  }

  const addableFriends = friends.filter((f) => !convo.participants.some((p) => p._id === f._id));

  return (
    <AppShell>
      <div className="group-details">
        <div className="group-details__header">
          <Link to={`/chat/${conversationId}`} className="group-details__back">← Back to chat</Link>
        </div>

        <div className="group-details__hero">
          <Avatar seed={convo.avatarSeed} size={80} />
          <h1>{convo.name}</h1>
          <p>{convo.participants.length} members</p>
        </div>

        {error && <div className="group-details__error">{error}</div>}

        <div className="group-details__members-header">
          <h2>Members</h2>
          {canAddMembers && (
            <button className="group-details__add-btn" onClick={openAddPanel}>+ Add Member</button>
          )}
        </div>

        {showAddPanel && (
          <div className="group-add-panel">
            {addableFriends.length === 0 ? (
              <p className="group-add-panel__empty">All your friends are already in this group.</p>
            ) : (
              addableFriends.map((f) => (
                <div key={f._id} className="group-add-panel__row">
                  <Avatar seed={f.avatarSeed} size={34} online={f.isOnline} />
                  <span>{f.name}</span>
                  <button
                    className="group-add-panel__add-btn"
                    disabled={addBusyId === f._id}
                    onClick={() => handleAdd(f._id)}
                  >
                    {addBusyId === f._id ? 'Adding…' : 'Add'}
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        <ul className="group-members">
          {convo.participants.map((p) => {
            const role = roleOf(p._id);
            const isMe = p._id === me?.id;
            const canRemoveThis = !isMe && role !== 'Creator' && (isCreator || (isModerator && role === 'Member'));
            return (
              <li key={p._id} className="group-members__item">
                <Avatar seed={p.avatarSeed} size={44} online={p.isOnline} />
                <div className="group-members__body">
                  <span className="group-members__name">{p.name}{isMe ? ' (you)' : ''}</span>
                  <span className={`group-members__role group-members__role--${role.toLowerCase()}`}>{role}</span>
                </div>
                <div className="group-members__actions">
                  {isCreator && !isMe && role !== 'Creator' && (
                    <button
                      className="group-members__role-btn"
                      disabled={busyId === p._id}
                      onClick={() => (role === 'Moderator' ? handleDemote(p._id) : handlePromote(p._id))}
                    >
                      {busyId === p._id ? '…' : role === 'Moderator' ? 'Remove mod' : 'Make Moderator'}
                    </button>
                  )}
                  {canRemoveThis && (
                    <button
                      className="group-members__remove-btn"
                      disabled={busyId === p._id}
                      onClick={() => handleRemove(p._id)}
                    >
                      {busyId === p._id ? '…' : 'Remove'}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>

        {isCreator ? (
          <p className="group-details__creator-note">As the creator, you can't leave the group.</p>
        ) : (
          <button className="group-details__leave-btn" disabled={busyId === me?.id} onClick={handleLeave}>
            {busyId === me?.id ? 'Leaving…' : 'Leave Group'}
          </button>
        )}
      </div>
    </AppShell>
  );
}
