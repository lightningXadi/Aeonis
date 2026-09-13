import { useEffect, useState } from 'react';
import Avatar from './Avatar';
import { getFriends } from '../api/client';
import { getToken } from '../context/auth';
import './AddToCallPanel.css';

export default function AddToCallPanel({ existingIds, onAdd, onClose }) {
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getFriends(getToken())
      .then((all) => setFriends(all.filter((f) => !existingIds.includes(f._id))))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="add-to-call-panel">
      <div className="add-to-call-panel__header">
        <span>Add to call</span>
        <button onClick={onClose}>✕</button>
      </div>
      {loading && <p className="add-to-call-panel__state">Loading…</p>}
      {!loading && friends.length === 0 && (
        <p className="add-to-call-panel__state">Everyone's already here.</p>
      )}
      <ul className="add-to-call-panel__list">
        {friends.map((f) => (
          <li key={f._id}>
            <button className="add-to-call-panel__item" onClick={() => onAdd(f)}>
              <Avatar seed={f.avatarSeed} size={32} online={f.isOnline} />
              <span>{f.name}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
