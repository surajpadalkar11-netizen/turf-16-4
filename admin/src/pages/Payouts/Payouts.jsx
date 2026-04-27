import { useState, useEffect } from 'react';
import api from '../../services/api';
import './Payouts.css';

const fmt = (n) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

const fmtDate = (d) =>
  new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

export default function Payouts() {
  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState([]);
  const [stats, setStats] = useState(null);
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });
  const [processing, setProcessing] = useState({});
  const [toast, setToast] = useState(null);

  useEffect(() => { fetchData(); }, [status, page]);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [bRes, sRes] = await Promise.all([
        api.get(`/admin/payouts?status=${status}&page=${page}&limit=20`),
        api.get('/admin/payouts/stats'),
      ]);
      setBookings(bRes.data.bookings || []);
      setPagination(bRes.data.pagination || { total: 0, pages: 1 });
      setStats(sRes.data.stats || null);
    } catch (err) {
      console.error('Payout fetch error:', err);
      showToast(err.response?.data?.message || 'Failed to load payouts', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handlePayout = async (booking) => {
    const turf   = booking.turf;
    const amount = booking.wallet_amount_used;

    if (!turf?.razorpay_key_id) {
      showToast(`⚠️ ${turf?.name || 'This turf'} has no Razorpay account configured. Ask the owner to add it in turf settings.`, 'error');
      return;
    }

    setProcessing((p) => ({ ...p, [booking.id]: true }));
    try {
      await api.post(`/admin/payouts/${booking.id}`, { amount });
      showToast(`✅ ₹${Number(amount).toLocaleString('en-IN')} paid out to ${turf.name}. Email sent to owner.`, 'success');
      fetchData();
    } catch (err) {
      showToast(`❌ Payout failed: ${err.response?.data?.message || 'Unknown error'}`, 'error');
    } finally {
      setProcessing((p) => ({ ...p, [booking.id]: false }));
    }
  };

  return (
    <div className="po-page animate-fade">
      {/* Toast */}
      {toast && (
        <div
          className={`toast toast-${toast.type}`}
          style={{ position: 'fixed', top: 24, right: 24, zIndex: 9999, maxWidth: 420, lineHeight: 1.5 }}
        >
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="po-header">
        <div>
          <h1>Payout Management</h1>
          <p className="po-header-sub">
            Manage wallet-paid bookings and process payouts to turf owners
          </p>
        </div>
      </div>

      {/* Stats */}
      {loading && !stats ? (
        <div className="po-stats-grid">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton" style={{ height: 100, borderRadius: 16 }} />
          ))}
        </div>
      ) : stats ? (
        <div className="po-stats-grid">
          <div className="po-stat-card">
            <div>
              <div className="po-stat-label">Total Wallet Bookings</div>
              <div className="po-stat-value">{stats.totalBookings}</div>
            </div>
            <div className="po-stat-sub">Paid via wallet</div>
          </div>
          <div className="po-stat-card">
            <div>
              <div className="po-stat-label">Pending Payouts</div>
              <div className="po-stat-value pending">{fmt(stats.pendingAmount)}</div>
            </div>
            <div className="po-stat-sub">{stats.pendingCount} bookings awaiting</div>
          </div>
          <div className="po-stat-card">
            <div>
              <div className="po-stat-label">Completed Payouts</div>
              <div className="po-stat-value completed">{fmt(stats.completedAmount)}</div>
            </div>
            <div className="po-stat-sub">{stats.completedCount} bookings paid out</div>
          </div>
        </div>
      ) : null}

      {/* Filter */}
      <div className="po-filter-bar">
        <span className="po-filter-label">Filter by status:</span>
        <select
          className="po-filter-select"
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
        >
          <option value="all">All Bookings</option>
          <option value="pending">⏳ Pending Payouts</option>
          <option value="completed">✅ Completed Payouts</option>
        </select>
      </div>

      {/* Table */}
      <div className="po-table-card">
        <div className="po-table-scroll">
          {loading ? (
            <div className="po-loading" style={{ padding: 24 }}>
              {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 64, borderRadius: 10 }} />)}
            </div>
          ) : bookings.length === 0 ? (
            <div className="po-empty">
              <div className="po-empty-icon">
                {status === 'pending' ? '🎉' : '📋'}
              </div>
              <p className="po-empty-title">
                {status === 'pending' ? 'All payouts complete!' : 'No bookings found'}
              </p>
              <p className="po-empty-sub">
                {status === 'pending'
                  ? 'Awesome — all wallet-paid bookings have been paid out to turf owners.'
                  : 'No wallet-paid bookings match this filter yet.'}
              </p>
            </div>
          ) : (
            <table className="po-table">
              <thead>
                <tr>
                  <th>Booking ID</th>
                  <th>Turf & Owner</th>
                  <th>Wallet Amount</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((b) => {
                  const isCompleted = b.payout_status === 'completed';
                  const hasRzp = !!b.turf?.razorpay_key_id;
                  return (
                    <tr key={b.id}>
                      <td>
                        <span className="po-booking-id">#{b.id.substring(0, 8).toUpperCase()}</span>
                      </td>
                      <td>
                        <div className="po-turf-name">{b.turf?.name || 'N/A'}</div>
                        <div className="po-turf-email">{b.turf?.owner_email || 'No email'}</div>
                        {hasRzp ? (
                          <span className="po-turf-razorpay">
                            ✓ Razorpay Configured
                          </span>
                        ) : (
                          <span className="po-turf-no-rzp">
                            ⚠ No Razorpay Account
                          </span>
                        )}
                      </td>
                      <td>
                        <span className="po-amount">{fmt(b.wallet_amount_used)}</span>
                      </td>
                      <td>
                        <span className="po-date">{fmtDate(b.created_at)}</span>
                      </td>
                      <td>
                        {isCompleted ? (
                          <span className="po-badge po-badge-completed">✓ Paid Out</span>
                        ) : (
                          <span className="po-badge po-badge-pending">⏳ Pending</span>
                        )}
                        {isCompleted && b.razorpay_payout_id && (
                          <div className="po-payout-ref" style={{ marginTop: 4 }}>
                            Ref: {b.razorpay_payout_id.substring(0, 18)}...
                          </div>
                        )}
                      </td>
                      <td>
                        {!isCompleted && (
                          <button
                            className={`po-pay-btn${processing[b.id] ? ' processing' : ''}`}
                            onClick={() => handlePayout(b)}
                            disabled={processing[b.id]}
                            title={
                              !hasRzp
                                ? 'Turf owner must configure Razorpay account first'
                                : `Pay ₹${Number(b.wallet_amount_used).toLocaleString('en-IN')} to ${b.turf?.name}`
                            }
                          >
                            {processing[b.id] ? '⏳ Processing...' : '💸 Pay Now'}
                          </button>
                        )}
                        {isCompleted && (
                          <span style={{ color: 'var(--color-success)', fontWeight: 700, fontSize: '0.85rem' }}>
                            ✓ Done
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="po-pagination">
          <button
            className="po-page-btn"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            ← Previous
          </button>
          <span className="po-page-info">Page {page} of {pagination.pages}</span>
          <button
            className="po-page-btn"
            onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
            disabled={page === pagination.pages}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
