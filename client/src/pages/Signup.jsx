import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import AuthLayout from '../components/AuthLayout';
import '../components/AuthForm.css';
import { signup, googleAuth } from '../api/client';
import { setSession, isLoggedIn } from '../context/auth';
import useGoogleSignIn from '../hooks/useGoogleSignIn';

export default function Signup() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleGoogleCredential = async (credential) => {
    setError('');
    try {
      const { token, user } = await googleAuth(credential);
      setSession(token, user);
      navigate('/chat', { replace: true });
    } catch (err) {
      setError(err.message);
    }
  };
  const googleButtonRef = useGoogleSignIn(handleGoogleCredential);

  useEffect(() => {
    if (isLoggedIn()) navigate('/chat', { replace: true });
  }, [navigate]);

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (form.name.trim().length < 2) return setError('Please enter your name.');
    if (!/\S+@\S+\.\S+/.test(form.email)) return setError('Please enter a valid email.');
    if (form.password.length < 6) return setError('Password must be at least 6 characters.');

    setLoading(true);
    try {
      const { token, user } = await signup(form);
      setSession(token, user);
      navigate('/chat', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      eyebrow="MESSAGING & CALLING"
      title="Join Aeonis"
      subtitle="One quiet place for the people you keep close."
      footer={<>Already have an account? <Link to="/login">Re-enter Aeonis</Link></>}
    >
      <form className="auth-form" onSubmit={handleSubmit}>
        {error && <div className="auth-error">{error}</div>}

        <div className="auth-field">
          <label htmlFor="name">Name</label>
          <input
            id="name"
            type="text"
            placeholder="Your name"
            value={form.name}
            onChange={update('name')}
            autoComplete="name"
          />
        </div>

        <div className="auth-field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            placeholder="you@example.com"
            value={form.email}
            onChange={update('email')}
            autoComplete="email"
          />
        </div>

        <div className="auth-field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            placeholder="At least 6 characters"
            value={form.password}
            onChange={update('password')}
            autoComplete="new-password"
          />
        </div>

        <button className="auth-submit" type="submit" disabled={loading}>
          {loading ? 'Creating your account…' : 'Join Aeonis'}
        </button>
      </form>

      <div className="auth-divider">or</div>
      {import.meta.env.VITE_GOOGLE_CLIENT_ID ? (
        <div ref={googleButtonRef} className="auth-google-btn-mount" />
      ) : (
        <button
          type="button"
          className="auth-google-btn"
          onClick={() => setError('Google sign-in needs a Client ID configured on the server first — coming once that\'s set up.')}
        >
          Continue with Google
        </button>
      )}
    </AuthLayout>
  );
}
