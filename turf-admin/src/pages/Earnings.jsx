import { useState, useEffect } from 'react';
import api from '../services/api';
import styles from './Earnings.module.css';

export default function Earnings() {
  const [loading, setLoading] = useState(true);
  const [earnings, setEarnings] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });

  useEffect(() => {
    fetchData();
  }, [filter, page]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [earningsRes, transactionsRes] = await Promise.all([
        api.get('/turf-owner/earnings/summary'),
        api.get(`/turf-owner/earnings/transactions?status=${filter}&page=${page}&limit=20`),
      ]);

      setEarnings(earningsRes.data.earnings);
      setTransactions(transactionsRes.data.transactions || []);
      setPagination(transactionsRes.data.pagination);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading && !earnings) {
    return (
      <div className={styles.page}>
        <div className={styles.loading}>Loading earnings...</div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>My Earnings</h1>
        <p className={styles.subtitle}>Track your payments and pending payouts</p>
      </div>

      {earnings && (
        <>
          <div className={styles.statsGrid}>
            <div className={styles.statCard}>
              <div className={styles.statIcon}>💰</div>
              <div className={styles.statContent}>
                <p className={styles.statLabel}>Total Wallet Bookings</p>
                <h2 className={styles.statValue}>₹{earnings.totalEarnings.toLocaleString('en-IN')}</h2>
                <p className={styles.statSubtext}>{earnings.totalCount} bookings via wallet</p>
              </div>
            </div>

            <div className={`${styles.statCard} ${styles.pendingCard}`}>
              <div className={styles.statIcon}>⏳</div>
              <div className={styles.statContent}>
                <p className={styles.statLabel}>Pending from Admin</p>
                <h2 className={`${styles.statValue} ${styles.pending}`}>
                  ₹{earnings.pendingAmount.toLocaleString('en-IN')}
                </h2>
                <p className={styles.statSubtext}>{earnings.pendingCount} payments awaiting transfer</p>
              </div>
            </div>

            <div className={`${styles.statCard} ${styles.completedCard}`}>
              <div className={styles.statIcon}>✅</div>
              <div className={styles.statContent}>
                <p className={styles.statLabel}>Received in Bank</p>
                <h2 className={`${styles.statValue} ${styles.completed}`}>
                  ₹{earnings.completedAmount.toLocaleString('en-IN')}
                </h2>
                <p className={styles.statSubtext}>{earnings.completedCount} payments transferred</p>
              </div>
            </div>

            <div className={styles.statCard}>
              <div className={styles.statIcon}>📊</div>
              <div className={styles.statContent}>
                <p className={styles.statLabel}>This Month</p>
                <h2 className={styles.statValue}>₹{earnings.thisMonth.toLocaleString('en-IN')}</h2>
                <p className={styles.statSubtext}>{earnings.thisMonthCount} wallet bookings</p>
              </div>
            </div>
          </div>

          {/* Progress bar showing payout completion */}
          <div className={styles.progressCard}>
            <div className={styles.progressHeader}>
              <div>
                <h3 className={styles.progressTitle}>Payout Status</h3>
                <p className={styles.progressSubtitle}>
                  {earnings.completedCount} of {earnings.totalCount} payments received
                </p>
              </div>
              <div className={styles.progressPercentage}>
                {earnings.totalCount > 0
                  ? Math.round((earnings.completedCount / earnings.totalCount) * 100)
                  : 0}%
              </div>
            </div>
            <div className={styles.progressBar}>
              <div
                className={styles.progressFill}
                style={{
                  width: earnings.totalCount > 0
                    ? `${(earnings.completedCount / earnings.totalCount) * 100}%`
                    : '0%'
                }}
              />
            </div>
            <div className={styles.progressLegend}>
              <div className={styles.legendItem}>
                <div className={`${styles.legendDot} ${styles.legendCompleted}`} />
                <span>Received: ₹{earnings.completedAmount.toLocaleString('en-IN')}</span>
              </div>
              <div className={styles.legendItem}>
                <div className={`${styles.legendDot} ${styles.legendPending}`} />
                <span>Pending: ₹{earnings.pendingAmount.toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>
        </>
      )}

      <div className={styles.filters}>
        <span className={styles.filterLabel}>Filter:</span>
        <select value={filter} onChange={(e) => { setFilter(e.target.value); setPage(1); }} className={styles.filterSelect}>
          <option value="all">All Transactions</option>
          <option value="pending">Pending Payouts</option>
          <option value="completed">Received Payouts</option>
        </select>
      </div>

      <div className={styles.tableCard}>
        <div className={styles.tableHeader}>
          <div>Booking ID</div>
          <div>Customer</div>
          <div>Amount</div>
          <div>Date</div>
          <div>Status</div>
          <div>Payout Date</div>
        </div>

        <div className={styles.tableBody}>
          {loading ? (
            <div className={styles.empty}>
              <div className={styles.emptyIcon}>⏳</div>
              <p className={styles.emptyText}>Loading...</p>
            </div>
          ) : transactions.length === 0 ? (
            <div className={styles.empty}>
              <div className={styles.emptyIcon}>📋</div>
              <p className={styles.emptyText}>No transactions found</p>
              <p className={styles.emptySubtext}>
                {filter === 'pending' ? 'All payouts are completed' : 'No wallet-paid bookings yet'}
              </p>
            </div>
          ) : (
            transactions.map((txn) => (
              <div key={txn.id} className={styles.tableRow}>
                <div className={styles.bookingId}>#{txn.id.substring(0, 8).toUpperCase()}</div>
                <div className={styles.customerInfo}>
                  <p className={styles.customerName}>{txn.user?.name || 'N/A'}</p>
                  <p className={styles.customerEmail}>{txn.user?.email || 'No email'}</p>
                </div>
                <div className={styles.amount}>₹{Number(txn.wallet_amount_used).toLocaleString('en-IN')}</div>
                <div className={styles.date}>
                  {new Date(txn.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </div>
                <div>
                  <span className={`${styles.badge} ${txn.payout_status === 'completed' ? styles.badgeCompleted : styles.badgePending}`}>
                    {txn.payout_status === 'completed' ? '✓ Received' : '⏳ Pending'}
                  </span>
                </div>
                <div className={styles.payoutDate}>
                  {txn.payout_date ? (
                    new Date(txn.payout_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                  ) : (
                    <span className={styles.notYet}>Not yet</span>
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
