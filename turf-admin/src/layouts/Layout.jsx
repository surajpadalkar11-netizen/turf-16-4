import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard, CalendarDays, Grid3X3, ScanLine,
  LogOut, ChevronDown, Menu, X, Building2, Users,
  ShieldCheck, Settings as SettingsIcon, Wallet, DollarSign,
} from 'lucide-react';
import styles from './Layout.module.css';

const OWNER_NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/bookings', label: 'Bookings', icon: CalendarDays },
  { to: '/slots', label: 'Slot Manager', icon: Grid3X3 },
  { to: '/earnings', label: 'Earnings', icon: DollarSign },
  { to: '/scanner', label: 'QR Scanner', icon: ScanLine },
  { to: '/supervisors', label: 'Supervisors', icon: Users },
];

const SUPERVISOR_NAV = [
  { to: '/', label: 'Today\'s View', icon: LayoutDashboard, end: true },
  { to: '/scanner', label: 'QR Scanner', icon: ScanLine },
];

export default function Layout() {
  const { user, turfs, selectedTurf, logout, switchTurf, isSupervisor } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [turfDropdown, setTurfDropdown] = useState(false);

  const NAV = isSupervisor ? SUPERVISOR_NAV : OWNER_NAV;

  useEffect(() => {
    const onResize = () => { if (window.innerWidth >= 900) setMobileOpen(false); };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

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
          <div className={styles.logoIcon}>⛳</div>
          <div>
            <div className={styles.logoName}>turf11</div>
            <div className={styles.logoTag}>
              {isSupervisor ? 'Supervisor' : 'Owner Panel'}
            </div>
          </div>
        </div>
      </div>

      {/* Supervisor badge */}
      {isSupervisor && (
        <div className={styles.supervisorStrip}>
          <ShieldCheck size={13} />
          <span>Read-only Supervisor</span>
        </div>
      )}

      {/* Turf Selector */}
      {turfs.length > 0 && (
        <div className={styles.turfSelector}>
          <div className={styles.turfSelectorLabel}>Active Turf</div>
          <div
            className={styles.turfDropdownTrigger}
            style={{ cursor: (!isSupervisor && turfs.length > 1) ? 'pointer' : 'default' }}
            onClick={() => !isSupervisor && turfs.length > 1 && setTurfDropdown(p => !p)}
          >
            <div className={styles.turfDropdownRow}>
              <Building2 size={13} color="var(--primary)" />
              <span className={styles.turfName}>{selectedTurf?.name || 'Select Turf'}</span>
            </div>
            {!isSupervisor && turfs.length > 1 && (
              <ChevronDown size={13} color="var(--text-muted)"
                style={{ transform: turfDropdown ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }} />
            )}
            {turfDropdown && !isSupervisor && turfs.length > 1 && (
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
            <Icon size={17} />
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
            <div className={styles.userRole}>
              {isSupervisor ? 'Supervisor' : 'Owner'}
            </div>
          </div>
        </div>
        <button className={`btn btn-ghost ${styles.logoutBtn}`} onClick={handleLogout}>
          <LogOut size={13} /> Sign Out
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
        <div className={styles.mobileLogoWrap}>
          <div style={{ width: 28, height: 28, background: 'linear-gradient(135deg, var(--primary), var(--primary-dark))', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>⛳</div>
          <div>
            <div className={styles.mobileLogoText}>turf11</div>
          </div>
        </div>
        <button
          className={styles.menuBtn}
          onClick={() => setMobileOpen(p => !p)}
          aria-label="Toggle menu"
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </header>

      {/* Mobile drawer */}
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
