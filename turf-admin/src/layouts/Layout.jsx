import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard, CalendarDays, Grid3X3, ScanLine,
  LogOut, ChevronDown, Menu, X, Building2
} from 'lucide-react';

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

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const sidebarContent = (
    <div style={{
      width: 240, height: '100%', display: 'flex', flexDirection: 'column',
      borderRight: '1px solid var(--border)', background: 'rgba(10,14,26,0.95)',
      backdropFilter: 'blur(20px)',
    }}>
      {/* Logo */}
      <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 22 }}>🏟️</span>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--primary)', lineHeight: 1.1 }}>turf11</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '1px' }}>OWNER PANEL</div>
          </div>
        </div>
      </div>

      {/* Turf Selector */}
      {turfs.length > 0 && (
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '1px' }}>
            Active Turf
          </div>
          <div
            style={{
              background: 'var(--bg-glass)', border: '1px solid var(--border)', borderRadius: 10,
              padding: '10px 12px', cursor: turfs.length > 1 ? 'pointer' : 'default',
              position: 'relative',
            }}
            onClick={() => turfs.length > 1 && setTurfDropdown(p => !p)}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Building2 size={14} color="var(--primary)" />
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                  {selectedTurf?.name || 'Select Turf'}
                </span>
              </div>
              {turfs.length > 1 && <ChevronDown size={14} color="var(--text-muted)" />}
            </div>
            {turfDropdown && turfs.length > 1 && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
                background: 'var(--bg-alt)', border: '1px solid var(--border)', borderRadius: 10,
                marginTop: 4, overflow: 'hidden', boxShadow: 'var(--shadow)',
              }}>
                {turfs.map(t => (
                  <div
                    key={t.id}
                    onClick={(e) => { e.stopPropagation(); switchTurf(t); setTurfDropdown(false); }}
                    style={{
                      padding: '10px 14px', fontSize: 13, cursor: 'pointer',
                      background: selectedTurf?.id === t.id ? 'rgba(0,212,170,0.1)' : 'transparent',
                      color: selectedTurf?.id === t.id ? 'var(--primary)' : 'var(--text)',
                      borderBottom: '1px solid var(--border)',
                    }}
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
      <nav style={{ flex: 1, padding: '16px 12px', overflowY: 'auto' }}>
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={() => setMobileOpen(false)}
            style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px',
              borderRadius: 10, marginBottom: 4, fontSize: 14, fontWeight: 500,
              textDecoration: 'none', transition: 'all 0.15s',
              background: isActive ? 'rgba(0,212,170,0.1)' : 'transparent',
              color: isActive ? 'var(--primary)' : 'var(--text-secondary)',
              borderLeft: isActive ? '3px solid var(--primary)' : '3px solid transparent',
            })}
          >
            <Icon size={17} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* User + Logout */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--primary), var(--primary-dark))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, fontWeight: 700, color: '#000', flexShrink: 0,
          }}>
            {user?.name?.[0]?.toUpperCase() || 'O'}
          </div>
          <div style={{ overflow: 'hidden' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }} className="truncate">
              {user?.name}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }} className="truncate">
              {user?.email}
            </div>
          </div>
        </div>
        <button className="btn btn-ghost" style={{ width: '100%', justifyContent: 'center' }} onClick={handleLogout}>
          <LogOut size={14} /> Logout
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Desktop Sidebar */}
      <div style={{ display: 'none', position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 100 }}
           className="desktop-sidebar">
        {sidebarContent}
      </div>

      {/* Mobile: top bar */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, height: 56, zIndex: 200,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 16px', background: 'rgba(10,14,26,0.95)', backdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--border)',
      }} className="mobile-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18 }}>🏟️</span>
          <span style={{ fontWeight: 800, fontSize: 15, color: 'var(--primary)' }}>turf11 Owner</span>
        </div>
        <button
          onClick={() => setMobileOpen(p => !p)}
          style={{ background: 'none', border: 'none', color: 'var(--text)', padding: 6 }}
        >
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Mobile Sidebar Overlay */}
      {mobileOpen && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 150 }}
            onClick={() => setMobileOpen(false)}
          />
          <div style={{
            position: 'fixed', top: 56, left: 0, bottom: 0, width: 260, zIndex: 160,
            animation: 'slideIn 0.25s ease',
          }}>
            {sidebarContent}
          </div>
        </>
      )}

      {/* Main Content */}
      <main style={{
        flex: 1,
        marginLeft: 240,
        minHeight: '100vh',
        padding: '32px',
        maxWidth: '100%',
      }} className="main-content">
        <Outlet />
      </main>

      {/* Responsive: inject styles */}
      <style>{`
        @media (max-width: 900px) {
          .desktop-sidebar { display: none !important; }
          .mobile-header { display: flex !important; }
          .main-content { margin-left: 0 !important; padding: 76px 16px 24px !important; }
        }
        @media (min-width: 901px) {
          .desktop-sidebar { display: block !important; }
          .mobile-header { display: none !important; }
        }
      `}</style>
    </div>
  );
}
