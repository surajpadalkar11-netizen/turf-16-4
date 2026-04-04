import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getMyBookings, cancelBooking } from '../../services/bookingService';
import { getMyReviews } from '../../services/reviewService';
import { formatPrice, formatDate, formatTime } from '../../utils/formatters';
import styles from './Dashboard.module.css';

function UserDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('bookings');
  const [bookings, setBookings] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    if (activeTab === 'bookings') {
      loadBookings();
    } else {
      loadReviews();
    }
  }, [user, filter, activeTab]);

  const loadBookings = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filter) params.status = filter;
      const { data } = await getMyBookings(params);
      setBookings(data.bookings || []);
    } catch (err) {
      console.error('Failed to load bookings:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadReviews = async () => {
    setLoading(true);
    try {
      const { data } = await getMyReviews();
      setReviews(data.reviews || []);
    } catch (err) {
      console.error('Failed to load reviews:', err);
    } finally {
      setLoading(false);
    }
  };

  const getRefundPercent = (booking) => {
    const firstSlot = booking.timeSlots?.[0]?.start;
    if (!firstSlot || !booking.date) return null;
    const bookingDateTime = new Date(`${booking.date}T${firstSlot}:00`);
    const hoursLeft = (bookingDateTime - new Date()) / (1000 * 60 * 60);
    if (hoursLeft > 48) return { percent: 100, label: 'Full refund (100%)', color: '#059669' };
    if (hoursLeft >= 24) return { percent: 50, label: '50% refund', color: '#d97706' };
    return { percent: 0, label: 'No refund (< 24h)', color: '#ef4444' };
  };

  const handleCancel = async (id) => {
    const booking = bookings.find((b) => b._id === id);
    const refund = booking ? getRefundPercent(booking) : null;
    const refundMsg = refund
      ? `\n\n💰 Refund Policy: ${refund.label}\nAmount: ₹${refund.percent > 0 ? Math.round((booking.totalAmount * refund.percent) / 100) : 0}`
      : '';
    if (!window.confirm(`Are you sure you want to cancel this booking?${refundMsg}\n\nThe turf owner will be notified by email.`)) return;
    try {
      await cancelBooking(id);
      loadBookings();
    } catch (err) {
      alert(err.response?.data?.message || 'Cancel failed');
    }
  };

  const getStatusClass = (status) => {
    const map = { confirmed: styles.confirmed, pending: styles.pending, cancelled: styles.cancelled, completed: styles.completed, playing: styles.playing };
    return map[status] || '';
  };

  const renderStars = (rating) => {
    return '★'.repeat(rating) + '☆'.repeat(5 - rating);
  };

  if (!user) return null;

  return (
    <div className={`container ${styles.page}`}>
      <div className={styles.header}>
        <h1>{activeTab === 'bookings' ? 'My Bookings' : 'My Reviews'}</h1>
        <Link to="/search" className={styles.newBooking}>+ Book a Turf</Link>
      </div>

      {/* Tab switcher */}
      <div className={styles.tabBar}>
        <button
          className={`${styles.tabBtn} ${activeTab === 'bookings' ? styles.activeTab : ''}`}
          onClick={() => { setActiveTab('bookings'); setFilter(''); }}
        >
          📅 Bookings
        </button>
        <button
          className={`${styles.tabBtn} ${activeTab === 'reviews' ? styles.activeTab : ''}`}
          onClick={() => { setActiveTab('reviews'); setFilter(''); }}
        >
          ⭐ My Reviews
        </button>
      </div>

      {/* Bookings Tab */}
      {activeTab === 'bookings' && (
        <>
          <div className={styles.filters}>
            {['', 'confirmed', 'pending', 'playing', 'cancelled', 'completed'].map((s) => (
              <button
                key={s}
                className={`${styles.filterBtn} ${filter === s ? styles.activeFilter : ''}`}
                onClick={() => setFilter(s)}
              >
                {s || 'All'}
              </button>
            ))}
          </div>

          {loading ? (
            <div className={styles.list}>
              {[1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: 120, borderRadius: 12 }} />)}
            </div>
          ) : bookings.length === 0 ? (
            <div className={styles.empty}>
              <p>📅</p>
              <h3>No bookings found</h3>
              <p>Find and book your favorite turf now!</p>
              <Link to="/search" className={styles.newBooking} style={{ marginTop: 16 }}>Explore Turfs</Link>
            </div>
          ) : (
            <div className={styles.list}>
              {bookings.map((b) => (
                <div key={b._id} className={styles.bookingCard}>
                  <div className={styles.bookingMain}>
                    <div className={styles.bookingInfo}>
                      <h3>{b.turf?.name || 'Unknown Turf'}</h3>
                      <p className={styles.bookingMeta}>📍 {b.turf?.address?.city} · 📅 {formatDate(b.date)}</p>
                      <div className={styles.slotChips}>
                        {b.timeSlots?.map((s, i) => (
                          <span key={i} className={styles.slotChip}>{formatTime(s.start)} – {formatTime(s.end)}</span>
                        ))}
                      </div>
                    </div>
                    <div className={styles.bookingRight}>
                      {b.notes === 'REFUND_PROCESSED' ? (
                        <span className={`${styles.status}`} style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--color-success)', border: '1px solid rgba(16, 185, 129, 0.4)' }}>💵 Refunded</span>
                      ) : (
                        <span className={`${styles.status} ${getStatusClass(b.status)}`}>{b.status === 'playing' ? '🏃 Playing' : b.status}</span>
                      )}
                      <p className={styles.bookingAmount}>{formatPrice(b.totalAmount)}</p>
                      {(b.status === 'pending' || b.status === 'confirmed') && (
                        <button className={styles.cancelBtn} onClick={() => handleCancel(b._id)}>Cancel</button>
                      )}
                      {b.status === 'playing' && (
                        <span style={{ fontSize: '0.75rem', color: '#3b82f6', fontWeight: 500 }}>⏱ In progress...</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Reviews Tab */}
      {activeTab === 'reviews' && (
        <>
          {loading ? (
            <div className={styles.list}>
              {[1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: 100, borderRadius: 12 }} />)}
            </div>
          ) : reviews.length === 0 ? (
            <div className={styles.empty}>
              <p>⭐</p>
              <h3>No reviews yet</h3>
              <p>Your reviews will appear here after you rate a turf</p>
            </div>
          ) : (
            <div className={styles.list}>
              {reviews.map((r) => (
                <div key={r._id} className={styles.reviewCard}>
                  <div className={styles.reviewCardHeader}>
                    <div className={styles.reviewTurfInfo}>
                      <img 
                        src={r.turf?.images?.[0] || 'https://images.unsplash.com/photo-1529900748604-07564a03e7a6?w=200'} 
                        alt="Turf" 
                        className={styles.reviewTurfImage} 
                      />
                      <div>
                        <Link to={`/turf/${r.turf?._id}`} className={styles.reviewTurfLink}>
                          <h3>{r.turf?.name || 'Unknown Turf'}</h3>
                        </Link>
                        <p className={styles.reviewTurfLocation}>📍 {r.turf?.city || ''}</p>
                      </div>
                    </div>
                    <div className={styles.reviewRatingBadge}>
                      <span className={styles.reviewStars}>{renderStars(r.rating)}</span>
                      <span className={styles.reviewRatingNum}>{r.rating}/5</span>
                    </div>
                  </div>
                  <p className={styles.reviewComment}>"{r.comment}"</p>
                  <p className={styles.reviewDate}>{formatDate(r.createdAt)}</p>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default UserDashboard;
