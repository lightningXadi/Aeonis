import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import AuthLayout from '../components/AuthLayout';
import '../components/AuthForm.css';
import { login, googleAuth } from '../api/client';
import { setSession, isLoggedIn } from '../context/auth';
import useGoogleSignIn from '../hooks/useGoogleSignIn';

export default function Login() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
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

    if (!/\S+@\S+\.\S+/.test(form.email)) return setError('Please enter a valid email.');
    if (!form.password) return setError('Please enter your password.');

    setLoading(true);
    try {
      const { token, user } = await login(form);
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
      title="Re-enter Aeonis"
      subtitle="Good to see you again."
      footer={<>New here? <Link to="/signup">Join Aeonis</Link></>}
    >
      <form className="auth-form" onSubmit={handleSubmit}>
        {error && <div className="auth-error">{error}</div>}

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
            placeholder="Your password"
            value={form.password}
            onChange={update('password')}
            autoComplete="current-password"
          />
        </div>

        <button className="auth-submit" type="submit" disabled={loading}>
          {loading ? 'Signing you in…' : 'Re-enter Aeonis'}
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
