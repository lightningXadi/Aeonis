import { NavLink, Link, useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { MessageCircle, Users, User, ChevronDown, LogOut, Phone } from 'lucide-react';
import Avatar from './Avatar';
import { getStoredUser, getToken, clearSession } from '../context/auth';
import { disconnectSocket, getSocket } from '../socket';
import { useCall } from '../context/CallContext';
import { getConversations, getFriendRequests } from '../api/client';
import { isUnread } from '../utils/seen';
import './AppShell.css';

const NAV_ITEMS = [
  { to: '/chat', label: 'Chats', icon: MessageCircle, badgeKey: 'chats' },
  { to: '/friends', label: 'Friends', icon: Users, badgeKey: 'friends' },
  { to: '/profile', label: 'Profile', icon: User }
];

function useElapsed(startedAt) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!startedAt) return;
    setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => clearInterval(id);
  }, [startedAt]);
  const mins = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const secs = String(elapsed % 60).padStart(2, '0');
  return `${mins}:${secs}`;
}

/**
 * Nav badges: unread chats + pending friend requests. The chat screen already
 * knows its own unread count and passes it in (`unreadCount`) so the badge
 * updates live; every other screen computes it once on mount.
 */
function useNavBadges(unreadOverride) {
  const [chats, setChats] = useState(0);
  const [friends, setFriends] = useState(0);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    let cancelled = false;
    getFriendRequests(token)
      .then((r) => !cancelled && setFriends(r.incoming?.length || 0))
      .catch(() => {});
    if (unreadOverride === undefined) {
      getConversations(token)
        .then((list) => !cancelled && setChats(list.filter(isUnread).length))
        .catch(() => {});
    }
    return () => { cancelled = true; };
  }, [unreadOverride]);

  // Pages other than Chats: bump the badge when a message arrives.
  useEffect(() => {
    if (unreadOverride !== undefined) return;
    const socket = getSocket();
    const bump = (msg) => {
      const me = getStoredUser();
      if (msg.sender !== me?.id) setChats((n) => n + 1);
    };
    socket.on('message:new', bump);
    return () => socket.off('message:new', bump);
  }, [unreadOverride]);

  return { chats: unreadOverride !== undefined ? unreadOverride : chats, friends };
}

export default function AppShell({ children, fullHeight = false, hideMobileNav = false, unreadCount }) {
  const user = getStoredUser();
  const navigate = useNavigate();
  const { callState, startedAt, openCallScreen } = useCall();
  const duration = useElapsed(startedAt);
  const onCall = callState === 'connected';
  const badges = useNavBadges(unreadCount);

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setMenuOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const handleLogout = () => {
    disconnectSocket();
    clearSession();
    window.location.href = '/';
  };

  const navLinks = (variant) =>
    NAV_ITEMS.map(({ to, label, icon: Icon, badgeKey }) => {
      const count = badgeKey ? badges[badgeKey] : 0;
      return (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) => `${variant}-link${isActive ? ` ${variant}-link--active` : ''}`}
        >
          {variant === 'dock' && <Icon size={19} strokeWidth={2} />}
          <span>{label}</span>
          {count > 0 && <span className="count-badge">{count > 99 ? '99+' : count}</span>}
        </NavLink>
      );
    });

  return (
    <div className={`app-shell${fullHeight ? ' app-shell--full' : ''}${hideMobileNav ? ' app-shell--no-dock' : ''}`}>
      <header className="app-shell__topbar">
        <Link to="/chat" className="app-shell__logo">AEONIS</Link>

        <nav className="app-shell__nav" aria-label="Main">{navLinks('nav')}</nav>

        <div className="app-shell__right">
          {onCall && (
            <button className="app-shell__call-indicator" onClick={openCallScreen} title="On a call — tap to return">
              <Phone size={15} />
              <span>{startedAt ? duration : '···'}</span>
            </button>
          )}

          <div className="app-shell__user" ref={menuRef}>
            <button
              className="app-shell__user-btn"
              onClick={() => setMenuOpen((o) => !o)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
            >
              <Avatar seed={user?.avatarSeed || 'fox'} size={34} online />
              <span className="app-shell__user-name">{user?.name || 'You'}</span>
              <ChevronDown size={16} className={`app-shell__chevron${menuOpen ? ' app-shell__chevron--open' : ''}`} />
            </button>

            {menuOpen && (
              <div className="app-shell__menu" role="menu">
                <div className="app-shell__menu-head">
                  <strong>{user?.name}</strong>
                  <span>{user?.email}</span>
                </div>
                <button role="menuitem" onClick={() => { setMenuOpen(false); navigate('/profile'); }}>
                  <User size={16} /> Profile
                </button>
                <button role="menuitem" className="app-shell__menu-danger" onClick={handleLogout}>
                  <LogOut size={16} /> Log out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="app-shell__main">{children}</main>

      {/* Phones: floating pill dock, like the reference design. */}
      <nav className="dock" aria-label="Main">{navLinks('dock')}</nav>
    </div>
  );
}
