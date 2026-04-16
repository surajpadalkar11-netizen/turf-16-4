import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard, CalendarDays, Grid3X3, ScanLine,
  LogOut, ChevronDown, Menu, X, Building2,
} from 'lucide-react';
import styles from './Layout.module.css';

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/bookings', label: 'Bookings', icon: CalendarDays },
  { to: '/slots', label: 'Slot Manager', icon: Grid3X3 },
  { to: '/scanner', label: 'QR Scanner', icon: ScanLine },
];

export default function Layout() {
  const { user, turfs, selectedTurf, logout, switchTurf } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [turfDropdown, setTurfDropdown] = useState(false);

  // Close mobile menu on resize to desktop
  useEffect(() => {
    const onResize = () => { if (window.innerWidth >= 900) setMobileOpen(false); };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Prevent body scroll when mobile menu open
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const SidebarContent = () => (
    <div className={styles.sidebar}>
      {/* Logo */}
      <div className={styles.sidebarHeader}>
        <div className={styles.logo}>
          <div className={styles.logoIcon}>
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <rect width="28" height="28" rx="8" fill="url(#adminGrad)" />
              <text x="14" y="20" textAnchor="middle" fontSize="14" fill="white" fontWeight="800" fontFamily="system-ui">11</text>
              <defs>
                <linearGradient id="adminGrad" x1="0" y1="0" x2="28" y2="28">
                  <stop offset="0%" stopColor="#00d4aa" />
                  <stop offset="100%" stopColor="#00a884" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <div>
            <div className={styles.logoName}>turf11</div>
            <div className={styles.logoTag}>OWNER PANEL</div>
          </div>
        </div>
      </div>

      {/* Turf Selector */}
      {turfs.length > 0 && (
        <div className={styles.turfSelector}>
          <div className={styles.turfSelectorLabel}>Active Turf</div>
          <div
            className={styles.turfDropdownTrigger}
            style={{ cursor: turfs.length > 1 ? 'pointer' : 'default' }}
            onClick={() => turfs.length > 1 && setTurfDropdown(p => !p)}
          >
            <div className={styles.turfDropdownRow}>
              <Building2 size={14} color="var(--primary)" />
              <span className={styles.turfName}>{selectedTurf?.name || 'Select Turf'}</span>
            </div>
            {turfs.length > 1 && (
              <ChevronDown size={14} color="var(--text-muted)"
                style={{ transform: turfDropdown ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
            )}
            {turfDropdown && turfs.length > 1 && (
              <div className={styles.turfMenu}>
                {turfs.map(t => (
                  <div
                    key={t.id}
                    className={styles.turfMenuItem}
                    data-active={selectedTurf?.id === t.id}
                    onClick={e => { e.stopPropagation(); switchTurf(t); setTurfDropdown(false); }}
                  >
                    {t.name}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className={styles.nav}>
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) => `${styles.navLink} ${isActive ? styles.navLinkActive : ''}`}
          >
            <Icon size={18} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* User footer */}
      <div className={styles.sidebarFooter}>
        <div className={styles.userInfo}>
          <div className={styles.avatar}>
            {user?.name?.[0]?.toUpperCase() || 'O'}
          </div>
          <div className={styles.userText}>
            <div className={styles.userName}>{user?.name}</div>
            <div className={styles.userEmail}>{user?.email}</div>
          </div>
        </div>
        <button className={`btn btn-ghost ${styles.logoutBtn}`} onClick={handleLogout}>
          <LogOut size={14} /> Logout
        </button>
      </div>
    </div>
  );

  return (
    <div className={styles.layout}>
      {/* Desktop sidebar */}
      <aside className={styles.desktopSidebar}>
        <SidebarContent />
      </aside>

      {/* Mobile top bar */}
      <header className={styles.mobileHeader}>
        <span className={styles.mobileLogoText}>turf11 Owner</span>
        <button
          className={styles.menuBtn}
          onClick={() => setMobileOpen(p => !p)}
          aria-label="Toggle navigation menu"
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </header>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <>
          <div className={styles.mobileOverlay} onClick={() => setMobileOpen(false)} />
          <aside className={styles.mobileSidebar}>
            <SidebarContent />
          </aside>
        </>
      )}

      {/* Main content */}
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}
