import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import {
  Edit, Download, FileText, ChevronDown, RefreshCw,
  TrendingUp, IndianRupee, CalendarDays, Percent,
  CheckCircle2, Clock, AlertCircle,
} from 'lucide-react';
import EditTurfModal from '../components/EditTurfModal';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import styles from './Dashboard.module.css';

/* ── Helpers ── */
const fmt = (n) => new Intl.NumberFormat('en-IN').format(Math.round(n || 0));

const formatTime = (t) => {
  if (!t) return '';
  const [h, m] = t.split(':');
  let hours = parseInt(h, 10);
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${hours}:${m} ${ampm}`;
};

const today = () => new Date().toISOString().split('T')[0];

/* ── Stat Card ── */
function StatCard({ icon, label, value, sub, color, iconBg }) {
  return (
    <div className={styles.statCard}>
      <div className={styles.statIconWrap} style={{ background: iconBg || `${color}18`, border: `1px solid ${color}25` }}>
        <span style={{ fontSize: 22 }}>{icon}</span>
      </div>
      <div className={styles.statInfo}>
        <div className={styles.statValue}>{value}</div>
        <div className={styles.statLabel}>{label}</div>
        {sub && <div className={styles.statSub}>{sub}</div>}
      </div>
    </div>
  );
}

/* ── Occupancy ring ── */
function OccupancyRing({ pct }) {
  const data = [
    { name: 'Booked', value: pct, color: '#059669' },
    { name: 'Free', value: 100 - pct, color: '#e2e8f0' },
  ];
  return (
    <div className={styles.ringWrap}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%" cy="50%"
            innerRadius="60%" outerRadius="80%"
            startAngle={90} endAngle={-270}
            dataKey="value"
            strokeWidth={0}
          >
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className={styles.ringLabel}>
        <div className={styles.ringPct}>{pct}%</div>
      </div>
    </div>
  );
}

/* ── Booking Schedule Item ── */
function ScheduleItem({ slot }) {
  const bk = slot.booking;
  const status = slot.slotStatus;

  const statusStyle = {
    booked: { label: 'Booked', bg: '#059669', text: '#fff' },
    pending: { label: 'Pending', bg: '#f59e0b', text: '#fff' },
    completed: { label: 'Done', bg: '#8b5cf6', text: '#fff' },
    blocked: { label: 'Blocked', bg: '#ef4444', text: '#fff' },
    available: { label: 'Available', bg: '#e2e8f0', text: '#94a3b8' },
  }[status] || { label: status, bg: '#e2e8f0', text: '#94a3b8' };

  return (
    <div className={styles.scheduleItem} data-status={status}>
      <div className={styles.scheduleTime}>
        <span className={styles.timeMain}>{formatTime(slot.start)}</span>
        <span className={styles.timeSub}>{formatTime(slot.end)}</span>
      </div>
      <div className={styles.scheduleBody}>
        {bk && status !== 'blocked' ? (
          <>
            <div className={styles.scheduleCustomer}>{bk.customer?.name || '—'}</div>
            {bk.customer?.phone && <div className={styles.schedulePhone}>{bk.customer.phone}</div>}
            <div
              className={styles.scheduleConfirm}
              style={{ color: bk.bookingStatus === 'confirmed' ? '#059669' : '#f59e0b' }}
            >
              {bk.bookingStatus}
            </div>
          </>
        ) : (
          <div className={styles.scheduleEmpty}>{status === 'blocked' ? 'Admin Blocked' : 'remaining'}</div>
        )}
      </div>
      <div
        className={styles.scheduleStatus}
        style={{ background: statusStyle.bg, color: statusStyle.text }}
      >
        {statusStyle.label}
      </div>
    </div>
  );
}

/* ── Booking Slot Row ── */
function SlotRow({ slot }) {
  const bk = slot.booking;
  const status = slot.slotStatus;
  const isEmpty = !bk || status === 'available';
  const price = bk?.totalAmount ?? 0;

  return (
    <div className={styles.slotRow}>
      <div className={styles.slotTime}>
        <span>{formatTime(slot.start)}</span>
        {bk && status !== 'available' && (
          <span className={styles.slotArrow}>›</span>
        )}
        {bk?.customer?.phone && (
          <span className={styles.slotPhone}>{bk.customer.phone}</span>
        )}
      </div>
      <div className={styles.slotRight}>
        {isEmpty ? (
          <span className={styles.slotRemaining}>remaining</span>
        ) : (
          <span className={styles.slotAmount}>₹{fmt(price)}</span>
        )}
      </div>
    </div>
  );
}

/* ── Recent Booking Row ── */
function RecentBookingRow({ booking }) {
  const statusStyle = {
    confirmed: { label: 'Confirmed', cls: 'badge-success' },
    pending: { label: 'Pending', cls: 'badge-warning' },
    completed: { label: 'Done', cls: 'badge-purple' },
    cancelled: { label: 'Cancelled', cls: 'badge-danger' },
  }[booking.status] || { label: booking.status, cls: 'badge-muted' };

  return (
    <div className={styles.recentRow}>
      <div className={styles.recentAvatar}>
        {(booking.user?.name || 'U')[0].toUpperCase()}
      </div>
      <div className={styles.recentInfo}>
        <div className={styles.recentName}>{booking.user?.name || '—'}</div>
        <div className={styles.recentMeta}>
          {booking.turf?.name || '—'} · {new Date(booking.date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
        </div>
      </div>
      <div className={styles.recentRight}>
        <span className={`badge ${statusStyle.cls}`}>{statusStyle.label}</span>
        <div className={styles.recentAmount}>₹{fmt(booking.totalAmount)}</div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Main Dashboard
═══════════════════════════════════════════════════════════ */
export default function Dashboard() {
  const { user, selectedTurf } = useAuth();
  const [stats, setStats] = useState(null);
  const [isActive, setIsActive] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [loading, setLoading] = useState(true);
  const [todaySlots, setTodaySlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(true);
  const [recentBookings, setRecentBookings] = useState([]);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [downloadMenuOpen, setDownloadMenuOpen] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const dateDisplay = new Date().toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  /* Fetch stats */
  const fetchStats = useCallback(async () => {
    if (!selectedTurf?.id) { setLoading(false); return; }
    setLoading(true);
    try {
      const r = await api.get(`turf-owner/stats/${selectedTurf.id}`);
      setStats(r.data.stats);
      setIsActive(r.data.isActive);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [selectedTurf?.id]);

  /* Fetch today slots */
  const fetchTodaySlots = useCallback(async () => {
    if (!selectedTurf?.id) { setSlotsLoading(false); return; }
    setSlotsLoading(true);
    try {
      const { data } = await api.get(`turf-owner/slots/${selectedTurf.id}?date=${today()}&interval=60`);
      setTodaySlots(data.slots || []);
    } catch (e) { console.error(e); }
    finally { setSlotsLoading(false); }
  }, [selectedTurf?.id]);

  /* Fetch recent bookings */
  const fetchRecent = useCallback(async () => {
    if (!selectedTurf?.id) return;
    try {
      const { data } = await api.get(`turf-owner/bookings/${selectedTurf.id}?limit=5&page=1`);
      setRecentBookings(data.bookings || []);
    } catch (e) { console.error(e); }
  }, [selectedTurf?.id]);

  useEffect(() => {
    fetchStats();
    fetchTodaySlots();
    fetchRecent();
  }, [fetchStats, fetchTodaySlots, fetchRecent]);

  /* Close download menu on outside click */
  useEffect(() => {
    const fn = (e) => { if (!e.target.closest('[data-dl]')) setDownloadMenuOpen(false); };
    if (downloadMenuOpen) document.addEventListener('click', fn);
    return () => document.removeEventListener('click', fn);
  }, [downloadMenuOpen]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchStats(), fetchTodaySlots(), fetchRecent()]);
    setRefreshing(false);
  };

  const handleToggleStatus = async () => {
    if (!window.confirm(`${isActive ? 'Disable' : 'Enable'} this turf?`)) return;
    setToggling(true);
    try {
      const { data } = await api.put(`turf-owner/turf/${selectedTurf.id}/toggle-status`);
      if (data.success) setIsActive(data.is_active);
    } catch { alert('Failed to toggle status'); }
    finally { setToggling(false); }
  };

  /* ── Derived values ── */
  const overall = stats?.overall || {};
  const month = stats?.month || {};
  const todayStats = stats?.today || {};

  const totalSlots = todaySlots.length;
  const bookedSlots = todaySlots.filter(s => ['booked', 'pending', 'completed'].includes(s.slotStatus)).length;
  const remainingSlots = todaySlots.filter(s => s.slotStatus === 'available').length;
  const cancelledSlots = todaySlots.filter(s => s.slotStatus === 'blocked').length;
  const occupancy = totalSlots > 0 ? Math.round((bookedSlots / totalSlots) * 100) : 0;

  /* Donut chart data */
  const donutData = [
    { name: 'Booked', value: bookedSlots, color: '#059669' },
    { name: 'Remaining', value: remainingSlots, color: '#f59e0b' },
    { name: 'Cancelled', value: cancelledSlots, color: '#ef4444' },
  ].filter(d => d.value > 0);

  /* CSV download */
  const handleDownloadCSV = () => {
    if (!stats || !selectedTurf) return;
    const rows = [
      ['Metric', 'Today', 'This Month', 'All-Time'],
      ['Bookings', todayStats.totalBookings ?? 0, month.totalBookings ?? 0, overall.totalBookings ?? 0],
      ['Revenue', todayStats.revenue ?? 0, month.revenue ?? 0, overall.revenue ?? 0],
      ['Pending Cash', todayStats.pending ?? 0, month.pending ?? 0, overall.pending ?? 0],
      ['Fully Paid', todayStats.fullyPaid ?? 0, month.fullyPaid ?? 0, overall.fullyPaid ?? 0],
    ];
    const csv = 'data:text/csv;charset=utf-8,' + rows.map(r => r.join(',')).join('\n');
    const a = document.createElement('a');
    a.href = encodeURI(csv);
    a.download = `TurfReport_${(selectedTurf.name || 'turf').replace(/\s+/g, '_')}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  const handleDownloadPDF = () => {
    if (!stats || !selectedTurf) return;
    setDownloadingPdf(true);
    try {
      const doc = new jsPDF();
      doc.setFontSize(20); doc.setTextColor(15, 23, 42);
      doc.text(selectedTurf.name, 14, 22);
      doc.setFontSize(11); doc.setTextColor(100);
      doc.text(`Performance Report · Generated ${new Date().toLocaleString()}`, 14, 30);
      autoTable(doc, {
        startY: 38,
        head: [['Metric', 'Today', 'This Month', 'All-Time']],
        body: [
          ['Bookings', todayStats.totalBookings ?? 0, month.totalBookings ?? 0, overall.totalBookings ?? 0],
          ['Revenue', `₹${fmt(todayStats.revenue)}`, `₹${fmt(month.revenue)}`, `₹${fmt(overall.revenue)}`],
          ['Pending Cash', `₹${fmt(todayStats.pending)}`, `₹${fmt(month.pending)}`, `₹${fmt(overall.pending)}`],
          ['Fully Paid', todayStats.fullyPaid ?? 0, month.fullyPaid ?? 0, overall.fullyPaid ?? 0],
        ],
        headStyles: { fillColor: [5, 150, 105] },
        styles: { fontSize: 10 },
      });
      doc.save(`TurfReport_${(selectedTurf.name || 'turf').replace(/\s+/g, '_')}.pdf`);
    } catch (e) { alert('PDF failed. Try again.'); }
    finally { setDownloadingPdf(false); }
  };

  /* ── No turf guard ── */
  if (!selectedTurf) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 20px' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>⛳</div>
        <h2 style={{ color: 'var(--text)', marginBottom: 8 }}>No Turf Found</h2>
        <p style={{ color: 'var(--text-secondary)' }}>Contact admin to associate a turf with your account.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 400 }}>
        <div className="spinner" style={{ width: 40, height: 40, borderWidth: 4 }} />
      </div>
    );
  }

  /* Slots for schedule: specifically booked slots for today */
  const scheduleSlots = todaySlots.filter(s => ['booked', 'pending', 'completed'].includes(s.slotStatus)).slice(0, 8);
  
  /* Slots for booking slots: specifically available ones */
  const bookingSlots = todaySlots.filter(s => s.slotStatus === 'available').slice(0, 8);

  return (
    <>
      {/* ── Top Header ── */}
      <div className={styles.topBar}>
        <div className={styles.topBarLeft}>
          <h1 className={styles.welcome}>Welcome, {user?.name?.split(' ')[0] || 'Owner'}!</h1>
          <p className={styles.dateStr}>{dateDisplay}</p>
        </div>

        <div className={styles.topBarRight}>
          {/* Status toggle */}
          <div className={styles.statusWrap}>
            <span className={styles.statusDot} style={{ background: isActive ? '#10b981' : '#ef4444' }} />
            <span className={styles.statusLabel} style={{ color: isActive ? '#10b981' : '#ef4444' }}>
              {toggling ? '...' : isActive ? 'Online' : 'Offline'}
            </span>
            <div
              className={styles.toggle}
              data-active={isActive}
              onClick={handleToggleStatus}
              style={{ cursor: toggling ? 'not-allowed' : 'pointer', opacity: toggling ? 0.6 : 1 }}
            >
              <div className={styles.toggleThumb} data-active={isActive} />
            </div>
          </div>

          {/* Refresh */}
          <button
            className="btn btn-ghost btn-sm"
            onClick={handleRefresh}
            disabled={refreshing}
            title="Refresh data"
          >
            <RefreshCw size={14} style={{ animation: refreshing ? 'spin 0.8s linear infinite' : 'none' }} />
          </button>

          {/* Edit Turf */}
          <button className="btn btn-ghost btn-sm" onClick={() => setIsEditOpen(true)}>
            <Edit size={14} /> Edit Turf
          </button>

          {/* Export */}
          <div style={{ position: 'relative' }} data-dl="true">
            <button
              className="btn btn-primary btn-sm"
              onClick={() => setDownloadMenuOpen(p => !p)}
              disabled={downloadingPdf}
              data-dl="true"
            >
              <Download size={14} />
              {downloadingPdf ? 'Generating...' : 'Export'}
              <ChevronDown size={12} style={{ transform: downloadMenuOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
            </button>
            {downloadMenuOpen && !downloadingPdf && (
              <div className={styles.exportMenu} data-dl="true">
                <button className={styles.exportMenuItem} onClick={() => { handleDownloadPDF(); setDownloadMenuOpen(false); }}>
                  <FileText size={14} color="#ef4444" /> Save as PDF
                </button>
                <button className={styles.exportMenuItem} onClick={() => { handleDownloadCSV(); setDownloadMenuOpen(false); }}>
                  <Download size={14} color="#10b981" /> Save as CSV
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Stat Cards ── */}
      <div className={styles.statsRow}>
        <StatCard
          icon="💰"
          label="TOTAL REVENUE"
          value={`₹${fmt(overall.revenue)}`}
          sub={`This month: ₹${fmt(month.revenue)}`}
          color="#059669"
        />
        <StatCard
          icon="📋"
          label="TOTAL BOOKINGS"
          value={overall.totalBookings ?? 0}
          sub={`Today: ${todayStats.totalBookings ?? 0}`}
          color="#3b82f6"
        />
        <StatCard
          icon="🏟️"
          label="YOUR TURF"
          value={selectedTurf.name}
          sub={isActive ? '● Active' : '○ Offline'}
          color="#8b5cf6"
        />
        <StatCard
          icon="📊"
          label="OCCUPANCY RATE"
          value={`${occupancy}%`}
          sub={`${bookedSlots}/${totalSlots} slots today`}
          color="#f59e0b"
        />
      </div>

      {/* ── Main Grid ── */}
      <div className={styles.mainGrid}>
        {/* LEFT COLUMN */}
        <div className={styles.leftCol}>

          {/* Booking Schedule */}
          <div className={`card ${styles.scheduleCard}`}>
            <div className="section-title">Booking Schedule</div>
            <div className={styles.scheduleDateRow}>
              <CalendarDays size={14} color="var(--text-muted)" />
              <span>Today, {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
            </div>
            <div className={styles.scheduleList}>
              {slotsLoading ? (
                <div style={{ textAlign: 'center', padding: 24 }}>
                  <div className="spinner" style={{ margin: '0 auto' }} />
                </div>
              ) : scheduleSlots.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)', fontSize: 13 }}>
                  No bookings scheduled for today
                </div>
              ) : (
                scheduleSlots.map((slot, i) => (
                  <ScheduleItem key={`${slot.start}-${i}`} slot={slot} />
                ))
              )}
            </div>
          </div>

          {/* Booking Slots */}
          <div className={`card ${styles.slotListCard}`}>
            <div className="section-title">Booking Slots</div>
            <div className={styles.slotList}>
              {slotsLoading ? (
                <div style={{ textAlign: 'center', padding: 24 }}>
                  <div className="spinner" style={{ margin: '0 auto' }} />
                </div>
              ) : bookingSlots.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)', fontSize: 13 }}>
                  No available slots
                </div>
              ) : (
                bookingSlots.map((slot, i) => (
                  <SlotRow key={`${slot.start}-row-${i}`} slot={slot} />
                ))
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div className={styles.rightCol}>

          {/* Booking Overview */}
          <div className={`card ${styles.overviewCard}`}>
            <div className="section-title">Booking Overview</div>
            <div className={styles.overviewBody}>
              <div className={styles.overviewStats}>
                {[
                  { label: 'Booked Slots', count: bookedSlots, pct: occupancy, color: '#059669' },
                  { label: 'Remaining Slots', count: remainingSlots, pct: totalSlots > 0 ? Math.round((remainingSlots / totalSlots) * 100) : 0, color: '#f59e0b' },
                  { label: 'Cancelled Slots', count: cancelledSlots, pct: totalSlots > 0 ? Math.round((cancelledSlots / totalSlots) * 100) : 0, color: '#ef4444' },
                ].map(({ label, count, pct, color }) => (
                  <div key={label} className={styles.overviewStat}>
                    <div className={styles.overviewCount} style={{ color }}>{count}</div>
                    <div className={styles.overviewLabel}>{label}</div>
                    <div className={styles.overviewPct}>{pct}%</div>
                  </div>
                ))}
              </div>
              <div className={styles.donutWrap}>
                {totalSlots > 0 ? (
                  <>
                    <OccupancyRing pct={occupancy} />
                    <div className={styles.donutLegend}>
                      {donutData.map(d => (
                        <div key={d.name} className={styles.legendItem}>
                          <span className="dot" style={{ background: d.color }} />
                          <span style={{ fontSize: 11 }}>{d.name}</span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, padding: 20 }}>
                    No slot data yet
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Recent Bookings */}
          <div className={`card ${styles.recentCard}`}>
            <div className="section-title">Recent Bookings</div>
            <div className={styles.recentList}>
              {recentBookings.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)', fontSize: 13 }}>
                  No recent bookings
                </div>
              ) : (
                recentBookings.map(b => (
                  <RecentBookingRow key={b.id || b._id} booking={b} />
                ))
              )}
            </div>
          </div>

          {/* Today Stats quick summary */}
          <div className={`card ${styles.todayCard}`}>
            <div className="section-title">Today's Summary</div>
            <div className={styles.todayGrid}>
              {[
                { icon: <CalendarDays size={16} color="#3b82f6" />, label: 'Bookings', val: todayStats.totalBookings ?? 0, color: '#3b82f6' },
                { icon: <IndianRupee size={16} color="#059669" />, label: 'Revenue', val: `₹${fmt(todayStats.revenue)}`, color: '#059669' },
                { icon: <AlertCircle size={16} color="#f59e0b" />, label: 'Pending', val: `₹${fmt(todayStats.pending)}`, color: '#f59e0b' },
                { icon: <CheckCircle2 size={16} color="#8b5cf6" />, label: 'Completed', val: todayStats.completedBookings ?? 0, color: '#8b5cf6' },
              ].map(({ icon, label, val, color }) => (
                <div key={label} className={styles.todayItem}>
                  <div className={styles.todayIcon} style={{ background: `${color}15` }}>{icon}</div>
                  <div>
                    <div className={styles.todayVal} style={{ color }}>{val}</div>
                    <div className={styles.todayLabel}>{label}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {isEditOpen && (
        <EditTurfModal
          turfId={selectedTurf.id}
          onClose={() => setIsEditOpen(false)}
          onSave={() => { setIsEditOpen(false); window.location.reload(); }}
        />
      )}
    </>
  );
}
