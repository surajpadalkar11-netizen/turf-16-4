import { useState, useEffect } from 'react';
import api from '../services/api';
import styles from './Payouts.module.css';

export default function Payouts() {
  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState([]);
  const [stats, setStats] = useState(null);
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });
  const [processing, setProcessing] = useState({});

  useEffect(() => {
    fetchData();
  }, [status, page]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [bookingsRes, statsRes] = await Promise.all([
        api.get(`/admin/payouts?status=${status}&page=${page}&limit=20`),
        api.get('/admin/payouts/stats'),
      ]);

      setBookings(bookingsRes.data.bookings || []);
      setPagination(bookingsRes.data.pagination);
      setStats(statsRes.data.stats);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handlePayout = async (bookingId, amount) => {
    if (!confirm(`Process payout of ₹${amount}? This action cannot be undone.`)) return;

    setProcessing((prev) => ({ ...prev, [bookingId]: true }));
    try {
      await api.post(`/admin/payouts/${bookingId}`, { amount });
      alert('Payout marked as completed!');
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to process payout');
    } finally {
      setProcessing((prev) => ({ ...prev, [bookingId]: false }));
    }
  };

  if (loading && !stats) {
    return (
      <div className={styles.page}>
        <div className={styles.loading}>Loading payouts...</div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Payout Management</h1>
        <p className={styles.subtitle}>Manage wallet-paid bookings and process payouts to turf owners</p>
      </div>

      {stats && (
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <p className={styles.statLabel}>Total Bookings</p>
            <h2 className={styles.statValue}>{stats.totalBookings}</h2>
            <p className={styles.statSubtext}>Paid via wallet</p>
          </div>
          <div className={styles.statCard}>
            <p className={styles.statLabel}>Pending Payouts</p>
            <h2 className={`${styles.statValue} ${styles.pending}`}>
              ₹{stats.pendingAmount.toLocaleString('en-IN')}
            </h2>
            <p className={styles.statSubtext}>{stats.pendingCount} bookings</p>
          </div>
          <div className={styles.statCard}>
            <p className={styles.statLabel}>Completed Payouts</p>
            <h2 className={`${styles.statValue} ${styles.completed}`}>
              ₹{stats.completedAmount.toLocaleString('en-IN')}
            </h2>
            <p className={styles.statSubtext}>{stats.completedCount} bookings</p>
          </div>
        </div>
      )}

      <div className={styles.filters}>
        <span className={styles.filterLabel}>Filter by status:</span>
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className={styles.select}>
          <option value="all">All Bookings</option>
          <option value="pending">Pending Payouts</option>
          <option value="completed">Completed Payouts</option>
        </select>
      </div>

      <div className={styles.table}>
        <div className={styles.tableHeader}>
          <div>Booking ID</div>
          <div>Turf & Owner</div>
          <div>Amount</div>
          <div>Date</div>
          <div>Status</div>
          <div>Action</div>
        </div>

        <div className={styles.tableBody}>
          {loading ? (
            <div className={styles.empty}>
              <div className={styles.emptyIcon}>⏳</div>
              <p className={styles.emptyText}>Loading...</p>
            </div>
          ) : bookings.length === 0 ? (
            <div className={styles.empty}>
              <div className={styles.emptyIcon}>📋</div>
              <p className={styles.emptyText}>No bookings found</p>
              <p className={styles.emptySubtext}>
                {status === 'pending' ? 'All payouts are completed' : 'No wallet-paid bookings yet'}
              </p>
            </div>
          ) : (
            bookings.map((booking) => (
              <div key={booking.id} className={styles.tableRow}>
                <div className={styles.bookingId}>#{booking.id.substring(0, 8).toUpperCase()}</div>
                <div className={styles.turfInfo}>
                  <p className={styles.turfName}>{booking.turf?.name || 'N/A'}</p>
                  <p className={styles.turfOwner}>{booking.turf?.owner_email || 'No email'}</p>
                </div>
                <div className={styles.amount}>₹{Number(booking.wallet_amount_used).toLocaleString('en-IN')}</div>
                <div className={styles.date}>
                  {new Date(booking.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </div>
                <div>
                  <span className={`${styles.badge} ${booking.payout_status === 'completed' ? styles.badgeCompleted : styles.badgePending}`}>
                    {booking.payout_status === 'completed' ? '✓ Completed' : '⏳ Pending'}
                  </span>
                </div>
                <div>
                  {booking.payout_status !== 'completed' && (
                    <button
                      className={styles.payoutBtn}
                      onClick={() => handlePayout(booking.id, booking.wallet_amount_used)}
                      disabled={processing[booking.id]}
                    >
                      {processing[booking.id] ? 'Processing...' : 'Pay Now'}
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {pagination.pages > 1 && (
        <div className={styles.pagination}>
          <button
            className={styles.pageBtn}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            ← Previous
          </button>
          <span className={styles.pageInfo}>
            Page {page} of {pagination.pages}
          </span>
          <button
            className={styles.pageBtn}
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
