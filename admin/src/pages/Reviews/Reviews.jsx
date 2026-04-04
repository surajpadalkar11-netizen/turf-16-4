import { useState, useEffect } from 'react';
import * as reviewService from '../../services/reviewService';

const formatDate = (date) =>
  new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

function Reviews() {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [toast, setToast] = useState(null);

  useEffect(() => { loadReviews(); }, [page]);

  const loadReviews = async () => {
    setLoading(true);
    try {
      const { data } = await reviewService.getReviews({ page, limit: 20 });
      setReviews(data.reviews || []);
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

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this review? This will also update the turf rating.')) return;
    try {
      await reviewService.deleteReview(id);
      showToast('Review deleted');
      loadReviews();
    } catch (err) {
      showToast('Delete failed', 'error');
    }
  };

  const renderStars = (rating) => {
    return '★'.repeat(rating) + '☆'.repeat(5 - rating);
  };

  return (
    <div className="animate-fade">
      <div className="page-header">
        <h1>Review Management</h1>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[1, 2, 3, 4, 5].map((i) => <div key={i} className="skeleton" style={{ height: 80, borderRadius: 10 }} />)}
        </div>
      ) : reviews.length === 0 ? (
        <div className="empty-state card">
          <div className="icon">⭐</div>
          <h3>No Reviews Yet</h3>
          <p>Reviews will appear here when users leave them</p>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
            {reviews.map((r) => (
              <div key={r._id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--space-lg)' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', marginBottom: 8, flexWrap: 'wrap' }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: '50%', background: 'var(--color-surface)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 700, fontSize: 'var(--font-xs)', color: 'var(--color-text-secondary)', flexShrink: 0
                    }}>
                      {r.user?.name?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div>
                      <strong style={{ color: 'var(--color-text)', fontSize: 'var(--font-sm)' }}>{r.user?.name || 'Unknown'}</strong>
                      <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)' }}>{r.user?.email}</div>
                    </div>
                    <span style={{ color: 'var(--color-accent)', fontSize: 'var(--font-sm)', letterSpacing: 2 }}>{renderStars(r.rating)}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', marginBottom: 12 }}>
                    <img 
                      src={r.turf?.images?.[0] || 'https://images.unsplash.com/photo-1529900748604-07564a03e7a6?w=200'} 
                      alt="Turf" 
                      style={{ width: 48, height: 48, borderRadius: 'var(--radius-sm)', objectFit: 'cover', border: '1px solid var(--color-border)' }} 
                    />
                    <div>
                      <a 
                        href={`${import.meta.env.VITE_FRONTEND_URL || 'http://localhost:5173'}/turf/${r.turf?._id}`} 
                        target="_blank" 
                        rel="noreferrer"
                        style={{ fontSize: 'var(--font-sm)', color: 'var(--color-primary)', fontWeight: 600, display: 'block', marginBottom: 2, textDecoration: 'none' }}
                      >
                        🏟️ {r.turf?.name || 'Unknown Turf'}
                      </a>
                      <span style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)' }}>📍 {r.turf?.city || ''}</span>
                    </div>
                  </div>
                  <p style={{ fontSize: 'var(--font-sm)', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                    "{r.comment}"
                  </p>
                  <span style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)', marginTop: 8, display: 'block' }}>
                    {formatDate(r.createdAt)}
                  </span>
                </div>
                <button className="btn btn-danger btn-sm" onClick={() => handleDelete(r._id)} style={{ flexShrink: 0 }}>
                  🗑 Delete
                </button>
              </div>
            ))}
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

export default Reviews;
