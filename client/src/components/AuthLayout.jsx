import { Link } from 'react-router-dom';
import GridBackdrop from './GridBackdrop';
import './AuthLayout.css';

export default function AuthLayout({ eyebrow, title, subtitle, children, footer }) {
  return (
    <div className="auth-layout">
      <GridBackdrop />

      <header className="auth-layout__nav">
        <Link to="/" className="auth-layout__logo">AEONIS</Link>
      </header>

      <main className="auth-layout__main">
        <div className="auth-card">
          {eyebrow && <span className="auth-card__eyebrow">{eyebrow}</span>}
          <h1 className="auth-card__title">{title}</h1>
          {subtitle && <p className="auth-card__subtitle">{subtitle}</p>}

          {children}

          {footer && <div className="auth-card__footer">{footer}</div>}
        </div>
      </main>
    </div>
  );
}
