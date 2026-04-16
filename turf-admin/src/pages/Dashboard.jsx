import { useEffect, useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import {
  TrendingUp, CalendarDays, IndianRupee, Clock,
  CheckCircle2, AlertCircle, XCircle, Users, Download, FileText, ChevronDown, Edit
} from 'lucide-react';
import EditTurfModal from '../components/EditTurfModal';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import styles from './Dashboard.module.css';

const fmt = (n) => new Intl.NumberFormat('en-IN').format(Math.round(n || 0));

function StatCard({ icon: Icon, label, value, sub, color }) {
  return (
    <div className={`card ${styles.statCard}`}>
      <div className={styles.statCardBg} style={{ background: `radial-gradient(circle, ${color}20 0%, transparent 70%)` }} />
      <div className={styles.statHeader}>
        <div className={styles.statIcon} style={{ background: `${color}18`, border: `1px solid ${color}30` }}>
          <Icon size={18} color={color} />
        </div>
      </div>
      <div className={styles.statValue}>{value}</div>
      <div className={styles.statLabel}>{label}</div>
      {sub && <div className={styles.statSub}>{sub}</div>}
    </div>
  );
}

function PaymentBreakdown({ data, label }) {
  const total = data?.totalBookings || 0;
  if (!total) return null;
  const paid = ((data.fullyPaid / total) * 100).toFixed(0);
  const partial = ((data.partiallyPaid / total) * 100).toFixed(0);
  const unpaid = ((data.unpaid / total) * 100).toFixed(0);
  return (
    <div className="card">
      <h3 className={styles.breakdownTitle}>{label} — Payment Breakdown</h3>
      <div className={styles.breakdownGrid}>
        {[
          { label: 'Fully Paid', count: data.fullyPaid, pct: paid, color: '#10b981' },
          { label: 'Partial', count: data.partiallyPaid, pct: partial, color: '#f59e0b' },
          { label: 'Unpaid', count: data.unpaid, pct: unpaid, color: '#ef4444' },
        ].map(({ label, count, pct, color }) => (
          <div key={label} className={styles.breakdownItem}>
            <div className={styles.breakdownCount} style={{ color }}>{count}</div>
            <div className={styles.breakdownItemLabel}>{label}</div>
            <div className={styles.breakdownPct}>{pct}%</div>
          </div>
        ))}
      </div>
      <div className={styles.progressBar}>
        <div style={{ flex: data.fullyPaid, background: '#10b981', minWidth: data.fullyPaid ? 4 : 0 }} />
        <div style={{ flex: data.partiallyPaid, background: '#f59e0b', minWidth: data.partiallyPaid ? 4 : 0 }} />
        <div style={{ flex: data.unpaid, background: '#ef4444', minWidth: data.unpaid ? 4 : 0 }} />
      </div>
    </div>
  );
}

function GraphsSection({ stats }) {
  if (!stats) return null;

  const barData = [
    { name: 'Today', bookings: stats.today?.totalBookings || 0, revenue: stats.today?.revenue || 0 },
    { name: 'Month', bookings: stats.month?.totalBookings || 0, revenue: stats.month?.revenue || 0 },
    { name: 'All-Time', bookings: stats.overall?.totalBookings || 0, revenue: stats.overall?.revenue || 0 },
  ];

  const pieData = [
    { name: 'Fully Paid', value: stats.overall?.fullyPaid || 0, color: '#3b82f6' },
    { name: 'Partial', value: stats.overall?.partiallyPaid || 0, color: '#8b5cf6' },
    { name: 'Unpaid', value: stats.overall?.unpaid || 0, color: '#ec4899' },
  ].filter(d => d.value > 0);

  return (
    <div className={styles.chartsGrid}>
      <div className="card">
        <h3 className={styles.chartTitle}>
          <TrendingUp size={18} color="#8b5cf6" /> Bookings Growth
        </h3>
        <div className={styles.chartWrap}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ec4899" stopOpacity={0.9} />
                  <stop offset="50%" stopColor="#8b5cf6" stopOpacity={0.9} />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.9} />
                </linearGradient>
              </defs>
              <XAxis dataKey="name" fontSize={12} stroke="var(--text-muted)" tickLine={false} axisLine={false} />
              <YAxis fontSize={12} stroke="var(--text-muted)" tickLine={false} axisLine={false} />
              <Tooltip
                cursor={{ fill: 'rgba(0,0,0,0.02)' }}
                contentStyle={{ borderRadius: 12, border: '1px solid rgba(139,92,246,0.2)', backgroundColor: '#fff', color: '#0f172a' }}
                itemStyle={{ color: '#0f172a', fontWeight: 600 }}
              />
              <Bar dataKey="bookings" fill="url(#barGrad)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card">
        <h3 className={styles.chartTitle}>
          <IndianRupee size={18} color="#ec4899" /> All-Time Payment Status
        </h3>
        <div className={styles.chartWrap}>
          {pieData.length === 0 ? (
            <p className={styles.noData}>No payment data</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={6} dataKey="value" stroke="none">
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} style={{ filter: 'drop-shadow(0px 4px 8px rgba(0,0,0,0.2))' }} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: '1px solid rgba(236,72,153,0.2)', backgroundColor: '#fff', color: '#0f172a' }}
                  itemStyle={{ fontWeight: 600 }}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
        {/* Legend */}
        <div className={styles.pieLegend}>
          {pieData.map(d => (
            <div key={d.name} className={styles.legendItem}>
              <span className={styles.legendDot} style={{ background: d.color }} />
              <span>{d.name}: <strong>{d.value}</strong></span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const FILTER_OPTIONS = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'overall', label: 'All Time' },
];

export default function Dashboard() {
  const { selectedTurf } = useAuth();
  const [stats, setStats] = useState(null);
  const [isActive, setIsActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [filter, setFilter] = useState('month');
  const [downloadMenuOpen, setDownloadMenuOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });

  useEffect(() => {
    const handleClick = (e) => {
      if (!e.target.closest('[data-dropdown="download"]')) setDownloadMenuOpen(false);
    };
    if (downloadMenuOpen) document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [downloadMenuOpen]);

  useEffect(() => {
    if (!selectedTurf?.id) { setLoading(false); return; }
    setLoading(true);
    api.get(`/turf-owner/stats/${selectedTurf.id}`)
      .then(r => { setStats(r.data.stats); setIsActive(r.data.isActive); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [selectedTurf?.id]);

  const handleToggleStatus = async () => {
    if (!window.confirm(`Are you sure you want to ${isActive ? 'DISABLE' : 'ENABLE'} this turf?`)) return;
    setToggling(true);
    try {
      const { data } = await api.put(`/turf-owner/turf/${selectedTurf.id}/toggle-status`);
      if (data.success) setIsActive(data.is_active);
    } catch (e) {
      alert('Failed to toggle turf status');
    } finally {
      setToggling(false);
    }
  };

  const handleDownloadCSV = () => {
    if (!stats || !selectedTurf) return;
    const { overall, month, today: todayStats } = stats;
    const csvRows = [
      ['Turf Performance Report', selectedTurf.name],
      ['Generated On', new Date().toLocaleString()],
      [],
      ['Metric', 'All-Time', 'This Month', 'Today'],
      ['Total Bookings', overall?.totalBookings || 0, month?.totalBookings || 0, todayStats?.totalBookings || 0],
      ['Revenue (Rs)', overall?.revenue || 0, month?.revenue || 0, todayStats?.revenue || 0],
      ['Pending Cash (Rs)', overall?.pending || 0, month?.pending || 0, todayStats?.pending || 0],
      ['Fully Paid', overall?.fullyPaid || 0, month?.fullyPaid || 0, todayStats?.fullyPaid || 0],
    ];
    const csv = 'data:text/csv;charset=utf-8,' + csvRows.map(e => e.join(',')).join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csv));
    link.setAttribute('download', `TurfReport_${selectedTurf.name.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadPDF = () => {
    if (!stats || !selectedTurf) return;
    setDownloadingPdf(true);
    try {
      const doc = new jsPDF();
      doc.setFontSize(22); doc.setTextColor(15, 23, 42);
      doc.text(selectedTurf.name, 14, 22);
      doc.setFontSize(14); doc.setTextColor(71, 85, 105);
      doc.text('Performance Report', 14, 30);
      doc.setFontSize(10); doc.setTextColor(148, 163, 184);
      doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 36);

      const { overall, month, week, today: todayStats } = stats;
      autoTable(doc, {
        startY: 45,
        head: [['Metric', 'All-Time', 'This Month', 'This Week', 'Today']],
        body: [
          ['Total Bookings', overall?.totalBookings || 0, month?.totalBookings || 0, week?.totalBookings || 0, todayStats?.totalBookings || 0],
          ['Revenue', `Rs. ${fmt(overall?.revenue)}`, `Rs. ${fmt(month?.revenue)}`, `Rs. ${fmt(week?.revenue)}`, `Rs. ${fmt(todayStats?.revenue)}`],
          ['Pending Cash', `Rs. ${fmt(overall?.pending)}`, `Rs. ${fmt(month?.pending)}`, `Rs. ${fmt(week?.pending)}`, `Rs. ${fmt(todayStats?.pending)}`],
          ['Fully Paid', overall?.fullyPaid || 0, month?.fullyPaid || 0, week?.fullyPaid || 0, todayStats?.fullyPaid || 0],
        ],
        theme: 'striped',
        headStyles: { fillColor: [0, 212, 170], textColor: [255, 255, 255], fontStyle: 'bold' },
        styles: { fontSize: 10, cellPadding: 8, textColor: [51, 65, 85] },
        columnStyles: { 0: { fontStyle: 'bold' } },
        alternateRowStyles: { fillColor: [248, 250, 252] },
      });
      doc.save(`TurfReport_${selectedTurf.name.replace(/\s+/g, '_')}.pdf`);
    } catch (error) {
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setDownloadingPdf(false);
    }
  };

  if (!selectedTurf) {
    return (
      <div className={styles.emptyState}>
        <h2>No turf found</h2>
        <p>Contact admin to associate a turf with your account.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={styles.loadingState}>
        <div className="spinner" style={{ width: 40, height: 40 }} />
      </div>
    );
  }

  const currentStats = stats?.[filter] || {};

  return (
    <div className="animate-fadeIn">
      {/* Page header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.turfTitle}>{selectedTurf.name}</h1>
          <p className={styles.dateText}>{today}</p>
        </div>
        <div className={styles.headerRight}>
          <button 
            className="btn btn-ghost btn-sm" 
            onClick={() => setIsEditModalOpen(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1px solid var(--border)', marginRight: 16 }}
          >
            <Edit size={16} /> Edit Turf
          </button>
          <span className={styles.statusText} style={{ color: isActive ? '#10b981' : '#ef4444' }}>
            {toggling ? 'Updating...' : isActive ? '● Online' : '○ Offline'}
          </span>
          <div
            className={styles.toggle}
            data-active={isActive}
            onClick={handleToggleStatus}
            style={{ cursor: toggling ? 'not-allowed' : 'pointer', opacity: toggling ? 0.7 : 1 }}
          >
            <div className={styles.toggleThumb} data-active={isActive} />
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className={styles.quickActions}>
        <div className={styles.quickLinks}>
          {[
            { label: 'View Slots', href: '/slots' },
            { label: 'All Bookings', href: '/bookings' },
            { label: 'Scan QR', href: '/scanner' },
          ].map(({ label, href }) => (
            <a key={href} href={href} className="btn btn-ghost btn-sm"
              style={{ border: '1px solid var(--primary)', color: 'var(--primary)' }}>
              {label}
            </a>
          ))}
        </div>

        <div data-dropdown="download" className={styles.downloadWrap}>
          <button
            onClick={() => setDownloadMenuOpen(!downloadMenuOpen)}
            disabled={downloadingPdf}
            className={styles.exportBtn}
          >
            <Download size={16} />
            {downloadingPdf ? 'Generating...' : 'Export'}
            <ChevronDown size={13} style={{ transform: downloadMenuOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
          </button>

          {downloadMenuOpen && !downloadingPdf && (
            <div className={`animate-fadeIn ${styles.downloadMenu}`}>
              <button className={styles.downloadMenuItem} onClick={() => { handleDownloadPDF(); setDownloadMenuOpen(false); }}>
                <FileText size={15} color="#ef4444" /> Save as PDF
              </button>
              <button className={styles.downloadMenuItem} onClick={() => { handleDownloadCSV(); setDownloadMenuOpen(false); }}>
                <Download size={15} color="#10b981" /> Save as CSV
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Filter tabs + Stats */}
      <div className={styles.overviewSection}>
        <div className={styles.overviewHeader}>
          <h2 className={styles.overviewTitle}>Overview</h2>
          <div className={styles.filterTabs}>
            {FILTER_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setFilter(opt.value)}
                className={`${styles.filterTab} ${filter === opt.value ? styles.filterTabActive : ''}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.statsGrid}>
          <StatCard icon={CalendarDays} label="Total Bookings" value={currentStats.totalBookings ?? 0} color="#3b82f6" />
          <StatCard icon={IndianRupee} label="Revenue" value={`₹${fmt(currentStats.revenue)}`} color="#10b981" />
          <StatCard icon={AlertCircle} label="Pending Cash" value={`₹${fmt(currentStats.pending)}`} color="#f59e0b" />
          <StatCard icon={CheckCircle2} label="Confirmed" value={currentStats.confirmedBookings ?? 0} color="#10b981" />
          <StatCard icon={Clock} label="Completed" value={currentStats.completedBookings ?? 0} color="#8b5cf6" />
          <StatCard icon={Users} label="Hours Booked" value={currentStats.bookedSlotsCount ?? 0} color="#ec4899" />
        </div>

        <PaymentBreakdown data={currentStats} label={FILTER_OPTIONS.find(o => o.value === filter)?.label} />
      </div>

      {/* Charts */}
      <GraphsSection stats={stats} />

      {/* Edit Modal */}
      {isEditModalOpen && (
        <EditTurfModal 
          turfId={selectedTurf.id} 
          onClose={() => setIsEditModalOpen(false)}
          onSave={(updatedTurf) => {
            setIsEditModalOpen(false);
            // Optionally refresh the selectedTurf Name in context here
            // But usually just a reload or letting next load get it is okay
            window.location.reload();
          }}
        />
      )}
    </div>
  );
}
