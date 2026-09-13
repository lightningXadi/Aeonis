import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import GridBackdrop from '../components/GridBackdrop';
import HeroButton from '../components/HeroButton';
import InstallAppButton from '../components/InstallAppButton';
import { isLoggedIn } from '../context/auth';
import './Landing.css';

export default function Landing() {
  const navigate = useNavigate();
  const [checkingSession, setCheckingSession] = useState(true);

  // If a session already exists, skip the landing page entirely and go
  // straight to the chat area — landing is only for logged-out visitors.
  useEffect(() => {
    if (isLoggedIn()) {
      navigate('/chat', { replace: true });
      return;
    }
    setCheckingSession(false);
  }, [navigate]);

  if (checkingSession) return null; // avoid a landing-page flash before redirect

  return (
    <div className="landing">
      <GridBackdrop />

      <header className="landing__nav">
        <div className="landing__logo">AEONIS</div>
        <nav className="landing__nav-actions">
          <Link to="/login" className="landing__nav-link">Log In</Link>
          <Link to="/signup" className="landing__nav-link landing__nav-link--filled">Sign Up</Link>
        </nav>
      </header>

      <section className="landing__hero">
        <div className="landing__hero-content">
          <span className="landing__eyebrow">MESSAGING &amp; CALLING</span>
          <h1 className="landing__headline">
            One quiet place<br />for the people<br />you keep close.
          </h1>
          <p className="landing__subtext">
            Aeonis brings chat, groups, and voice calls together —
            built to feel calm, not crowded.
          </p>

          <div className="landing__cta-row">
            <HeroButton
              label="Join Aeonis"
              variant="primary"
              animated
              onClick={() => navigate('/signup')}
            />
            <HeroButton
              label="Re-enter Aeonis"
              variant="secondary"
              onClick={() => navigate('/login')}
            />
          </div>

          <div className="landing__install-row">
            <InstallAppButton />
          </div>
        </div>
      </section>

      <footer className="landing__footer">
        <span>© {new Date().getFullYear()} Aeonis</span>
      </footer>
    </div>
  );
}
