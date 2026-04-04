import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import styles from './Navbar.module.css';

function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close mobile menu on route change
  useEffect(() => setMenuOpen(false), [location]);

  // Prevent body scroll when menu is open
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);

  const handleLogout = () => {
    logout();
    navigate('/');
    setMenuOpen(false);
  };

  const isActive = (path) => location.pathname === path ? styles.active : '';

  return (
    <nav className={`${styles.navbar} ${scrolled ? styles.scrolled : ''}`} id="main-navbar">
      <div className={styles.container}>
        <Link to="/" className={styles.logo}>
          <span className={styles.logoIcon}>
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="28" height="28" rx="8" fill="url(#navGrad)"/>
              <text x="14" y="20" textAnchor="middle" fontSize="16" fill="white" fontWeight="800" fontFamily="system-ui">11</text>
              <defs>
                <linearGradient id="navGrad" x1="0" y1="0" x2="28" y2="28">
                  <stop offset="0%" stopColor="#059669"/>
                  <stop offset="100%" stopColor="#065f46"/>
                </linearGradient>
              </defs>
            </svg>
          </span>
          <span>turf<span className={styles.highlight}>11</span></span>
        </Link>

        <div className={styles.navLinks}>
          <Link to="/search" className={`${styles.navLink} ${isActive('/search')}`}>Explore</Link>
          {user && <Link to="/dashboard" className={`${styles.navLink} ${isActive('/dashboard')}`}>My Bookings</Link>}
          {user?.role === 'admin' && <Link to="/admin" className={`${styles.navLink} ${isActive('/admin')}`}>Admin</Link>}
        </div>

        <div className={styles.navRight}>
          {user ? (
            <div className={styles.userMenu}>
              <button className={styles.avatarBtn} onClick={() => setMenuOpen(!menuOpen)} id="user-menu-btn">
                {user.avatar ? (
                  <img src={user.avatar} alt={user.name} className={styles.avatarImg} />
                ) : (
                  <span className={styles.avatarCircle}>{user.name?.charAt(0).toUpperCase()}</span>
                )}
                <span className={styles.userName}>{user.name}</span>
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" style={{ opacity: 0.5, transition: 'transform 0.2s', transform: menuOpen ? 'rotate(180deg)' : 'rotate(0)' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {menuOpen && (
                <div className={styles.dropdown}>
                  <Link to="/profile" className={styles.dropItem} onClick={() => setMenuOpen(false)}>👤 Profile</Link>
                  <Link to="/dashboard" className={styles.dropItem} onClick={() => setMenuOpen(false)}>📅 My Bookings</Link>
                  {user?.role === 'admin' && <Link to="/admin" className={styles.dropItem} onClick={() => setMenuOpen(false)}>⚙️ Admin Panel</Link>}
                  <button className={styles.dropItem} onClick={handleLogout} style={{ color: '#f43f5e' }}>🚪 Logout</button>
                </div>
              )}
            </div>
          ) : (
            <div className={styles.authBtns}>
              <Link to="/login" className={styles.loginBtn}>Sign In</Link>
              <Link to="/register" className={styles.registerBtn}>Sign Up</Link>
            </div>
          )}

          <button
            className={`${styles.hamburger} ${menuOpen ? styles.open : ''}`}
            onClick={() => setMenuOpen(!menuOpen)}
            id="mobile-menu-btn"
            aria-label="Toggle menu"
            aria-expanded={menuOpen}
          >
            <span></span><span></span><span></span>
          </button>
        </div>

        {/* Mobile overlay */}
        {menuOpen && <div className={styles.mobileOverlay} onClick={() => setMenuOpen(false)} />}

        {menuOpen && (
          <div className={styles.mobileMenu}>
            <Link to="/search" className={styles.mobileLink} onClick={() => setMenuOpen(false)}>🔍 Explore</Link>
            {user && <Link to="/dashboard" className={styles.mobileLink} onClick={() => setMenuOpen(false)}>📅 My Bookings</Link>}
            {user?.role === 'admin' && <Link to="/admin" className={styles.mobileLink} onClick={() => setMenuOpen(false)}>⚙️ Admin</Link>}
            {!user && <>
              <Link to="/login" className={styles.mobileLink} onClick={() => setMenuOpen(false)}>🔑 Sign In</Link>
              <Link to="/register" className={styles.mobileLink} onClick={() => setMenuOpen(false)}>✨ Sign Up</Link>
            </>}
            {user && <Link to="/profile" className={styles.mobileLink} onClick={() => setMenuOpen(false)}>👤 Profile</Link>}
            {user && <button className={styles.mobileLink} onClick={handleLogout} style={{ color: '#f43f5e' }}>🚪 Logout</button>}
          </div>
        )}
      </div>
    </nav>
  );
}

export default Navbar;
