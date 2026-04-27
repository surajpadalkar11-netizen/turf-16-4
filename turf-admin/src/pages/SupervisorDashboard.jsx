import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { RefreshCw, Clock, IndianRupee, CheckCircle2, AlertCircle, QrCode, Search, X, ChevronLeft, ChevronRight } from 'lucide-react';
import styles from './SupervisorDashboard.module.css';

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

const formatDate = (dateStr) =>
  new Date(dateStr + 'T00:00:00').toLocaleDateString('en-IN', {
    weekday: 'short', day: 'numeric', month: 'long', year: 'numeric',
  });

const STATUS_BADGE = {
  confirmed: { label: 'Confirmed', cls: 'badge-success' },
  pending:   { label: 'Pending',   cls: 'badge-warning' },
  completed: { label: 'Done',      cls: 'badge-purple' },
};

const PAY_BADGE = {
  paid:           { label: 'Fully Paid',   color: '#10b981' },
  partially_paid: { label: 'Partial',      color: '#f59e0b' },
  unpaid:         { label: 'Cash Due',     color: '#ef4444' },
};

/* ── Booking Code Badge ── */
function BookingCodeBadge({ code }) {
  return (
    <span className={styles.bookingCode}>
      <QrCode size={12} />
      {code}
    </span>
  );
}

/* ── Stat Card ── */
function StatCard({ icon: Icon, label, value, sub, accent }) {
  return (
    <div className={styles.statCard} style={{ '--accent': accent }}>
      <div className={styles.statIcon}><Icon size={20} /></div>
      <div className={styles.statBody}>
        <div className={styles.statValue}>{value}</div>
        <div className={styles.statLabel}>{label}</div>
        {sub && <div className={styles.statSub}>{sub}</div>}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   Supervisor Dashboard
═══════════════════════════════════════════ */
export default function SupervisorDashboard() {
  const { user, selectedTurf } = useAuth();
  const supervisorTurfId = localStorage.getItem('turfowner_supervisor_turf_id');
  const turfId = supervisorTurfId || selectedTurf?.id;

  const [turfInfo, setTurfInfo] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [page, setPage] = useState(1);
  const PER_PAGE = 10;

  const fetchData = useCallback(async () => {
    if (!turfId) return;
    setLoading(true);
    try {
      const [turfRes, bookRes] = await Promise.all([
        api.get(`/turf-owner/supervisor/turf-info`).catch(() => null),
        api.get(`/turf-owner/supervisor/bookings?turfId=${turfId}&date=${date}`),
      ]);
      if (turfRes) setTurfInfo(turfRes.data.turf);
      setBookings(bookRes.data.bookings || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [turfId, date]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  // Derived stats
  const totalRevenue = bookings.reduce((s, b) => s + (b.amountPaid || 0), 0);
  const totalDue = bookings.reduce((s, b) => s + (b.remainingAmount || 0), 0);
  const fullyPaid = bookings.filter((b) => b.paymentStatus === 'paid').length;
  const cashDue = bookings.filter((b) => b.remainingAmount > 0).length;

  // Filter
  const filtered = bookings.filter((b) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      b.user?.name?.toLowerCase().includes(q) ||
      b.user?.phone?.toLowerCase().includes(q) ||
      b.bookingCode?.toLowerCase().includes(q)
    );
  });

  // Paginate
  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const isToday = date === new Date().toISOString().split('T')[0];

  return (
    <div className={`animate-fadeIn ${styles.wrapper}`}>
      {/* ── Header ── */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.supervisorBadge}>
            <span className={styles.supervisorBadgeDot} />
            Supervisor View
          </div>
          <h1 className={styles.title}>
            {turfInfo?.name || selectedTurf?.name || 'Turf'} — Daily Overview
          </h1>
          <p className={styles.subtitle}>
            Read-only · {isToday ? 'Today' : formatDate(date)}
          </p>
        </div>
        <button
          className="btn btn-ghost btn-sm"
          onClick={handleRefresh}
          disabled={refreshing}
        >
          <RefreshCw size={14} style={{ animation: refreshing ? 'spin 0.8s linear infinite' : 'none' }} />
          Refresh
        </button>
      </div>

      {/* ── Date picker bar ── */}
      <div className={styles.dateBar}>
        <button
          className={`btn btn-sm ${isToday ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => { setDate(new Date().toISOString().split('T')[0]); setPage(1); }}
        >
          Today
        </button>
        <input
          type="date"
          value={date}
          onChange={(e) => { setDate(e.target.value); setPage(1); }}
          style={{ width: 'auto', minWidth: 150 }}
        />
        <div className={styles.searchWrap}>
          <Search size={14} className={styles.searchIcon} />
          <input
            className={styles.searchInput}
            placeholder="Search name, phone or code…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
          {search && (
            <button className={styles.searchClear} onClick={() => setSearch('')}>
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* ── Stat Cards ── */}
      <div className={styles.statsGrid}>
        <StatCard icon={Clock}        label="Total Bookings"  value={bookings.length}       accent="#6366f1" />
        <StatCard icon={IndianRupee}   label="Collected"       value={`₹${fmt(totalRevenue)}`} accent="#10b981" />
        <StatCard icon={AlertCircle}   label="Cash Due"        value={`₹${fmt(totalDue)}`}    sub={`${cashDue} booking${cashDue !== 1 ? 's' : ''}`} accent="#f59e0b" />
        <StatCard icon={CheckCircle2}  label="Fully Paid"      value={fullyPaid}              accent="#10b981" />
      </div>

      {/* ── Bookings Table ── */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
          <div className="spinner" style={{ width: 40, height: 40, borderWidth: 4 }} />
        </div>
      ) : filtered.length === 0 ? (
        <div className={`card ${styles.emptyCard}`}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
          <h3>No bookings for this date</h3>
          <p>Try selecting a different date or clearing the search.</p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className={`card ${styles.tableCard}`}>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>BOOKING CODE</th>
                    <th>CUSTOMER</th>
                    <th>TIME SLOTS</th>
                    <th>PAYMENT</th>
                    <th>STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((b) => {
                    const slotStr = (b.timeSlots || [])
                      .map((s) => `${formatTime(s.start)}–${formatTime(s.end)}`)
                      .join(', ');
                    const si = STATUS_BADGE[b.status] || { label: b.status, cls: 'badge-muted' };
                    const pi = PAY_BADGE[b.paymentStatus] || PAY_BADGE.unpaid;
                    return (
                      <tr key={b.id}>
                        <td>
                          <BookingCodeBadge code={b.bookingCode} />
                        </td>
                        <td>
                          <div className={styles.custName}>{b.user?.name || '—'}</div>
                          <div className={styles.custPhone}>{b.user?.phone || '—'}</div>
                        </td>
                        <td>
                          <div className={styles.slots}>{slotStr || '—'}</div>
                          <div className={styles.slotSub}>{b.playerCount} player{b.playerCount !== 1 ? 's' : ''}</div>
                        </td>
                        <td>
                          <div className={styles.payRow}>
                            <span className={styles.payTotal}>Total: ₹{fmt(b.totalAmount)}</span>
                          </div>
                          <div className={styles.payRow}>
                            <span className={styles.payPaid}>Paid: ₹{fmt(b.amountPaid)}</span>
                            {b.remainingAmount > 0 && (
                              <span className={styles.payDue}>Due: ₹{fmt(b.remainingAmount)}</span>
                            )}
                          </div>
                          <div style={{ marginTop: 4 }}>
                            <span className={styles.payBadge} style={{ color: pi.color, borderColor: pi.color + '33', background: pi.color + '12' }}>
                              {pi.label}
                            </span>
                          </div>
                        </td>
                        <td>
                          <span className={`badge ${si.cls}`}>{si.label}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile cards */}
          <div className={styles.mobileCards}>
            {paginated.map((b) => {
              const slotStr = (b.timeSlots || [])
                .map((s) => `${formatTime(s.start)}–${formatTime(s.end)}`)
                .join(', ');
              const si = STATUS_BADGE[b.status] || { label: b.status, cls: 'badge-muted' };
              const pi = PAY_BADGE[b.paymentStatus] || PAY_BADGE.unpaid;
              return (
                <div key={b.id} className={`card ${styles.mobileCard}`}>
                  <div className={styles.mobileCardTop}>
                    <div className={styles.mobileAvatar}>
                      {(b.user?.name || 'U')[0].toUpperCase()}
                    </div>
                    <div className={styles.mobileInfo}>
                      <div className={styles.custName}>{b.user?.name || '—'}</div>
                      <div className={styles.custPhone}>{b.user?.phone || '—'}</div>
                    </div>
                    <span className={`badge ${si.cls}`}>{si.label}</span>
                  </div>
                  <div className={styles.mobileCodeRow}>
                    <BookingCodeBadge code={b.bookingCode} />
                    <span className={styles.payBadge} style={{ color: pi.color, borderColor: pi.color + '33', background: pi.color + '12' }}>
                      {pi.label}
                    </span>
                  </div>
                  <div className={styles.mobileMeta}>
                    <span>⏰ {slotStr || '—'}</span>
                    <span>👥 {b.playerCount} player{b.playerCount !== 1 ? 's' : ''}</span>
                  </div>
                  <div className={styles.mobilePayRow}>
                    <span>Total: <strong>₹{fmt(b.totalAmount)}</strong></span>
                    <span className={styles.payPaid}>Paid: ₹{fmt(b.amountPaid)}</span>
                    {b.remainingAmount > 0 && (
                      <span className={styles.payDue}>Due: ₹{fmt(b.remainingAmount)}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className={styles.pagination}>
              <button className="btn btn-ghost btn-sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
                <ChevronLeft size={16} />
              </button>
              <span className={styles.pageInfo}>Page {page} of {totalPages}</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </>
      )}

      {/* ── Read-only notice ── */}
      <div className={styles.readonlyNotice}>
        🔒 Supervisor view is read-only. Contact the turf owner to make changes.
      </div>
    </div>
  );
}
