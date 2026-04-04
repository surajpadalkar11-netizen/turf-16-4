import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import AnimatedGrid from './AnimatedGrid';
import styles from './Auth.module.css';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const { login, googleLogin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from || '/';

  const handleGoogleResponse = useCallback(async (response) => {
    setGoogleLoading(true);
    setError('');
    try {
      await googleLogin(response.credential);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || 'Google sign-in failed');
    } finally {
      setGoogleLoading(false);
    }
  }, [googleLogin, navigate, from]);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => {
      window.google?.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogleResponse,
      });
      
      const btnContainer = document.getElementById('google-signin-btn');
      if (btnContainer) {
        window.google?.accounts.id.renderButton(btnContainer, {
          theme: 'outline',
          size: 'large',
          type: 'standard',
          shape: 'rectangular',
          text: 'signin_with',
          logo_alignment: 'left',
          width: btnContainer.offsetWidth || 350
        });
      }
    };
    document.head.appendChild(script);
    return () => { document.head.removeChild(script); };
  }, [handleGoogleResponse]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <AnimatedGrid />
      <div className={styles.card}>
        <h1 className={styles.title}>Welcome Back</h1>
        <p className={styles.subtitle}>Sign in to your turf11 account</p>

        {error && <div className={styles.error}>{error}</div>}

        {/* Google Sign-In Button */}
        {googleLoading && <div className={styles.googleBtnLoaderWrap}><span className={styles.googleBtnLoader} /></div>}
        <div className={styles.googleBtnContainer} style={{ display: googleLoading ? 'none' : 'flex' }}>
          <div id="google-signin-btn" style={{ width: '100%' }}></div>
        </div>

        <div className={styles.orDivider}>
          <span className={styles.orLine} />
          <span className={styles.orText}>or</span>
          <span className={styles.orLine} />
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.field}>
            <label>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required id="login-email" />
          </div>
          <div className={styles.field}>
            <label>Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••" required id="login-password" />
          </div>
          <button type="submit" className={styles.submitBtn} disabled={loading || googleLoading} id="login-submit">
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p className={styles.switch}>
          Don't have an account? <Link to="/register" state={{ from }}>Create Account</Link>
        </p>
      </div>
    </div>
  );
}

export default Login;
