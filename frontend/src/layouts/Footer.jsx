import { Link } from 'react-router-dom';
import styles from './Footer.module.css';

function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.container}>
        <div className={styles.grid}>
          <div className={styles.brand}>
            <div className={styles.logo}>
              <svg width="24" height="24" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: '6px', flexShrink: 0 }}>
                <rect width="28" height="28" rx="8" fill="url(#footGrad)"/>
                <text x="14" y="20" textAnchor="middle" fontSize="16" fill="white" fontWeight="800" fontFamily="system-ui">11</text>
                <defs>
                  <linearGradient id="footGrad" x1="0" y1="0" x2="28" y2="28">
                    <stop offset="0%" stopColor="#059669"/>
                    <stop offset="100%" stopColor="#065f46"/>
                  </linearGradient>
                </defs>
              </svg>
              <span>turf11</span>
            </div>
            <p className={styles.tagline}>Find and book the best sports turfs near you. Play your favorite sport anytime.</p>
          </div>
          <div className={styles.links}>
            <h4>Quick Links</h4>
            <Link to="/search">Explore Turfs</Link>
            <Link to="/login">Sign In</Link>
            <Link to="/register">Create Account</Link>
          </div>
          <div className={styles.links}>
            <h4>Sports</h4>
            <Link to="/search?sport=cricket">Cricket</Link>
            <Link to="/search?sport=football">Football</Link>
            <Link to="/search?sport=badminton">Badminton</Link>
            <Link to="/search?sport=tennis">Tennis</Link>
          </div>
          <div className={styles.links}>
            <h4>Support</h4>
            <a href="#">Help Center</a>
            <a href="#">Terms of Service</a>
            <a href="#">Privacy Policy</a>
            <a href="#">Contact Us</a>
          </div>
        </div>
        <div className={styles.bottom}>
          <p>&copy; {new Date().getFullYear()} turf11. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
