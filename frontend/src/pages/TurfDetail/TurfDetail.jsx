import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useBooking } from '../../context/BookingContext';
import SlotPicker from '../../components/SlotPicker/SlotPicker';
import ReviewCard from '../../components/ReviewCard/ReviewCard';
import { getTurf, getAvailableSlots } from '../../services/turfService';
import { getTurfReviews, createReview } from '../../services/reviewService';
import { formatPrice, getSportIcon } from '../../utils/formatters';
import { AMENITIES } from '../../utils/constants';
import styles from './TurfDetail.module.css';

function TurfDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { bookingData, setTurf, setDate, toggleSlot } = useBooking();
  const [turf, setTurfData] = useState(null);
  const [slots, setSlots] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState('');
  
  // Review form state
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewError, setReviewError] = useState('');

  useEffect(() => {
    loadTurf();
  }, [id]);

  useEffect(() => {
    if (selectedDate && id) loadSlots();
  }, [selectedDate]);

  const loadTurf = async () => {
    try {
      const [turfRes, reviewRes] = await Promise.all([getTurf(id), getTurfReviews(id)]);
      setTurfData(turfRes.data.turf);
      setTurf(turfRes.data.turf);
      setReviews(reviewRes.data.reviews || []);
    } catch (err) {
      console.error('Failed to load turf:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadSlots = async () => {
    try {
      const { data } = await getAvailableSlots(id, selectedDate);
      setSlots(data.slots || []);
    } catch (err) {
      console.error('Failed to load slots:', err);
    }
  };

  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    if (!user) {
      navigate('/login', { state: { from: `/turf/${id}` } });
      return;
    }
    setSubmittingReview(true);
    setReviewError('');
    try {
      if (!rating) { setReviewError('Please select a star rating'); return; }
      await createReview({ turfId: id, rating, comment });
      setComment('');
      setRating(0);
      loadTurf(); // Reload turf to get new reviews and updated rating
    } catch (err) {
      setReviewError(err.response?.data?.message || 'Failed to submit review. Have you booked this turf?');
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleDateChange = (e) => {
    const date = e.target.value;
    setSelectedDate(date);
    setDate(date);
  };

  const handleProceedToBook = () => {
    if (bookingData.selectedSlots.length === 0) {
      alert('Please select at least one time slot');
      return;
    }
    if (!user) {
      navigate('/login', { state: { from: `/booking/${id}` } });
      return;
    }
    navigate(`/booking/${id}`);
  };

  // Star rating labels
  const starLabels = ['Terrible', 'Poor', 'Average', 'Good', 'Excellent'];

  if (loading) {
    return (
      <div className="container" style={{ paddingTop: 40 }}>
        <div className="skeleton" style={{ height: 350, borderRadius: 16, marginBottom: 24 }} />
        <div className="skeleton" style={{ height: 24, width: '60%', marginBottom: 12 }} />
        <div className="skeleton" style={{ height: 16, width: '40%' }} />
      </div>
    );
  }

  if (!turf) {
    return <div className="container" style={{ padding: '60px 0', textAlign: 'center' }}><h2>Turf not found</h2></div>;
  }

  const getAmenityLabel = (val) => AMENITIES.find((a) => a.value === val) || { icon: '✓', label: val };
  const today = new Date().toISOString().split('T')[0];

  return (
    <div className={`container ${styles.page}`}>
      {/* Hero Image */}
      <div className={styles.imageSection}>
        <img
          src={turf.images?.[0] || 'https://images.unsplash.com/photo-1529900748604-07564a03e7a6?w=1200'}
          alt={turf.name}
          className={styles.heroImage}
        />
      </div>

      <div className={styles.content}>
        {/* Info */}
        <div className={styles.mainInfo}>
          <div className={styles.header}>
            <div>
              <h1 className={styles.title}>{turf.name}</h1>
              <p className={styles.location}>📍 {turf.address?.street}, {turf.address?.city}, {turf.address?.state} - {turf.address?.pincode}</p>
            </div>
            <div className={styles.ratingBox}>
              <span className={styles.ratingNum}>{turf.rating?.average?.toFixed(1)}</span>
              <span className={styles.ratingLabel}>{turf.rating?.count} reviews</span>
            </div>
          </div>

          <div className={styles.tags}>
            {turf.sportTypes?.map((s) => (
              <span key={s} className={styles.tag}>{getSportIcon(s)} {s}</span>
            ))}
            <span className={styles.tag}>🌿 {turf.surfaceType?.replace(/-/g, ' ')}</span>
          </div>

          <p className={styles.description}>{turf.description}</p>

          <div className={styles.infoGrid}>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Price</span>
              <span className={styles.infoValue}>{formatPrice(turf.pricePerHour)}/hr</span>
            </div>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Hours</span>
              <span className={styles.infoValue}>{turf.operatingHours?.open} – {turf.operatingHours?.close}</span>
            </div>
            {turf.dimensions?.length && (
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Size</span>
                <span className={styles.infoValue}>{turf.dimensions.length}m × {turf.dimensions.width}m</span>
              </div>
            )}
          </div>

          {/* Amenities */}
          <div className={styles.amenities}>
            <h3>Amenities</h3>
            <div className={styles.amenityGrid}>
              {turf.amenities?.map((a) => {
                const info = getAmenityLabel(a);
                return (
                  <span key={a} className={styles.amenityItem}>{info.icon} {info.label}</span>
                );
              })}
            </div>
          </div>

          {/* Reviews */}
          <div className={styles.reviewSection}>
            <h3>Reviews ({reviews.length})</h3>

            {user && (
              <div className={styles.reviewForm}>
                <h4 className={styles.reviewFormTitle}>Write a Review</h4>
                {reviewError && <p className={styles.reviewError}>{reviewError}</p>}
                
                <form onSubmit={handleReviewSubmit}>
                  <div className={styles.starLabel}>
                    {rating > 0 || hoverRating > 0
                      ? starLabels[(hoverRating || rating) - 1]
                      : 'Select a rating'}
                  </div>
                  <div className={styles.starRating}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        className={`${styles.starBtn} ${star <= (hoverRating || rating) ? styles.starActive : styles.starInactive}`}
                        onClick={() => setRating(star)}
                        onMouseEnter={() => setHoverRating(star)}
                        onMouseLeave={() => setHoverRating(0)}
                        aria-label={`Rate ${star} star${star > 1 ? 's' : ''}`}
                      >
                        ★
                      </button>
                    ))}
                  </div>

                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Share your experience at this turf... (optional)"
                    rows={3}
                    className={styles.reviewTextarea}
                  />

                  <button
                    type="submit"
                    disabled={submittingReview || !rating}
                    className={styles.reviewSubmitBtn}
                  >
                    {submittingReview ? 'Submitting...' : 'Submit Review'}
                  </button>
                </form>
              </div>
            )}

            {reviews.length > 0 ? (
              <div className={styles.reviewList}>
                {reviews.map((r) => <ReviewCard key={r._id} review={r} />)}
              </div>
            ) : (
              <p className={styles.noReviews}>No reviews yet. Book and play to be the first!</p>
            )}
          </div>
        </div>

        {/* Booking Sidebar */}
        <aside className={styles.bookingSidebar}>
          <div className={styles.bookingCard}>
            <h3 className={styles.bookingTitle}>Book This Turf</h3>
            <p className={styles.bookingPrice}>{formatPrice(turf.pricePerHour)} <span>/hour</span></p>

            <div className={styles.dateField}>
              <label>Select Date</label>
              <input type="date" value={selectedDate} onChange={handleDateChange} min={today} className={styles.dateInput} id="booking-date" />
            </div>

            {selectedDate && (
              <>
                <div className={styles.slotsSection}>
                  <label>Select Time Slots</label>
                  <SlotPicker
                    slots={slots}
                    selectedSlots={bookingData.selectedSlots}
                    onToggle={toggleSlot}
                    pricePerHour={turf.pricePerHour}
                  />
                </div>

                {bookingData.selectedSlots.length > 0 && (
                  <div className={styles.summary}>
                    <div className={styles.summaryRow}>
                      <span>Slots selected</span>
                      <span>{bookingData.selectedSlots.length}</span>
                    </div>
                    <div className={styles.summaryRow}>
                      <span>Total</span>
                      <strong>{formatPrice(bookingData.totalAmount)}</strong>
                    </div>
                  </div>
                )}
              </>
            )}

            <button
              className={styles.bookBtn}
              onClick={handleProceedToBook}
              disabled={!selectedDate || bookingData.selectedSlots.length === 0}
              id="proceed-booking-btn"
            >
              {!user ? 'Sign In to Book' : 'Proceed to Book'}
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default TurfDetail;
