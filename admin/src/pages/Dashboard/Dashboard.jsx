import { useState, useEffect } from 'react';
import { getStats } from '../../services/statsService';
import './Dashboard.css';

const fmt = (n) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

const fmtDate = (d) =>
  new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

const STATUS_COLORS = {
  confirmed: '#059669',
  pending:   '#f59e0b',
  completed: '#3b82f6',
  cancelled: '#ef4444',
};

export default function Dashboard() {
  const [stats, setStats]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange]   = useState('all');

  useEffect(() => { load(); }, [range]);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await getStats(range);
      setStats(data.stats);
    } catch (e) {
      console.error('Dashboard load error:', e);
    } finally {
      setLoading(false);
    }
  };

  const todayStr = new Date().toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  // ── Core stat cards ──────────────────────────────────────────────────────
  const coreCards = [
    { label: 'Total Revenue',     value: fmt(stats?.totalRevenue || 0),    icon: '💰', color: '#059669', bg: 'rgba(5,150,105,0.1)' },
    { label: 'Total Bookings',    value: stats?.totalBookings ?? 0,         icon: '📋', color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
    { label: 'Active Turfs',      value: stats?.totalTurfs ?? 0,            icon: '🏟️', color: '#06b6d4', bg: 'rgba(6,182,212,0.1)' },
    { label: 'Registered Users',  value: stats?.totalUsers ?? 0,            icon: '👥', color: '#f97316', bg: 'rgba(249,115,22,0.1)' },
  ];

  // ── Wallet flow cards (the money story) ──────────────────────────────────
  const walletCards = [
    {
      label:    'Total Loaded by Users',
      sublabel: 'All wallet top-ups received',
      value:    fmt(stats?.walletLoadedByUsers || 0),
      icon:     '📥',
      color:    '#6366f1',
      bg:       'rgba(99,102,241,0.08)',
      border:   'rgba(99,102,241,0.25)',
    },
    {
      label:    'Users Current Balance',
      sublabel: 'Still in user wallets (unspent)',
      value:    fmt(stats?.currentUserWalletBalances || 0),
      icon:     '👛',
      color:    '#0891b2',
      bg:       'rgba(8,145,178,0.08)',
      border:   'rgba(8,145,178,0.25)',
    },
    {
      label:    'Spent on Bookings',
      sublabel: 'Wallet debited for bookings',
      value:    fmt(stats?.totalWalletSpentOnBookings || 0),
      icon:     '🎯',
      color:    '#7c3aed',
      bg:       'rgba(124,58,237,0.08)',
      border:   'rgba(124,58,237,0.25)',
    },
    {
      label:    'Admin Holds (Net)',
      sublabel: 'Spent − paid out (must pay owners)',
      value:    fmt(stats?.adminWalletBalance || 0),
      icon:     '🏦',
      color:    '#059669',
      bg:       'rgba(5,150,105,0.08)',
      border:   'rgba(5,150,105,0.25)',
      highlight: true,
    },
    {
      label:    'Pending Payouts',
      sublabel: 'Owed to turf owners',
      value:    fmt(stats?.totalPendingPayouts || 0),
      icon:     '⏳',
      color:    '#f59e0b',
      bg:       'rgba(245,158,11,0.08)',
      border:   'rgba(245,158,11,0.25)',
    },
    {
      label:    'Paid Out to Owners',
      sublabel: 'Already transferred',
      value:    fmt(stats?.totalPaidOutToOwners || 0),
      icon:     '✅',
      color:    '#10b981',
      bg:       'rgba(16,185,129,0.08)',
      border:   'rgba(16,185,129,0.25)',
    },
  ];

  const totalBookings = stats?.totalBookings || 1;

  if (loading) {
    return (
      <div className="animate-fade">
        <div className="db-header">
          <div className="db-header-left">
            <h1>Dashboard</h1>
            <span className="db-date">📅 {todayStr}</span>
          </div>
        </div>
        <div className="db-skeleton-grid">
          {[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height: 90, borderRadius: 16 }} />)}
        </div>
        <div className="skeleton" style={{ height: 32, borderRadius: 8, margin: '28px 0 16px', width: 200 }} />
        <div className="db-wallet-grid">
          {[1,2,3,4,5,6].map(i => <div key={i} className="skeleton" style={{ height: 100, borderRadius: 16 }} />)}
        </div>
        <div className="db-grid" style={{ marginTop: 24 }}>
          <div className="skeleton" style={{ height: 280, borderRadius: 16 }} />
          <div className="skeleton" style={{ height: 280, borderRadius: 16 }} />
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade">
      {/* ── Header ─────────────────────────────────────── */}
      <div className="db-header">
        <div className="db-header-left">
          <h1>Dashboard</h1>
          <span className="db-date">📅 {todayStr}</span>
        </div>
        <select className="db-filter-select" value={range} onChange={(e) => setRange(e.target.value)}>
          <option value="today">Today</option>
          <option value="month">This Month</option>
          <option value="all">All Time</option>
        </select>
      </div>

      {/* ── Core Stats (4 cards) ────────────────────────── */}
      <div className="db-stats-grid">
        {coreCards.map((c, i) => (
          <div key={i} className="db-stat-card" style={{ animationDelay: `${i * 0.07}s` }}>
            <div className="db-stat-icon" style={{ background: c.bg, color: c.color }}>{c.icon}</div>
            <div className="db-stat-body">
              <div className="db-stat-value">{c.value}</div>
              <div className="db-stat-label">{c.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Wallet Financial Breakdown ──────────────────── */}
      <div className="db-section-header">
        <span className="db-section-title">💳 Wallet Financial Breakdown</span>
        <span className="db-section-sub">How money flows through the wallet system</span>
      </div>

      <div className="db-wallet-grid">
        {walletCards.map((c, i) => (
          <div
            key={i}
            className={`db-wallet-card${c.highlight ? ' db-wallet-card--highlight' : ''}`}
            style={{
              '--wc-color':  c.color,
              '--wc-bg':     c.bg,
              '--wc-border': c.border,
              animationDelay: `${i * 0.06}s`,
            }}
          >
            <div className="db-wc-top">
              <span className="db-wc-icon">{c.icon}</span>
              <div className="db-wc-value">{c.value}</div>
            </div>
            <div className="db-wc-label">{c.label}</div>
            <div className="db-wc-sub">{c.sublabel}</div>
          </div>
        ))}
      </div>

      {/* ── Booking Status + Recent Bookings ────────────── */}
      <div className="db-grid">
        <div className="db-card">
          <div className="db-card-header">
            <h3 className="db-card-title">Booking Status</h3>
            <span className="db-card-sub">Overview</span>
          </div>
          <div className="db-status-list">
            {['confirmed', 'pending', 'completed', 'cancelled'].map((s) => {
              const count = stats?.bookingsByStatus?.[s] || 0;
              const pct   = Math.round((count / totalBookings) * 100);
              return (
                <div key={s}>
                  <div className="db-status-row-top">
                    <span className="db-status-name">{s}</span>
                    <span className="db-status-count">{count}<span className="db-status-pct"> ({pct}%)</span></span>
                  </div>
                  <div className="db-track">
                    <div className="db-fill" style={{ width: `${pct}%`, background: STATUS_COLORS[s] }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="db-card">
          <div className="db-card-header">
            <h3 className="db-card-title">Recent Bookings</h3>
            <span className="db-card-sub">Latest 5</span>
          </div>
          <div className="db-recent-list">
            {(stats?.recentBookings || []).length === 0 ? (
              <div className="db-empty"><div className="db-empty-icon">📋</div>No recent bookings</div>
            ) : stats.recentBookings.map((b) => (
              <div key={b._id} className="db-recent-item">
                <div className="db-recent-info">
                  <div className="db-recent-name">{b.turf?.name || 'Unknown Turf'}</div>
                  <div className="db-recent-sub">{b.user?.name} · {fmtDate(b.date)}</div>
                </div>
                <div className="db-recent-right">
                  <span className={`badge badge-${b.status}`}>{b.status}</span>
                  <span className="db-recent-amount">{fmt(b.totalAmount)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Recent Users ────────────────────────────────── */}
      <div className="db-card" style={{ marginTop: 20 }}>
        <div className="db-card-header">
          <h3 className="db-card-title">Recent Registrations</h3>
          <span className="db-card-sub">Latest joined users</span>
        </div>
        <div className="db-recent-list">
          {(stats?.recentUsers || []).length === 0 ? (
            <div className="db-empty"><div className="db-empty-icon">👥</div>No recent registrations</div>
          ) : stats.recentUsers.map((u) => (
            <div key={u._id} className="db-recent-item">
              <div className="db-avatar">{(u.name || 'U').charAt(0).toUpperCase()}</div>
              <div className="db-recent-info">
                <div className="db-recent-name">{u.name}</div>
                <div className="db-recent-sub">{u.email}</div>
              </div>
              <div className="db-recent-right">
                <span className={`badge badge-${u.role}`}>{u.role}</span>
                <span className="db-recent-date">{fmtDate(u.created_at)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
