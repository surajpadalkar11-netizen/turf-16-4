import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { Search, ChevronLeft, ChevronRight, RefreshCw, X } from 'lucide-react';
import styles from './Bookings.module.css';

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

const STATUS_INFO = {
  confirmed: { label: 'Confirmed', cls: 'badge-success' },
  pending:   { label: 'Pending',   cls: 'badge-warning' },
  completed: { label: 'Done',      cls: 'badge-purple'  },
  cancelled: { label: 'Cancelled', cls: 'badge-danger'  },
};

/* ── Collect Modal ── */
function CollectModal({ booking, onClose, onSaved }) {
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const remaining = booking.remainingAmount || 0;

  const handleCollect = async () => {
    if (!amount || Number(amount) <= 0) return;
    setLoading(true);
    try {
      await api.put(`turf-owner/booking/${booking.id}/collect`, { amountCollected: Number(amount) });
      onSaved();
    } finally { setLoading(false); }
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>Collect Cash</h3>
          <button className={styles.modalClose} onClick={onClose}><X size={18} /></button>
        </div>
        <div className={styles.modalInfo}>
          <p>Customer: <strong>{booking.user?.name}</strong></p>
          <p className={styles.pendingAmt}>Pending: ₹{fmt(remaining)}</p>
        </div>
        <div style={{ marginBottom: 20 }}>
          <label className="form-label" style={{ display:'block', marginBottom:8 }}>Amount Received (₹)</label>
          <input type="number" min="1" max={remaining}
            value={amount} onChange={e => setAmount(e.target.value)}
            placeholder={`e.g. ${remaining}`} autoFocus
          />
        </div>
        <div className={styles.modalActions}>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleCollect} disabled={loading || !amount}>
            {loading ? 'Saving...' : 'Save Payment'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   Main Bookings Page
═══════════════════════════════════════════ */
export default function Bookings() {
  const { selectedTurf } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState({ date: '', search: '' });
  const [collectModal, setCollectModal] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchBookings = useCallback(async () => {
    if (!selectedTurf?.id) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 15 });
      if (filters.date) params.set('date', filters.date);
      const { data } = await api.get(`turf-owner/bookings/${selectedTurf.id}?${params}`);
      let b = data.bookings || [];
      if (filters.search) {
        const q = filters.search.toLowerCase();
        b = b.filter(bk =>
          bk.user?.name?.toLowerCase().includes(q) ||
          bk.user?.phone?.toLowerCase().includes(q) ||
          bk.id?.toLowerCase().includes(q)
        );
      }
      setBookings(b);
      setTotalPages(data.totalPages || 1);
      setTotal(data.total || 0);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [selectedTurf?.id, page, filters]);

  useEffect(() => { fetchBookings(); }, [fetchBookings]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchBookings();
    setRefreshing(false);
  };

  const updateStatus = async (id, status) => {
    await api.put(`turf-owner/booking/${id}/status`, { status });
    fetchBookings();
  };

  const setFilter = (key, val) => {
    setFilters(p => ({ ...p, [key]: val }));
    setPage(1);
  };

  const clearFilters = () => { setFilters({ date: '', search: '' }); setPage(1); };
  const setToday = () => setFilter('date', new Date().toISOString().split('T')[0]);
  const hasFilters = filters.date || filters.search;

  return (
    <div className="animate-fadeIn">
      {/* Header */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Manage Bookings</h1>
          <p className={styles.pageSubtitle}>Track customers, slots &amp; payments</p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={handleRefresh} disabled={refreshing}>
          <RefreshCw size={14} style={{ animation: refreshing ? 'spin 0.8s linear infinite' : 'none' }} />
          Refresh
        </button>
      </div>

      {/* Filter bar */}
      <div className={styles.filterBar}>
        <button className={`btn btn-sm ${filters.date === new Date().toISOString().split('T')[0] ? 'btn-primary' : 'btn-ghost'}`} onClick={setToday}>
          Today
        </button>
        <input
          type="date"
          value={filters.date}
          onChange={e => setFilter('date', e.target.value)}
          style={{ width: 'auto', minWidth: 150 }}
        />
        <div className={styles.searchWrap}>
          <Search size={14} className={styles.searchIcon} />
          <input
            className={styles.searchInput}
            placeholder="Search name or phone..."
            value={filters.search}
            onChange={e => setFilter('search', e.target.value)}
          />
          {filters.search && (
            <button className={styles.searchClear} onClick={() => setFilter('search', '')}>
              <X size={12} />
            </button>
          )}
        </div>
        {hasFilters && (
          <button className="btn btn-ghost btn-sm" onClick={clearFilters}>
            <X size={13} /> Clear
          </button>
        )}
        {total > 0 && (
          <span className={styles.totalCount}>{total} booking{total !== 1 ? 's' : ''}</span>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className={styles.loadingWrap}>
          <div className="spinner" style={{ width: 40, height: 40, borderWidth: 4 }} />
        </div>
      ) : bookings.length === 0 ? (
        <div className={`card ${styles.emptyCard}`}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
          <h3>No bookings found</h3>
          <p>No bookings match your current filter.</p>
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className={`card ${styles.tableCard}`}>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>CUSTOMER</th>
                    <th>DATE &amp; TIME SLOTS</th>
                    <th>PAYMENT</th>
                    <th>STATUS</th>
                    <th style={{ textAlign: 'right' }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.map((b) => {
                    const slotStr = (b.timeSlots || []).map(s => `${formatTime(s.start)}–${formatTime(s.end)}`).join(', ');
                    const remaining = (b.totalAmount || 0) - (b.amountPaid || 0);
                    const si = STATUS_INFO[b.status] || { label: b.status, cls: 'badge-muted' };
                    return (
                      <tr key={b.id}>
                        <td>
                          <div className={styles.customerName}>{b.user?.name}</div>
                          <div className={styles.customerPhone}>{b.user?.phone || '—'}</div>
                        </td>
                        <td>
                          <div className={styles.bookingDate}>
                            {new Date(b.date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </div>
                          <div className={styles.bookingSlots}>{slotStr}</div>
                        </td>
                        <td>
                          <div className={styles.payTotal}>Total: ₹{fmt(b.totalAmount)}</div>
                          {remaining > 0 ? (
                            <div className={styles.payPending}>Collect: ₹{fmt(remaining)}</div>
                          ) : (
                            <div className={styles.payDone}>✓ Fully Paid</div>
                          )}
                        </td>
                        <td>
                          <span className={`badge ${si.cls}`}>{si.label}</span>
                        </td>
                        <td>
                          <div className={styles.actionGroup}>
                            {b.status === 'cancelled' ? (
                              <span className={styles.doneNote}>Cancelled</span>
                            ) : b.status === 'completed' ? (
                              <span className={styles.doneNote}>✓ Done</span>
                            ) : (
                              <>
                                {remaining > 0 && (
                                  <button className="btn btn-success btn-sm" onClick={() => setCollectModal(b)}>
                                    Collect
                                  </button>
                                )}
                                <button className="btn btn-primary btn-sm" onClick={() => updateStatus(b.id, 'completed')}>
                                  Mark Done
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Cards */}
          <div className={styles.mobileCards}>
            {bookings.map((b) => {
              const slotStr = (b.timeSlots || []).map(s => `${formatTime(s.start)}–${formatTime(s.end)}`).join(', ');
              const remaining = (b.totalAmount || 0) - (b.amountPaid || 0);
              const si = STATUS_INFO[b.status] || { label: b.status, cls: 'badge-muted' };
              return (
                <div key={b.id} className={`card ${styles.mobileCard}`}>
                  <div className={styles.mobileCardTop}>
                    <div className={styles.mobileAvatar}>
                      {(b.user?.name || 'U')[0].toUpperCase()}
                    </div>
                    <div className={styles.mobileInfo}>
                      <div className={styles.customerName}>{b.user?.name}</div>
                      <div className={styles.customerPhone}>{b.user?.phone || '—'}</div>
                    </div>
                    <span className={`badge ${si.cls}`}>{si.label}</span>
                  </div>

                  <div className={styles.mobileMeta}>
                    <span>📅 {new Date(b.date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                    <span>⏰ {slotStr}</span>
                  </div>

                  <div className={styles.mobilePayRow}>
                    <span>Total: <strong>₹{fmt(b.totalAmount)}</strong></span>
                    {remaining > 0 ? (
                      <span className={styles.payPending}>Collect: ₹{fmt(remaining)}</span>
                    ) : (
                      <span className={styles.payDone}>✓ Paid</span>
                    )}
                  </div>

                  {b.status !== 'cancelled' && b.status !== 'completed' && (
                    <div className={styles.mobileActions}>
                      {remaining > 0 && (
                        <button className="btn btn-success btn-sm" style={{ flex: 1 }} onClick={() => setCollectModal(b)}>
                          Collect Cash
                        </button>
                      )}
                      <button className="btn btn-primary btn-sm" style={{ flex: 1 }} onClick={() => updateStatus(b.id, 'completed')}>
                        Mark Done
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className={styles.pagination}>
              <button className="btn btn-ghost btn-sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                <ChevronLeft size={16} />
              </button>
              <span className={styles.pageInfo}>Page {page} of {totalPages}</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </>
      )}

      {collectModal && (
        <CollectModal
          booking={collectModal}
          onClose={() => setCollectModal(null)}
          onSaved={() => { setCollectModal(null); fetchBookings(); }}
        />
      )}
    </div>
  );
}
