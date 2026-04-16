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

// Preset slot durations offered to the user
const SLOT_PRESETS = [
  { label: '30 Min', minutes: 30 },
  { label: '1 Hour', minutes: 60 },
  { label: '1.5 Hrs', minutes: 90 },
  { label: '2 Hours', minutes: 120 },
  { label: 'Custom', minutes: null },
];

function TurfDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { bookingData, setTurf, setDate, toggleSlot, clearBooking } = useBooking();
  const [turf, setTurfData] = useState(null);
  const [slots, setSlots] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState('');
  const [slotInterval, setSlotInterval] = useState(60);
  const [customMinutes, setCustomMinutes] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [slotsRefreshing, setSlotsRefreshing] = useState(false);

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
  }, [selectedDate, slotInterval]);

  // Auto-refresh slots every 30 seconds to pick up admin block/unblock changes
  useEffect(() => {
    if (!selectedDate || !id) return;
    const timer = setInterval(loadSlots, 30000);
    return () => clearInterval(timer);
  }, [selectedDate, slotInterval, id]);

  // Refresh when the browser tab becomes visible again
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && selectedDate) loadSlots();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [selectedDate, slotInterval]);

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

  const loadSlots = async (showSpinner = false) => {
    if (showSpinner) setSlotsRefreshing(true);
    try {
      const { data } = await getAvailableSlots(id, selectedDate, slotInterval);
      setSlots(data.slots || []);
    } catch (err) {
      console.error('Failed to load slots:', err);
    } finally {
      if (showSpinner) setSlotsRefreshing(false);
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
      loadTurf();
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

  const handleIntervalChange = (newInterval) => {
    if (newInterval === null) {
      // Custom preset selected
      setShowCustomInput(true);
      return;
    }
    setShowCustomInput(false);
    if (newInterval === slotInterval) return;
    setSlotInterval(newInterval);
    clearBooking();
    setDate(selectedDate);
    setTurf(turf);
  };

  const applyCustomDuration = () => {
    const mins = parseInt(customMinutes, 10);
    if (!mins || mins < 15 || mins > 480) {
      alert('Please enter a duration between 15 and 480 minutes.');
      return;
    }
    setShowCustomInput(false);
    setSlotInterval(mins);
    clearBooking();
    setDate(selectedDate);
    setTurf(turf);
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
  const slotPriceForDuration = (minutes, pricePerHour) => Math.round((minutes / 60) * pricePerHour);
  const activePreset = SLOT_PRESETS.find(p => p.minutes === slotInterval);

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
              <p className={styles.location}>{turf.address?.street}, {turf.address?.city}, {turf.address?.state} - {turf.address?.pincode}</p>
            </div>
            <div className={styles.ratingBox}>
              <span className={styles.ratingNum}>{turf.rating?.average?.toFixed(1)}</span>
              <span className={styles.ratingLabel}>{turf.rating?.count} reviews</span>
            </div>
          </div>

          <div className={styles.tags}>
            {turf.sportTypes?.map((s) => (
              <span key={s} className={styles.tag}>{s}</span>
            ))}
            <span className={styles.tag}>{turf.surfaceType?.replace(/-/g, ' ')}</span>
          </div>

          <p className={styles.description}>{turf.description}</p>

          {/* Pricing Info Grid */}
          <div className={styles.pricingSection}>
            <h3 className={styles.sectionTitle}>💰 Pricing</h3>
            <div className={styles.pricingGrid}>
              <div className={styles.pricingCard}>
                <span className={styles.pricingLabel}>Base Rate</span>
                <span className={styles.pricingValue}>{formatPrice(turf.pricePerHour)}<span className={styles.pricingUnit}>/hr</span></span>
              </div>
              <div className={styles.pricingCard}>
                <span className={styles.pricingLabel}>30 Min</span>
                <span className={styles.pricingValue}>{formatPrice(turf.pricePerHour / 2)}<span className={styles.pricingUnit}>/slot</span></span>
              </div>
              {turf.peakPricePerHour && (
                <>
                  <div className={`${styles.pricingCard} ${styles.peakCard}`}>
                    <span className={styles.pricingLabel}>🌙 Night Rate</span>
                    <span className={`${styles.pricingValue} ${styles.peakValue}`}>{formatPrice(turf.peakPricePerHour)}<span className={styles.pricingUnit}>/hr</span></span>
                    <span className={styles.peakHours}>{turf.peakHourStart} – {turf.peakHourEnd}</span>
                  </div>
                  <div className={`${styles.pricingCard} ${styles.peakCard}`}>
                    <span className={styles.pricingLabel}>🌙 Night 30 Min</span>
                    <span className={`${styles.pricingValue} ${styles.peakValue}`}>{formatPrice(turf.peakPricePerHour / 2)}<span className={styles.pricingUnit}>/slot</span></span>
                  </div>
                </>
              )}
            </div>
            {turf.peakPricePerHour && (
              <div className={styles.peakNotice}>
                👉 “Night charges include lighting cost 💡”<br/>
                Night pricing applies from <strong>{turf.peakHourStart}</strong> to <strong>{turf.peakHourEnd}</strong>.
              </div>
            )}
          </div>

          <div className={styles.infoGrid}>
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
                  <span key={a} className={styles.amenityItem}>{info.label}</span>
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

            {/* Dynamic price display */}
            <div className={styles.bookingPriceRow}>
              <div>
                <p className={styles.bookingPrice}>{formatPrice(turf.pricePerHour)} <span>/hour</span></p>
                {turf.peakPricePerHour && (
                  <p className={styles.bookingPeakBadge}>🌙 Night: {formatPrice(turf.peakPricePerHour)}/hr after {turf.peakHourStart}</p>
                )}
              </div>
            </div>

            <div className={styles.dateField}>
              <label>Select Date</label>
              <input type="date" value={selectedDate} onChange={handleDateChange} min={today} className={styles.dateInput} id="booking-date" />
            </div>

            {selectedDate && (
              <>
                {/* Slot Duration Picker */}
                <div className={styles.intervalSection}>
                  <label className={styles.intervalLabel}>Slot Duration</label>
                  <div className={styles.intervalGrid}>
                    {SLOT_PRESETS.map((preset) => {
                      const isActive = preset.minutes === null
                        ? showCustomInput || (!SLOT_PRESETS.find(p => p.minutes === slotInterval) && slotInterval > 0)
                        : preset.minutes === slotInterval && !showCustomInput;
                      const slotCost = preset.minutes
                        ? slotPriceForDuration(preset.minutes, turf.pricePerHour)
                        : null;
                      return (
                        <button
                          key={preset.label}
                          id={`interval-${preset.minutes || 'custom'}`}
                          className={`${styles.intervalBtn} ${isActive ? styles.intervalActive : ''}`}
                          onClick={() => handleIntervalChange(preset.minutes)}
                        >
                          <span>{preset.label}</span>
                          {slotCost !== null && (
                            <span className={styles.intervalPrice}>₹{slotCost}</span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {showCustomInput && (
                    <div className={styles.customDurationRow}>
                      <input
                        type="number"
                        min={15}
                        max={480}
                        step={15}
                        value={customMinutes}
                        onChange={e => setCustomMinutes(e.target.value)}
                        placeholder="Minutes (e.g. 45)"
                        className={styles.customInput}
                        id="custom-duration-input"
                      />
                      <button className={styles.applyBtn} onClick={applyCustomDuration}>Apply</button>
                    </div>
                  )}

                  {!showCustomInput && activePreset === undefined && slotInterval > 0 && (
                    <p className={styles.intervalNote}>
                      Custom: {slotInterval} min slots · ₹{slotPriceForDuration(slotInterval, turf.pricePerHour)} each
                    </p>
                  )}
                </div>

                <div className={styles.slotsSection}>
                  <div className={styles.slotsSectionHeader}>
                    <label>Select Time Slots</label>
                    <div className={styles.slotHeaderActions}>
                      <span className={styles.liveDot} title="Slots auto-refresh every 30s">
                        <span className={styles.livePulse} />
                        Live
                      </span>
                      <button
                        className={styles.refreshBtn}
                        onClick={() => loadSlots(true)}
                        disabled={slotsRefreshing}
                        title="Refresh slots"
                        id="refresh-slots-btn"
                      >
                        <span className={slotsRefreshing ? styles.spinning : ''}>↻</span>
                      </button>
                    </div>
                  </div>
                  <SlotPicker
                    slots={slots}
                    selectedSlots={bookingData.selectedSlots}
                    onToggle={toggleSlot}
                    pricePerHour={turf.pricePerHour}
                    peakPricePerHour={turf.peakPricePerHour}
                    peakHourStart={turf.peakHourStart}
                    peakHourEnd={turf.peakHourEnd}
                    slotDurationMinutes={slotInterval}
                  />
                </div>

                {bookingData.selectedSlots.length > 0 && (
                  <div className={styles.summary}>
                    <div className={styles.summaryRow}>
                      <span>Slots selected</span>
                      <span>{bookingData.selectedSlots.length}</span>
                    </div>
                    <div className={styles.summaryRow}>
                      <span>Total duration</span>
                      <span>
                        {bookingData.selectedSlots.reduce((s, sl) => s + (sl.durationMinutes || 60), 0)} min
                      </span>
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
