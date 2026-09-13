import { NavLink } from 'react-router-dom';
import Avatar from './Avatar';
import { getStoredUser, clearSession } from '../context/auth';
import { disconnectSocket } from '../socket';
import { useCall } from '../context/CallContext';
import './AppShell.css';

const NAV_ITEMS = [
  { to: '/chat', label: 'Chats' },
  { to: '/friends', label: 'Friends' },
  { to: '/profile', label: 'Profile' }
];

export default function AppShell({ children }) {
  const user = getStoredUser();
  const { callState } = useCall();

  const handleLogout = () => {
    disconnectSocket();
    clearSession();
    window.location.href = '/';
  };

  return (
    <div className={`app-shell${callState === 'connected' ? ' app-shell--call-active' : ''}`}>
      <header className="app-shell__topbar">
        <span className="app-shell__logo">AEONIS</span>

        <nav className="app-shell__nav">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `app-shell__nav-link${isActive ? ' app-shell__nav-link--active' : ''}`}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="app-shell__user">
          <Avatar seed={user?.avatarSeed || 'fox'} size={34} online />
          <span className="app-shell__user-name">{user?.name || 'You'}</span>
          <button className="app-shell__logout" onClick={handleLogout}>Log out</button>
        </div>
      </header>

      <main className="app-shell__main">{children}</main>
    </div>
  );
}
