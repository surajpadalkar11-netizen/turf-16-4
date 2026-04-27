import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import {
  Edit, Download, FileText, ChevronDown, RefreshCw,
  TrendingUp, TrendingDown, IndianRupee, CalendarDays,
  CheckCircle2, AlertCircle, Clock, Users, Zap,
} from 'lucide-react';
import EditTurfModal from '../components/EditTurfModal';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import styles from './Dashboard.module.css';

const fmt = (n) => new Intl.NumberFormat('en-IN').format(Math.round(n || 0));
const formatTime = (t) => {
  if (!t) return '';
  const [h, m] = t.split(':');
  let hours = parseInt(h, 10);
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${hours}:${m} ${ampm}`;
};
const todayStr = () => new Date().toISOString().split('T')[0];

/* ── Period tabs ── */
const PERIODS = [
  { key: 'today',   label: 'Today' },
  { key: 'week',    label: 'This Week' },
  { key: 'month',   label: 'This Month' },
  { key: 'overall', label: 'All Time' },
];

/* ── KPI Card ── */
function KpiCard({ icon: Icon, label, value, sub, accent, trend, trendLabel }) {
  return (
    <div className={styles.kpiCard} style={{ '--ac': accent }}>
      <div className={styles.kpiTop}>
        <div className={styles.kpiIcon}><Icon size={18} /></div>
        {trend !== undefined && (
          <div className={styles.kpiTrend} data-dir={trend >= 0 ? 'up' : 'down'}>
            {trend >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            <span>{trendLabel}</span>
          </div>
        )}
      </div>
      <div className={styles.kpiValue}>{value}</div>
      <div className={styles.kpiLabel}>{label}</div>
      {sub && <div className={styles.kpiSub}>{sub}</div>}
    </div>
  );
}

/* ── Occupancy donut ── */
function Donut({ pct }) {
  const data = [
    { value: pct, color: '#059669' },
    { value: 100 - pct, color: 'var(--border)' },
  ];
  return (
    <div className={styles.donutWrap}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" innerRadius="62%" outerRadius="80%"
            startAngle={90} endAngle={-270} dataKey="value" strokeWidth={0}>
            {data.map((d, i) => <Cell key={i} fill={d.color} />)}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className={styles.donutCenter}>
        <span className={styles.donutPct}>{pct}%</span>
        <span className={styles.donutSub}>Occupancy</span>
      </div>
    </div>
  );
}

/* ── Schedule slot ── */
function SlotItem({ slot }) {
  const bk = slot.booking;
  const st = slot.slotStatus;
  const cfg = {
    booked:    { label: 'Booked',    bg: '#059669' },
    pending:   { label: 'Pending',   bg: '#f59e0b' },
    completed: { label: 'Done',      bg: '#8b5cf6' },
    blocked:   { label: 'Blocked',   bg: '#ef4444' },
    available: { label: 'Free',      bg: 'var(--border-strong)' },
  }[st] || { label: st, bg: '#888' };

  return (
    <div className={styles.slotItem} data-status={st}>
      <div className={styles.slotTimeLine}>
        <span className={styles.slotT1}>{formatTime(slot.start)}</span>
        <span className={styles.slotT2}>{formatTime(slot.end)}</span>
      </div>
      <div className={styles.slotInfo}>
        {bk && st !== 'blocked' ? (
          <>
            <div className={styles.slotName}>{bk.customer?.name || '—'}</div>
            <div className={styles.slotPhone}>{bk.customer?.phone || ''}</div>
          </>
        ) : (
          <div className={styles.slotFree}>{st === 'blocked' ? 'Admin Blocked' : 'Available'}</div>
        )}
      </div>
      <div className={styles.slotRight}>
        {bk && st !== 'blocked' && bk.totalAmount > 0 && (
          <div className={styles.slotAmt}>₹{fmt(bk.totalAmount)}</div>
        )}
        {bk && bk.remainingAmount > 0 && st !== 'blocked' && (
          <div className={styles.slotDue}>₹{fmt(bk.remainingAmount)} due</div>
        )}
        <span className={styles.slotBadge} style={{ background: cfg.bg }}>{cfg.label}</span>
      </div>
    </div>
  );
}

/* ── Recent booking row ── */
function RecentRow({ b }) {
  const si = {
    confirmed: 'badge-success',
    pending:   'badge-warning',
    completed: 'badge-purple',
    cancelled: 'badge-danger',
  }[b.status] || 'badge-muted';
  const label = { confirmed:'Confirmed', pending:'Pending', completed:'Done', cancelled:'Cancelled' }[b.status] || b.status;
  return (
    <div className={styles.recentRow}>
      <div className={styles.recentAvatar}>{(b.user?.name || 'U')[0].toUpperCase()}</div>
      <div className={styles.recentInfo}>
        <div className={styles.recentName}>{b.user?.name || '—'}</div>
        <div className={styles.recentMeta}>
          {new Date(b.date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
          {b.timeSlots?.[0] && ` · ${formatTime(b.timeSlots[0].start)}`}
        </div>
      </div>
      <div className={styles.recentRight}>
        <span className={`badge ${si}`}>{label}</span>
        <div className={styles.recentAmt}>₹{fmt(b.totalAmount)}</div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════
   Dashboard
═══════════════════════════════════════ */
export default function Dashboard() {
  const { user, selectedTurf } = useAuth();
  const [period, setPeriod] = useState('today');
  const [stats, setStats] = useState(null);
  const [isActive, setIsActive] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [loading, setLoading] = useState(true);
  const [todaySlots, setTodaySlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(true);
  const [recentBookings, setRecentBookings] = useState([]);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [dlOpen, setDlOpen] = useState(false);
  const [dlPdf, setDlPdf] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

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

  const fetchSlots = useCallback(async () => {
    if (!selectedTurf?.id) { setSlotsLoading(false); return; }
    setSlotsLoading(true);
    try {
      const { data } = await api.get(`turf-owner/slots/${selectedTurf.id}?date=${todayStr()}&interval=60`);
      setTodaySlots(data.slots || []);
    } catch (e) { console.error(e); }
    finally { setSlotsLoading(false); }
  }, [selectedTurf?.id]);

  const fetchRecent = useCallback(async () => {
    if (!selectedTurf?.id) return;
    try {
      const { data } = await api.get(`turf-owner/bookings/${selectedTurf.id}?limit=6&page=1`);
      setRecentBookings(data.bookings || []);
    } catch (e) { console.error(e); }
  }, [selectedTurf?.id]);

  useEffect(() => { fetchStats(); fetchSlots(); fetchRecent(); }, [fetchStats, fetchSlots, fetchRecent]);

  useEffect(() => {
    const fn = (e) => { if (!e.target.closest('[data-dl]')) setDlOpen(false); };
    if (dlOpen) document.addEventListener('click', fn);
    return () => document.removeEventListener('click', fn);
  }, [dlOpen]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchStats(), fetchSlots(), fetchRecent()]);
    setRefreshing(false);
  };

  const handleToggle = async () => {
    if (!window.confirm(`${isActive ? 'Disable' : 'Enable'} this turf?`)) return;
    setToggling(true);
    try {
      const { data } = await api.put(`turf-owner/turf/${selectedTurf.id}/toggle-status`);
      if (data.success) setIsActive(data.is_active);
    } catch { alert('Failed'); }
    finally { setToggling(false); }
  };

  /* Active period data */
  const p = stats?.[period] || {};
  const today = stats?.today || {};
  const month = stats?.month || {};

  /* Slot metrics */
  const total = todaySlots.length;
  const booked = todaySlots.filter(s => ['booked','pending','completed'].includes(s.slotStatus)).length;
  const free = todaySlots.filter(s => s.slotStatus === 'available').length;
  const blocked = todaySlots.filter(s => s.slotStatus === 'blocked').length;
  const occ = total > 0 ? Math.round((booked / total) * 100) : 0;

  /* CSV */
  const handleCSV = () => {
    if (!stats) return;
    const rows = [
      ['Metric','Today','This Week','This Month','All Time'],
      ['Bookings', today.totalBookings??0, stats.week?.totalBookings??0, month.totalBookings??0, stats.overall?.totalBookings??0],
      ['Revenue', today.revenue??0, stats.week?.revenue??0, month.revenue??0, stats.overall?.revenue??0],
      ['Pending Cash', today.pending??0, stats.week?.pending??0, month.pending??0, stats.overall?.pending??0],
      ['Fully Paid', today.fullyPaid??0, stats.week?.fullyPaid??0, month.fullyPaid??0, stats.overall?.fullyPaid??0],
    ];
    const csv = 'data:text/csv;charset=utf-8,' + rows.map(r => r.join(',')).join('\n');
    const a = document.createElement('a');
    a.href = encodeURI(csv);
    a.download = `Report_${(selectedTurf?.name || 'turf').replace(/\s+/g, '_')}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  const handlePDF = () => {
    if (!stats) return;
    setDlPdf(true);
    try {
      const doc = new jsPDF();
      doc.setFontSize(18); doc.setTextColor(15,23,42);
      doc.text(selectedTurf?.name || 'Turf Report', 14, 22);
      doc.setFontSize(10); doc.setTextColor(100);
      doc.text(`Generated ${new Date().toLocaleString('en-IN')}`, 14, 30);
      autoTable(doc, {
        startY: 38,
        head: [['Metric','Today','This Week','This Month','All Time']],
        body: [
          ['Bookings', today.totalBookings??0, stats.week?.totalBookings??0, month.totalBookings??0, stats.overall?.totalBookings??0],
          ['Revenue', `₹${fmt(today.revenue)}`, `₹${fmt(stats.week?.revenue)}`, `₹${fmt(month.revenue)}`, `₹${fmt(stats.overall?.revenue)}`],
          ['Pending Cash', `₹${fmt(today.pending)}`, `₹${fmt(stats.week?.pending)}`, `₹${fmt(month.pending)}`, `₹${fmt(stats.overall?.pending)}`],
          ['Fully Paid', today.fullyPaid??0, stats.week?.fullyPaid??0, month.fullyPaid??0, stats.overall?.fullyPaid??0],
        ],
        headStyles: { fillColor: [5,150,105] },
        styles: { fontSize: 9 },
      });
      doc.save(`Report_${(selectedTurf?.name || 'turf').replace(/\s+/g,'_')}.pdf`);
    } catch { alert('PDF failed'); }
    finally { setDlPdf(false); }
  };

  if (!selectedTurf) return (
    <div className={styles.noTurf}>
      <div style={{ fontSize: 52 }}>⛳</div>
      <h2>No Turf Found</h2>
      <p>Contact admin to associate a turf with your account.</p>
    </div>
  );

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight: 400 }}>
      <div className="spinner" style={{ width:40, height:40, borderWidth:4 }} />
    </div>
  );

  const scheduledSlots = todaySlots.filter(s => ['booked','pending','completed'].includes(s.slotStatus));
  const freeSlots = todaySlots.filter(s => s.slotStatus === 'available');

  return (
    <>
      {/* ── Top Bar ── */}
      <div className={styles.topBar}>
        <div className={styles.topBarLeft}>
          <h1 className={styles.welcome}>
            Welcome back, <span>{user?.name?.split(' ')[0] || 'Owner'}</span>
          </h1>
          <div className={styles.turfPill}>
            <span className={styles.turfPillDot} style={{ background: isActive ? '#10b981' : '#ef4444' }} />
            <span>{selectedTurf.name}</span>
            <span className={styles.turfPillStatus}>{isActive ? 'Online' : 'Offline'}</span>
          </div>
        </div>

        <div className={styles.topBarRight}>
          {/* Status toggle */}
          <div className={styles.statusWrap}>
            <span style={{ fontSize:12, fontWeight:600, color:'var(--text-muted)' }}>
              {toggling ? '...' : isActive ? 'Active' : 'Offline'}
            </span>
            <div className={styles.toggle} data-active={isActive}
              onClick={handleToggle}
              style={{ cursor: toggling ? 'not-allowed':'pointer', opacity: toggling ? 0.6:1 }}>
              <div className={styles.toggleThumb} data-active={isActive} />
            </div>
          </div>

          <button className="btn btn-ghost btn-sm" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw size={14} style={{ animation: refreshing ? 'spin 0.8s linear infinite':'none' }} />
          </button>

          <button className="btn btn-ghost btn-sm" onClick={() => setIsEditOpen(true)}>
            <Edit size={14} /> <span className={styles.btnLabel}>Edit</span>
          </button>

          <div style={{ position:'relative' }} data-dl="true">
            <button className="btn btn-primary btn-sm" onClick={() => setDlOpen(p => !p)}
              disabled={dlPdf} data-dl="true">
              <Download size={14} />
              <span className={styles.btnLabel}>{dlPdf ? 'Generating…' : 'Export'}</span>
              <ChevronDown size={11} style={{ transform: dlOpen ? 'rotate(180deg)':'none', transition:'transform 0.2s' }} />
            </button>
            {dlOpen && !dlPdf && (
              <div className={styles.exportMenu} data-dl="true">
                <button className={styles.exportItem} onClick={() => { handlePDF(); setDlOpen(false); }}>
                  <FileText size={14} color="#ef4444" /> PDF Report
                </button>
                <button className={styles.exportItem} onClick={() => { handleCSV(); setDlOpen(false); }}>
                  <Download size={14} color="#10b981" /> CSV Export
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Period Filter ── */}
      <div className={styles.periodBar}>
        <div className={styles.periodTabs}>
          {PERIODS.map(({ key, label }) => (
            <button
              key={key}
              className={styles.periodTab}
              data-active={period === key}
              onClick={() => setPeriod(key)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className={styles.periodDate}>
          <CalendarDays size={13} />
          {new Date().toLocaleDateString('en-IN', { weekday:'short', day:'numeric', month:'long', year:'numeric' })}
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className={styles.kpiGrid}>
        <KpiCard
          icon={IndianRupee}
          label="Revenue Collected"
          value={`₹${fmt(p.revenue)}`}
          sub={period !== 'today' ? `Today: ₹${fmt(today.revenue)}` : undefined}
          accent="#059669"
        />
        <KpiCard
          icon={CalendarDays}
          label="Total Bookings"
          value={p.totalBookings ?? 0}
          sub={period !== 'today' ? `Today: ${today.totalBookings ?? 0}` : undefined}
          accent="#6366f1"
        />
        <KpiCard
          icon={AlertCircle}
          label="Cash Pending"
          value={`₹${fmt(p.pending)}`}
          sub={`${p.unpaid ?? 0} unpaid · ${p.partiallyPaid ?? 0} partial`}
          accent="#f59e0b"
        />
        <KpiCard
          icon={CheckCircle2}
          label="Fully Paid"
          value={p.fullyPaid ?? 0}
          sub={p.totalBookings > 0
            ? `${Math.round(((p.fullyPaid ?? 0) / p.totalBookings) * 100)}% of bookings`
            : undefined}
          accent="#10b981"
        />
        <KpiCard
          icon={Clock}
          label="Hours Booked"
          value={`${(p.bookedSlotsCount ?? 0) % 1 === 0
            ? Math.round(p.bookedSlotsCount ?? 0)
            : (p.bookedSlotsCount ?? 0).toFixed(1)}h`}
          sub="Turf time utilised"
          accent="#8b5cf6"
        />
        <KpiCard
          icon={Users}
          label="Completed Sessions"
          value={p.completedBookings ?? 0}
          sub={p.confirmedBookings > 0 ? `${p.confirmedBookings} confirmed` : undefined}
          accent="#0ea5e9"
        />
        {(p.walletRevenue ?? 0) > 0 && (
          <KpiCard
            icon={Zap}
            label="Wallet Payments"
            value={`₹${fmt(p.walletRevenue)}`}
            sub="Paid via customer wallet"
            accent="#7c3aed"
          />
        )}
      </div>

      {/* ── Main Grid ── */}
      <div className={styles.mainGrid}>
        {/* LEFT — Schedule + Free slots */}
        <div className={styles.leftCol}>

          {/* Occupancy overview card */}
          <div className={`card ${styles.occCard}`}>
            <div className={styles.occLeft}>
              <div className="section-title" style={{ marginBottom: 16 }}>Today's Occupancy</div>
              {[
                { label: 'Booked', count: booked, color: '#059669' },
                { label: 'Available', count: free, color: '#f59e0b' },
                { label: 'Blocked', count: blocked, color: '#ef4444' },
              ].map(({ label, count, color }) => (
                <div key={label} className={styles.occRow}>
                  <span className={styles.occDot} style={{ background: color }} />
                  <span className={styles.occLabel}>{label}</span>
                  <div className={styles.occBarWrap}>
                    <div className={styles.occBarFill} style={{
                      width: total > 0 ? `${Math.round((count/total)*100)}%` : '0%',
                      background: color
                    }} />
                  </div>
                  <span className={styles.occCount}>{count}</span>
                </div>
              ))}
            </div>
            {total > 0 && (
              <div className={styles.occRight}>
                <Donut pct={occ} />
              </div>
            )}
          </div>

          {/* Today's Booked Schedule */}
          <div className={`card ${styles.schedCard}`}>
            <div className={styles.schedHeader}>
              <span className="section-title">Booked Slots</span>
              <span className={styles.schedCount}>{scheduledSlots.length} slots</span>
            </div>
            {slotsLoading ? (
              <div style={{ textAlign:'center', padding:24 }}><div className="spinner" style={{ margin:'0 auto' }} /></div>
            ) : scheduledSlots.length === 0 ? (
              <div className={styles.emptyMsg}>No bookings scheduled today</div>
            ) : (
              <div className={styles.slotList}>
                {scheduledSlots.map((s, i) => <SlotItem key={`s-${i}`} slot={s} />)}
              </div>
            )}
          </div>

          {/* Free slots */}
          <div className={`card ${styles.schedCard}`}>
            <div className={styles.schedHeader}>
              <span className="section-title">Available Slots</span>
              <span className={styles.schedCount} style={{ color:'#f59e0b' }}>{freeSlots.length} open</span>
            </div>
            {slotsLoading ? (
              <div style={{ textAlign:'center', padding:24 }}><div className="spinner" style={{ margin:'0 auto' }} /></div>
            ) : freeSlots.length === 0 ? (
              <div className={styles.emptyMsg} style={{ color:'#059669' }}>🎉 All slots are booked!</div>
            ) : (
              <div className={styles.freeGrid}>
                {freeSlots.map((s, i) => (
                  <div key={i} className={styles.freeChip}>{formatTime(s.start)}</div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT — Recent bookings + quick summary */}
        <div className={styles.rightCol}>

          {/* Quick today summary */}
          <div className={`card ${styles.summaryCard}`}>
            <div className="section-title" style={{ marginBottom:14 }}>Today at a Glance</div>
            <div className={styles.summaryGrid}>
              {[
                { icon: <Zap size={15} color="#6366f1" />, label: 'Bookings', val: today.totalBookings ?? 0, bg: '#6366f115' },
                { icon: <IndianRupee size={15} color="#059669" />, label: 'Collected', val: `₹${fmt(today.revenue)}`, bg: '#05966915' },
                { icon: <AlertCircle size={15} color="#f59e0b" />, label: 'Cash Due', val: `₹${fmt(today.pending)}`, bg: '#f59e0b15' },
                { icon: <CheckCircle2 size={15} color="#10b981" />, label: 'Completed', val: today.completedBookings ?? 0, bg: '#10b98115' },
              ].map(({ icon, label, val, bg }) => (
                <div key={label} className={styles.summaryItem} style={{ background: bg }}>
                  <div className={styles.summaryIcon}>{icon}</div>
                  <div className={styles.summaryVal}>{val}</div>
                  <div className={styles.summaryLabel}>{label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Payment breakdown */}
          <div className={`card ${styles.payCard}`}>
            <div className="section-title" style={{ marginBottom:14 }}>
              Payment Status — {PERIODS.find(p2=>p2.key===period)?.label}
            </div>
            <div className={styles.payRows}>
              {[
                { label:'Fully Paid',     val: p.fullyPaid??0,       color:'#10b981', icon:'✅' },
                { label:'Partially Paid', val: p.partiallyPaid??0,   color:'#f59e0b', icon:'⚠️' },
                { label:'Unpaid',         val: p.unpaid??0,          color:'#ef4444', icon:'❌' },
              ].map(({ label, val, color, icon }) => {
                const tot = (p.fullyPaid??0) + (p.partiallyPaid??0) + (p.unpaid??0);
                const pct = tot > 0 ? Math.round((val/tot)*100) : 0;
                return (
                  <div key={label} className={styles.payRow}>
                    <span className={styles.payIcon}>{icon}</span>
                    <div className={styles.payInfo}>
                      <div className={styles.payLabelRow}>
                        <span className={styles.payLabel}>{label}</span>
                        <span className={styles.payVal} style={{ color }}>{val}</span>
                      </div>
                      <div className={styles.payBarWrap}>
                        <div className={styles.payBarFill} style={{ width:`${pct}%`, background:color }} />
                      </div>
                    </div>
                    <span className={styles.payPct}>{pct}%</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recent Bookings */}
          <div className={`card ${styles.recentCard}`}>
            <div className="section-title" style={{ marginBottom:14 }}>Recent Bookings</div>
            {recentBookings.length === 0 ? (
              <div className={styles.emptyMsg}>No recent bookings</div>
            ) : (
              <div className={styles.recentList}>
                {recentBookings.map(b => <RecentRow key={b.id||b._id} b={b} />)}
              </div>
            )}
          </div>
        </div>
      </div>

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
