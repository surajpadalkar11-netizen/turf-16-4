import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';
import styles from './Bookings.module.css';

const fmt = (n) => new Intl.NumberFormat('en-IN').format(Math.round(n || 0));

function CollectModal({ booking, onClose, onSaved }) {
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const remaining = booking.remainingAmount || 0;

  const handleCollect = async () => {
    if (!amount || Number(amount) <= 0) return;
    setLoading(true);
    try {
      await api.put(`/turf-owner/booking/${booking.id}/collect`, { amountCollected: Number(amount) });
      onSaved();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <h3 className={styles.modalTitle}>Collect Cash</h3>
        <div className={styles.modalInfo}>
          <p>Customer: <strong>{booking.user?.name}</strong></p>
          <p className={styles.pendingAmt}>Pending: ₹{fmt(remaining)}</p>
        </div>
        <div className={styles.modalField}>
          <label>Amount received (₹)</label>
          <input
            type="number" min="1" max={remaining}
            value={amount} onChange={e => setAmount(e.target.value)}
            placeholder={`e.g. ${remaining}`} autoFocus
          />
        </div>
        <div className={styles.modalActions}>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-success" onClick={handleCollect} disabled={loading || !amount}>
            {loading ? 'Saving...' : 'Save Payment'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Bookings() {
  const { selectedTurf } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState({ date: '', search: '' });
  const [collectModal, setCollectModal] = useState(null);

  const fetchBookings = useCallback(async () => {
    if (!selectedTurf?.id) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 15 });
      if (filters.date) params.set('date', filters.date);

      const { data } = await api.get(`/turf-owner/bookings/${selectedTurf.id}?${params}`);
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
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [selectedTurf?.id, page, filters]);

  useEffect(() => { fetchBookings(); }, [fetchBookings]);

  const updateStatus = async (id, status) => {
    await api.put(`/turf-owner/booking/${id}/status`, { status });
    fetchBookings();
  };

  const setFilter = (key, val) => {
    setFilters(p => ({ ...p, [key]: val }));
    setPage(1);
  };

  const setToday = () => setFilter('date', new Date().toISOString().split('T')[0]);

  return (
    <div className="animate-fadeIn">
      {/* Header */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Manage Bookings</h1>
          <p className={styles.pageSubtitle}>Track customers and payments</p>
        </div>

        <div className={styles.filterRow}>
          <button className="btn btn-ghost btn-sm" onClick={setToday}
            style={{ border: '1px solid var(--primary)', color: 'var(--primary)', fontWeight: 700 }}>
            Today
          </button>

          <input
            type="date" value={filters.date}
            onChange={e => setFilter('date', e.target.value)}
            style={{ width: 'auto' }}
          />

          <div className={styles.searchWrap}>
            <Search size={15} className={styles.searchIcon} />
            <input
              className={styles.searchInput}
              placeholder="Search name or phone..."
              value={filters.search}
              onChange={e => setFilter('search', e.target.value)}
            />
          </div>

          {(filters.date || filters.search) && (
            <button className="btn btn-ghost btn-sm"
              onClick={() => { setFilters({ date: '', search: '' }); setPage(1); }}>
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className={styles.loadingWrap}>
          <div className="spinner" style={{ width: 40, height: 40, borderWidth: 4 }} />
        </div>
      ) : bookings.length === 0 ? (
        <div className={`card ${styles.emptyCard}`}>
          <h2>No bookings found</h2>
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
                    <th>DATE &amp; SLOTS</th>
                    <th>PAYMENT</th>
                    <th style={{ textAlign: 'right' }}>ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.map((b) => {
                    const slots = (b.timeSlots || []).map(s => `${s.start}–${s.end}`).join(', ');
                    const remaining = (b.totalAmount || 0) - (b.amountPaid || 0);
                    return (
                      <tr key={b.id}>
                        <td>
                          <div className={styles.customerName}>{b.user?.name}</div>
                          <div className={styles.customerPhone}>{b.user?.phone || 'No phone'}</div>
                        </td>
                        <td>
                          <div className={styles.bookingDate}>
                            {new Date(b.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </div>
                          <div className={styles.bookingSlots}>{slots}</div>
                        </td>
                        <td>
                          <div className={styles.payTotal}>Total: ₹{fmt(b.totalAmount)}</div>
                          {remaining > 0 ? (
                            <div className={styles.payPending}>Collect: ₹{fmt(remaining)}</div>
                          ) : (
                            <div className={styles.payDone}>Fully Paid</div>
                          )}
                        </td>
                        <td>
                          <div className={styles.actionGroup}>
                            {b.status === 'cancelled' ? (
                              <span className="badge badge-danger">Cancelled</span>
                            ) : b.status === 'completed' ? (
                              <span className="badge badge-success">Match Done</span>
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

          {/* Mobile Cards (shown instead of table on small screens) */}
          <div className={styles.mobileCards}>
            {bookings.map((b) => {
              const slots = (b.timeSlots || []).map(s => `${s.start}–${s.end}`).join(', ');
              const remaining = (b.totalAmount || 0) - (b.amountPaid || 0);
              return (
                <div key={b.id} className={`card ${styles.mobileCard}`}>
                  <div className={styles.mobileCardTop}>
                    <div>
                      <div className={styles.customerName}>{b.user?.name}</div>
                      <div className={styles.customerPhone}>{b.user?.phone || 'No phone'}</div>
                    </div>
                    {b.status === 'cancelled' ? (
                      <span className="badge badge-danger">Cancelled</span>
                    ) : b.status === 'completed' ? (
                      <span className="badge badge-success">Done</span>
                    ) : (
                      <span className="badge badge-warning">Active</span>
                    )}
                  </div>
                  <div className={styles.mobileCardMeta}>
                    <span>📅 {new Date(b.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                    <span>⏰ {slots}</span>
                  </div>
                  <div className={styles.mobileCardPayment}>
                    <span>Total: <strong>₹{fmt(b.totalAmount)}</strong></span>
                    {remaining > 0 ? (
                      <span className={styles.payPending}>Collect: ₹{fmt(remaining)}</span>
                    ) : (
                      <span className={styles.payDone}>Paid ✓</span>
                    )}
                  </div>
                  {b.status !== 'cancelled' && b.status !== 'completed' && (
                    <div className={styles.mobileCardActions}>
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
                <ChevronLeft size={18} />
              </button>
              <span className={styles.pageInfo}>Page {page} of {totalPages}</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                <ChevronRight size={18} />
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
