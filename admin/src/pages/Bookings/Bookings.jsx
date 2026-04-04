import { useState, useEffect } from 'react';
import * as bookingService from '../../services/bookingService';

const formatPrice = (amount) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
const formatDate = (date) =>
  new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

function Bookings() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [toast, setToast] = useState(null);

  useEffect(() => { loadBookings(); }, [statusFilter, page]);

  const loadBookings = async () => {
    setLoading(true);
    try {
      const params = { page, limit: 15 };
      if (statusFilter) params.status = statusFilter;
      const { data } = await bookingService.getAllBookings(params);
      setBookings(data.bookings || []);
      setTotalPages(data.totalPages || 1);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleStatusChange = async (id, newStatus) => {
    try {
      await bookingService.updateBookingStatus(id, newStatus);
      showToast(`Booking ${newStatus}`);
      loadBookings();
    } catch (err) {
      showToast(err.response?.data?.message || 'Update failed', 'error');
    }
  };

  const handleProcessRefund = async (id, maxAmount) => {
    const amountStr = window.prompt(`Direct Razorpay Refund:\n\nEnter amount to refund back to the user's account (Max: ₹${maxAmount}):`, maxAmount);
    if (amountStr === null) return;
    
    const amount = Number(amountStr);
    if (isNaN(amount) || amount <= 0 || amount > maxAmount) {
      return showToast('Invalid refund amount', 'error');
    }

    if (!window.confirm(`Are you absolutely sure you want to instantly remit ₹${amount} to the original payment source?`)) return;
    
    try {
      await bookingService.processRefund(id, amount);
      showToast(`Refund of ₹${amount} initiated via Razorpay`, 'success');
      loadBookings();
    } catch (err) {
      showToast(err.response?.data?.message || 'Refund failed: please check logs', 'error');
    }
  };

  const statuses = ['', 'pending', 'confirmed', 'playing', 'completed', 'cancelled'];

  return (
    <div className="animate-fade">
      <div className="page-header">
        <h1>Booking Management</h1>
      </div>

      <div className="toolbar">
        {statuses.map((s) => (
          <button
            key={s}
            className={`btn btn-sm ${statusFilter === s ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => { setStatusFilter(s); setPage(1); }}
          >
            {s || 'All'}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[1, 2, 3, 4, 5].map((i) => <div key={i} className="skeleton" style={{ height: 56, borderRadius: 10 }} />)}
        </div>
      ) : bookings.length === 0 ? (
        <div className="empty-state card">
          <div className="icon">📋</div>
          <h3>No Bookings Found</h3>
          <p>No bookings match the current filter</p>
        </div>
      ) : (
        <>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Turf</th>
                  <th>User</th>
                  <th>Date</th>
                  <th>Slots</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((b) => (
                  <tr key={b._id}>
                    <td><strong>{b.turf?.name || '—'}</strong></td>
                    <td>
                      <div>{b.user?.name || '—'}</div>
                      <small style={{ color: 'var(--color-text-muted)' }}>{b.user?.email}</small>
                    </td>
                    <td>{formatDate(b.date)}</td>
                    <td>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {b.timeSlots?.map((s, i) => (
                          <span key={i} style={{ background: 'var(--color-primary-light)', color: 'var(--color-primary)', padding: '2px 8px', borderRadius: 10, fontSize: 'var(--font-xs)', fontWeight: 600 }}>
                            {s.start}–{s.end}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td><strong>{formatPrice(b.totalAmount)}</strong></td>
                    <td>
                      {b.notes === 'REFUND_PROCESSED' ? (
                        <span className="badge" style={{ background: '#ecfdf5', color: '#059669', border: '1px solid #10b981' }}>💵 Refunded</span>
                      ) : (
                        <span className={`badge badge-${b.status}`}>{b.status === 'playing' ? '🏃 Playing' : b.status}</span>
                      )}
                    </td>
                    <td>
                      <div className="actions-cell">
                        {b.status === 'pending' && (
                          <button className="btn btn-sm btn-primary" onClick={() => handleStatusChange(b._id, 'confirmed')}>Confirm</button>
                        )}
                        {b.status !== 'cancelled' && b.status !== 'completed' && b.status !== 'playing' && b.status !== 'pending' && (
                          <button className="btn btn-sm btn-danger" onClick={() => handleStatusChange(b._id, 'cancelled')}>Cancel</button>
                        )}
                        {b.status === 'cancelled' && b.notes !== 'REFUND_PROCESSED' && b.totalAmount > 0 && (
                          <button className="btn btn-sm" style={{ background: '#f59e0b', color: 'white' }} onClick={() => handleProcessRefund(b._id, b.totalAmount)}>
                            Process Refund
                          </button>
                        )}
                        {b.notes === 'REFUND_PROCESSED' && (
                          <span style={{ color: 'var(--color-success)', fontSize: 'var(--font-sm)', fontWeight: 600 }}>✅ Refunded successfully</span>
                        )}
                        {(b.status === 'playing') && (
                          <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-xs)', fontStyle: 'italic' }}>Auto-completes after slot ends</span>
                        )}
                        {(b.status === 'completed') && (
                          <span style={{ color: 'var(--color-success)', fontSize: 'var(--font-xs)' }}>✅ Done</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="pagination">
              <button disabled={page <= 1} onClick={() => setPage(page - 1)}>← Prev</button>
              <span>Page {page} of {totalPages}</span>
              <button disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next →</button>
            </div>
          )}
        </>
      )}

      {toast && (
        <div className="toast-container">
          <div className={`toast toast-${toast.type}`}>{toast.msg}</div>
        </div>
      )}
    </div>
  );
}

export default Bookings;
