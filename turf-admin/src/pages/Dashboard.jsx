import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import {
  TrendingUp, CalendarDays, IndianRupee, Clock,
  CheckCircle2, AlertCircle, XCircle, Users
} from 'lucide-react';

const fmt = (n) => new Intl.NumberFormat('en-IN').format(Math.round(n || 0));

function StatCard({ icon: Icon, label, value, sub, color, trend }) {
  return (
    <div className="card" style={{ position: 'relative', overflow: 'hidden' }}>
      <div style={{
        position: 'absolute', top: 0, right: 0, width: 80, height: 80,
        background: `radial-gradient(circle, ${color}20 0%, transparent 70%)`,
      }} />
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10,
          background: `${color}18`, border: `1px solid ${color}30`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={18} color={color} />
        </div>
        {trend && (
          <span style={{ fontSize: 11, color: trend > 0 ? '#10b981' : '#ef4444', fontWeight: 600 }}>
            {trend > 0 ? '▲' : '▼'} {Math.abs(trend)}%
          </span>
        )}
      </div>
      <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text)', lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function PaymentBreakdown({ month }) {
  const total = month?.totalBookings || 0;
  if (!total) return null;
  const paid = ((month.fullyPaid / total) * 100).toFixed(0);
  const partial = ((month.partiallyPaid / total) * 100).toFixed(0);
  const unpaid = ((month.unpaid / total) * 100).toFixed(0);
  return (
    <div className="card">
      <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 20 }}>This Month — Payment Breakdown</h3>
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        {[
          { label: 'Fully Paid', count: month.fullyPaid, pct: paid, color: '#10b981' },
          { label: 'Partial', count: month.partiallyPaid, pct: partial, color: '#f59e0b' },
          { label: 'Unpaid', count: month.unpaid, pct: unpaid, color: '#ef4444' },
        ].map(({ label, count, pct, color }) => (
          <div key={label} style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 800, color }}>{count}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{label}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{pct}%</div>
          </div>
        ))}
      </div>
      {/* Visual bar */}
      <div style={{ display: 'flex', borderRadius: 6, overflow: 'hidden', height: 8 }}>
        <div style={{ flex: month.fullyPaid, background: '#10b981', minWidth: month.fullyPaid ? 4 : 0 }} />
        <div style={{ flex: month.partiallyPaid, background: '#f59e0b', minWidth: month.partiallyPaid ? 4 : 0 }} />
        <div style={{ flex: month.unpaid, background: '#ef4444', minWidth: month.unpaid ? 4 : 0 }} />
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { selectedTurf } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  useEffect(() => {
    if (!selectedTurf?.id) { setLoading(false); return; }
    setLoading(true);
    api.get(`/turf-owner/stats/${selectedTurf.id}`)
      .then(r => setStats(r.data.stats))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [selectedTurf?.id]);

  if (!selectedTurf) {
    return (
      <div style={{ textAlign: 'center', padding: 80 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🏟️</div>
        <h2>No turf found</h2>
        <p style={{ color: 'var(--text-secondary)', marginTop: 8 }}>Contact admin to associate a turf with your account.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 400 }}>
        <div className="spinner" style={{ width: 40, height: 40 }} />
      </div>
    );
  }

  const { today: todayStats, month: monthStats } = stats || {};

  return (
    <div className="animate-fadeIn">
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--text)' }}>
              {selectedTurf.name}
            </h1>
            <p style={{ color: 'var(--text-secondary)', marginTop: 4, fontSize: 14 }}>{today}</p>
          </div>
          <div style={{
            background: 'rgba(0,212,170,0.08)', border: '1px solid rgba(0,212,170,0.3)',
            borderRadius: 10, padding: '8px 16px',
          }}>
            <span style={{ color: 'var(--primary)', fontWeight: 700, fontSize: 13 }}>● Live Dashboard</span>
          </div>
        </div>
      </div>

      {/* TODAY stats */}
      <div style={{ marginBottom: 12 }}>
        <h2 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 14 }}>
          Today's Overview
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 14 }}>
          <StatCard icon={CalendarDays} label="Total Bookings" value={todayStats?.totalBookings ?? 0} color="#3b82f6" />
          <StatCard icon={CheckCircle2} label="Confirmed" value={todayStats?.confirmedBookings ?? 0} color="#10b981" />
          <StatCard icon={Clock} label="Completed" value={todayStats?.completedBookings ?? 0} color="#8b5cf6" />
          <StatCard icon={IndianRupee} label="Revenue Today" value={`₹${fmt(todayStats?.revenue)}`} color="#00d4aa" />
          <StatCard icon={AlertCircle} label="Pending Collection" value={`₹${fmt(todayStats?.pending)}`} sub="Collect at venue" color="#f59e0b" />
          <StatCard icon={Users} label="Booked Slots" value={todayStats?.bookedSlotsCount ?? 0} sub="of day's total" color="#ec4899" />
        </div>
      </div>

      {/* Divider */}
      <div style={{ borderTop: '1px solid var(--border)', margin: '28px 0' }} />

      {/* THIS MONTH stats */}
      <div>
        <h2 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 14 }}>
          This Month
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 14 }}>
          <StatCard icon={CalendarDays} label="Total Bookings" value={monthStats?.totalBookings ?? 0} color="#3b82f6" />
          <StatCard icon={IndianRupee} label="Revenue Collected" value={`₹${fmt(monthStats?.revenue)}`} color="#10b981" />
          <StatCard icon={AlertCircle} label="Pending Collection" value={`₹${fmt(monthStats?.pending)}`} color="#f59e0b" />
        </div>
        <PaymentBreakdown month={monthStats} />
      </div>

      {/* Quick Tips */}
      <div className="card" style={{ marginTop: 20, background: 'rgba(0,212,170,0.04)', borderColor: 'rgba(0,212,170,0.2)' }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--primary)', marginBottom: 12 }}>💡 Quick Actions</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {[
            { label: '📅 View Today\'s Slots', href: '/slots' },
            { label: '📋 All Bookings', href: '/bookings' },
            { label: '🔍 Scan Booking QR', href: '/scanner' },
          ].map(({ label, href }) => (
            <a key={href} href={href} className="btn btn-ghost btn-sm">{label}</a>
          ))}
        </div>
      </div>
    </div>
  );
}
