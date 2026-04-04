import { useState, useEffect } from 'react';
import { getStats } from '../../services/statsService';
import './Dashboard.css';

const formatPrice = (amount) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);

const formatDate = (date) =>
  new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const { data } = await getStats();
      setStats(data.stats);
    } catch (err) {
      console.error('Failed to load stats:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="animate-fade">
        <div className="page-header"><h1>Dashboard</h1></div>
        <div className="stats-grid">
          {[1, 2, 3, 4].map((i) => <div key={i} className="skeleton" style={{ height: 130, borderRadius: 14 }} />)}
        </div>
        <div className="skeleton" style={{ height: 300, borderRadius: 14, marginTop: 24 }} />
      </div>
    );
  }

  const statCards = [
    { label: 'Total Revenue', value: formatPrice(stats?.totalRevenue || 0), icon: '💰', color: 'var(--color-success)', bgColor: 'var(--color-success-light)' },
    { label: 'Total Bookings', value: stats?.totalBookings || 0, icon: '📋', color: 'var(--color-primary)', bgColor: 'var(--color-primary-light)' },
    { label: 'Active Turfs', value: stats?.totalTurfs || 0, icon: '🏟️', color: 'var(--color-info)', bgColor: 'var(--color-info-light)' },
    { label: 'Registered Users', value: stats?.totalUsers || 0, icon: '👥', color: 'var(--color-warning)', bgColor: 'var(--color-warning-light)' },
  ];

  return (
    <div className="animate-fade">
      <div className="page-header">
        <h1>Dashboard</h1>
        <span className="dashboard-date">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
      </div>

      <div className="stats-grid">
        {statCards.map((card, i) => (
          <div key={i} className="stat-card card" style={{ animationDelay: `${i * 0.08}s` }}>
            <div className="stat-icon" style={{ background: card.bgColor, color: card.color }}>{card.icon}</div>
            <div className="stat-info">
              <span className="stat-value">{card.value}</span>
              <span className="stat-label">{card.label}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="dashboard-grid">
        {/* Booking Status Breakdown */}
        <div className="card">
          <h3 className="card-title">Booking Status</h3>
          <div className="status-bars">
            {['confirmed', 'pending', 'completed', 'cancelled'].map((status) => {
              const count = stats?.bookingsByStatus?.[status] || 0;
              const total = stats?.totalBookings || 1;
              const pct = Math.round((count / total) * 100);
              const colors = {
                confirmed: 'var(--color-success)',
                pending: 'var(--color-warning)',
                completed: 'var(--color-primary)',
                cancelled: 'var(--color-danger)',
              };
              return (
                <div key={status} className="status-bar-item">
                  <div className="status-bar-header">
                    <span className="status-bar-label">{status}</span>
                    <span className="status-bar-count">{count} ({pct}%)</span>
                  </div>
                  <div className="status-bar-track">
                    <div className="status-bar-fill" style={{ width: `${pct}%`, background: colors[status] }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent Bookings */}
        <div className="card">
          <h3 className="card-title">Recent Bookings</h3>
          <div className="recent-list">
            {(stats?.recentBookings || []).map((b) => (
              <div key={b._id} className="recent-item">
                <div className="recent-item-info">
                  <strong>{b.turf?.name || 'Unknown Turf'}</strong>
                  <span>{b.user?.name} · {formatDate(b.date)}</span>
                </div>
                <div className="recent-item-right">
                  <span className={`badge badge-${b.status}`}>{b.status}</span>
                  <span className="recent-amount">{formatPrice(b.totalAmount)}</span>
                </div>
              </div>
            ))}
            {(!stats?.recentBookings || stats.recentBookings.length === 0) && (
              <p style={{ color: 'var(--color-text-muted)', textAlign: 'center', padding: '20px 0' }}>No bookings yet</p>
            )}
          </div>
        </div>
      </div>

      {/* Recent Users */}
      <div className="card" style={{ marginTop: 'var(--space-xl)' }}>
        <h3 className="card-title">Recent Registrations</h3>
        <div className="recent-list">
          {(stats?.recentUsers || []).map((u) => (
            <div key={u._id} className="recent-item">
              <div className="recent-item-info">
                <strong>{u.name}</strong>
                <span>{u.email}</span>
              </div>
              <div className="recent-item-right">
                <span className={`badge badge-${u.role}`}>{u.role}</span>
                <span style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)' }}>{formatDate(u.createdAt)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
