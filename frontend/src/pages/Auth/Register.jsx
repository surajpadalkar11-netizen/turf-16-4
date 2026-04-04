import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import AnimatedGrid from './AnimatedGrid';
import styles from './Auth.module.css';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

function Register() {
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const { register, googleLogin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from || '/';

  const update = (key, val) => setForm((prev) => ({ ...prev, [key]: val }));

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
      
      const btnContainer = document.getElementById('google-signup-btn');
      if (btnContainer) {
        window.google?.accounts.id.renderButton(btnContainer, {
          theme: 'outline',
          size: 'large',
          type: 'standard',
          shape: 'rectangular',
          text: 'signup_with',
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
    if (form.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    setLoading(true);
    try {
      await register(form.name, form.email, form.password, form.phone);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <AnimatedGrid />
      <div className={styles.card}>
        <h1 className={styles.title}>Create Account</h1>
        <p className={styles.subtitle}>Join turf11 and start booking</p>

        {error && <div className={styles.error}>{error}</div>}

        {/* Google Sign-In Button */}
        {googleLoading && <div className={styles.googleBtnLoaderWrap}><span className={styles.googleBtnLoader} /></div>}
        <div className={styles.googleBtnContainer} style={{ display: googleLoading ? 'none' : 'flex' }}>
          <div id="google-signup-btn" style={{ width: '100%' }}></div>
        </div>

        <div className={styles.orDivider}>
          <span className={styles.orLine} />
          <span className={styles.orText}>or</span>
          <span className={styles.orLine} />
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.field}>
            <label>Full Name</label>
            <input type="text" value={form.name} onChange={(e) => update('name', e.target.value)} placeholder="John Doe" required id="register-name" />
          </div>
          <div className={styles.field}>
            <label>Email</label>
            <input type="email" value={form.email} onChange={(e) => update('email', e.target.value)} placeholder="you@example.com" required id="register-email" />
          </div>
          <div className={styles.field}>
            <label>Phone <span className={styles.optional}>(optional)</span></label>
            <input type="tel" value={form.phone} onChange={(e) => update('phone', e.target.value)} placeholder="9876543210" id="register-phone" />
          </div>
          <div className={styles.field}>
            <label>Password</label>
            <input type="password" value={form.password} onChange={(e) => update('password', e.target.value)} placeholder="Min 6 characters" required id="register-password" />
          </div>
          <button type="submit" className={styles.submitBtn} disabled={loading || googleLoading} id="register-submit">
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <p className={styles.switch}>
          Already have an account? <Link to="/login" state={{ from }}>Sign In</Link>
        </p>
      </div>
    </div>
  );
}

export default Register;
