import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getAllBookings } from '../../services/bookingService';
import { getTurfs, deleteTurf } from '../../services/turfService';
import { formatPrice, formatDate } from '../../utils/formatters';
import styles from './Dashboard.module.css';

function AdminDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [view, setView] = useState('bookings');
  const [bookings, setBookings] = useState([]);
  const [turfs, setTurfs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || user.role !== 'admin') { navigate('/'); return; }
    loadData();
  }, [user, view]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (view === 'bookings') {
        const { data } = await getAllBookings({ limit: 50 });
        setBookings(data.bookings || []);
      } else {
        const { data } = await getTurfs({ limit: 50 });
        setTurfs(data.turfs || []);
      }
    } catch (err) {
      console.error('Admin load error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTurf = async (id) => {
    if (!window.confirm('Are you sure you want to delete this turf?')) return;
    try {
      await deleteTurf(id);
      loadData();
    } catch (err) {
      alert('Delete failed');
    }
  };

  if (!user || user.role !== 'admin') return null;

  return (
    <div className={`container ${styles.page}`}>
      <h1>Admin Dashboard</h1>

      <div className={styles.filters} style={{ marginBottom: 24 }}>
        <button className={`${styles.filterBtn} ${view === 'bookings' ? styles.activeFilter : ''}`} onClick={() => setView('bookings')}>
          All Bookings
        </button>
        <button className={`${styles.filterBtn} ${view === 'turfs' ? styles.activeFilter : ''}`} onClick={() => setView('turfs')}>
          Manage Turfs
        </button>
      </div>

      {loading ? (
        <div className={styles.list}>
          {[1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: 80, borderRadius: 12 }} />)}
        </div>
      ) : view === 'bookings' ? (
        <div className={styles.list}>
          {bookings.length === 0 ? <p style={{ color: 'var(--color-text-muted)' }}>No bookings yet.</p> : null}
          {bookings.map((b) => (
            <div key={b._id} className={styles.bookingCard}>
              <div className={styles.bookingMain}>
                <div className={styles.bookingInfo}>
                  <h3>{b.turf?.name}</h3>
                  <p className={styles.bookingMeta}>
                    👤 {b.user?.name} · 📧 {b.user?.email} · 📅 {formatDate(b.date)}
                  </p>
                </div>
                <div className={styles.bookingRight}>
                  <span className={`${styles.status} ${styles[b.status]}`}>{b.status}</span>
                  <p className={styles.bookingAmount}>{formatPrice(b.totalAmount)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className={styles.list}>
          {turfs.map((t) => (
            <div key={t._id} className={styles.bookingCard}>
              <div className={styles.bookingMain}>
                <div className={styles.bookingInfo}>
                  <h3>{t.name}</h3>
                  <p className={styles.bookingMeta}>📍 {t.address?.city} · ⭐ {t.rating?.average?.toFixed(1)} · {formatPrice(t.pricePerHour)}/hr</p>
                </div>
                <div className={styles.bookingRight}>
                  <button className={styles.cancelBtn} onClick={() => handleDeleteTurf(t._id)}>Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default AdminDashboard;
