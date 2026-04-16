import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useBooking } from '../../context/BookingContext';
import { useAuth } from '../../context/AuthContext';
import { createBooking } from '../../services/bookingService';
import { createPaymentOrder, verifyPayment } from '../../services/paymentService';
import { formatPrice, formatDate, formatTime } from '../../utils/formatters';
import styles from './Booking.module.css';

// Percentage-based advance options
const ADVANCE_OPTIONS = [
  { label: '25% Advance', percent: 25, description: 'Pay a quarter upfront' },
  { label: '50% Advance', percent: 50, description: 'Pay half upfront' },
  { label: 'Full Payment',  percent: 100, description: 'Pay complete amount' },
];

function Booking() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { bookingData, clearBooking, setPlayerCount } = useBooking();
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(null);
  const [selectedPercent, setSelectedPercent] = useState(100); // default full pay

  if (!user) {
    navigate('/login');
    return null;
  }

  // ── Success Screen ──────────────────────────────────────────────
  if (success) {
    const isPartial = success.paymentStatus === 'partially_paid';
    return (
      <div className="container" style={{ padding: '60px 0', textAlign: 'center' }}>
        <div style={{ maxWidth: 500, margin: '0 auto', background: '#ffffff', borderRadius: 20, padding: '48px 36px', boxShadow: '0 8px 40px rgba(0,0,0,0.10)', border: '1px solid #e2e8f0' }}>
          <h2 style={{ color: isPartial ? '#f59e0b' : '#059669', marginBottom: 8 }}>
            {isPartial ? 'Advance Paid Successfully' : 'Booking Confirmed!'}
          </h2>
          <p style={{ color: '#475569', marginBottom: 24 }}>
            {isPartial
              ? `Please pay ₹${success.remainingAmount} remaining at the venue.`
              : `A confirmation email has been sent to ${user.email}`}
          </p>

          {/* Payment Breakdown */}
          <div style={{ background: '#f8fafc', borderRadius: 12, padding: '16px 20px', marginBottom: 20, border: '1px solid #e2e8f0', textAlign: 'left' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ color: '#64748b', fontSize: 14 }}>Total Amount</span>
              <span style={{ fontWeight: 700 }}>₹{success.totalAmount}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ color: '#10b981', fontSize: 14 }}>Paid Now</span>
              <span style={{ fontWeight: 700, color: '#10b981' }}>₹{success.amountPaid}</span>
            </div>
            {isPartial && (
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #e2e8f0', paddingTop: 8 }}>
                <span style={{ color: '#f59e0b', fontSize: 14 }}>Due at Venue</span>
                <span style={{ fontWeight: 700, color: '#f59e0b' }}>₹{success.remainingAmount}</span>
              </div>
            )}
          </div>

          <div style={{ background: '#f0fdf9', borderRadius: 12, padding: '20px 24px', marginBottom: 20, border: '1.5px solid #00d4aa' }}>
            <p style={{ fontSize: 13, color: '#64748b', marginBottom: 6 }}>Your Booking Code</p>
            <p style={{ fontSize: 28, fontWeight: 800, letterSpacing: 4, color: '#00a884', fontFamily: 'monospace', margin: 0 }}>{success.bookingCode}</p>
            <p style={{ fontSize: 12, color: '#64748b', marginTop: 6 }}>{isPartial ? 'Show this + pay remaining at entrance' : 'Show this code at the entrance'}</p>
          </div>
          <button className={styles.payBtn} onClick={() => navigate('/dashboard')}>
            Go to My Bookings
          </button>
        </div>
      </div>
    );
  }

  if (!bookingData.turf || bookingData.selectedSlots.length === 0) {
    return (
      <div className="container" style={{ padding: '80px 0', textAlign: 'center' }}>
        <h2>No booking data</h2>
        <p style={{ color: 'var(--color-text-secondary)', marginTop: 8 }}>Please select a turf and time slots first.</p>
        <button onClick={() => navigate('/search')} className={styles.backBtn} style={{ marginTop: 24 }}>Browse Turfs</button>
      </div>
    );
  }

  const totalAmount = bookingData.totalAmount;
  const isFullPay = selectedPercent === 100;
  const payNow = isFullPay ? totalAmount : Math.round((selectedPercent / 100) * totalAmount);
  const remaining = totalAmount - payNow;

  // Total duration in minutes and hours
  const totalDurationMin = bookingData.selectedSlots.reduce((s, sl) => s + (sl.durationMinutes || 60), 0);
  const totalHours = (totalDurationMin / 60).toFixed(1).replace('.0', '');

  // ── Payment Handler ─────────────────────────────────────────────
  const handlePayment = async () => {
    setLoading(true);
    setError('');

    try {
      // Step 1: Create booking in DB
      const { data: bookingRes } = await createBooking({
        turfId: id,
        date: bookingData.date,
        timeSlots: bookingData.selectedSlots,
        playerCount: bookingData.playerCount,
        notes,
        advanceAmount: payNow,
      });

      // Step 2: Create Razorpay order via backend
      const { data: orderRes } = await createPaymentOrder(bookingRes.booking._id, payNow);

      if (!window.Razorpay) {
        setError('Payment gateway failed to load. Please refresh the page and try again.');
        setLoading(false);
        return;
      }

      const payLabel = isFullPay ? 'Full payment' : `${selectedPercent}% advance`;

      // Step 3: Open Razorpay checkout modal
      const options = {
        key: orderRes.key,
        amount: orderRes.order.amount,
        currency: orderRes.order.currency,
        name: 'turf11',
        description: `${payLabel} for ${bookingData.turf.name}`,
        order_id: orderRes.order.id,
        handler: async (response) => {
          try {
            const verifyRes = await verifyPayment({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });

            clearBooking();

            const bookingCode = `TRF-${bookingRes.booking._id.substring(0, 5).toUpperCase()}`;
            setSuccess({
              bookingCode,
              totalAmount,
              amountPaid: verifyRes.data?.amountPaid || payNow,
              remainingAmount: verifyRes.data?.remainingAmount || remaining,
              paymentStatus: verifyRes.data?.paymentStatus || (isFullPay ? 'paid' : 'partially_paid'),
              turfName: bookingData.turf.name,
            });
          } catch {
            setError('Payment verification failed. Please contact support with your payment ID: ' + response.razorpay_payment_id);
          }
        },
        modal: {
          ondismiss: () => {
            setLoading(false);
            setError('Payment was cancelled. You can try again.');
          },
        },
        prefill: { name: user.name, email: user.email, contact: user.phone || '' },
        theme: { color: '#00d4aa' },
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', (response) => {
        setError(`Payment failed: ${response.error.description}`);
        setLoading(false);
      });
      rzp.open();
    } catch (err) {
      setError(err.response?.data?.message || 'Booking failed. Please try again.');
      setLoading(false);
    }
  };

  // ── UI ──────────────────────────────────────────────────────────
  return (
    <div className={`container ${styles.page}`}>
      <h1 className={styles.title}>Confirm Your Booking</h1>

      <div className={styles.layout}>
        <div className={styles.details}>
          <div className={styles.card}>
            <h3>Turf Details</h3>
            <p className={styles.turfName}>{bookingData.turf.name}</p>
            <p className={styles.turfAddr}>{bookingData.turf.address?.city}, {bookingData.turf.address?.state}</p>
          </div>

          <div className={styles.card}>
            <h3>Booking Details</h3>
            <div className={styles.row}>
              <span>Date</span>
              <span>{formatDate(bookingData.date)}</span>
            </div>
            <div className={styles.row}>
              <span>Time Slots</span>
              <div className={styles.slotList}>
                {bookingData.selectedSlots.map((s) => {
                  const isPeak = s.priceUsed && bookingData.turf.peakPricePerHour && s.priceUsed === bookingData.turf.peakPricePerHour;
                  const dur = s.durationMinutes || 60;
                  return (
                    <span key={s.start} className={`${styles.slotChip} ${isPeak ? styles.peakSlot : ''}`}>
                      {formatTime(s.start)} – {formatTime(s.end)}
                      {dur !== 60 && <span className={styles.halfBadge}>{dur}m</span>}
                      {isPeak && <span className={styles.peakBadge}>🌙</span>}
                    </span>
                  );
                })}
              </div>
            </div>
            <div className={styles.row}>
              <span>Total Duration</span>
              <span><strong>{totalDurationMin} min</strong> ({totalHours} hr{totalHours !== '1' ? 's' : ''})</span>
            </div>
          </div>

          <div className={styles.card}>
            <h3>Player Details</h3>
            <div className={styles.playerRow}>
              <label>Number of Players</label>
              <input
                type="number"
                min="1"
                max="30"
                value={bookingData.playerCount}
                onChange={(e) => setPlayerCount(Number(e.target.value))}
                className={styles.playerInput}
              />
            </div>
            <div className={styles.noteField}>
              <label>Special Requests (Optional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any special requirements..."
                className={styles.textarea}
                rows={3}
              />
            </div>
          </div>

          {/* ── Payment Options Section ── */}
          <div className={styles.card}>
            <h3>Payment Options</h3>
            <p className={styles.paymentHint}>Choose how much you'd like to pay now:</p>
            <div className={styles.paymentOptionsGrid}>
              {ADVANCE_OPTIONS.map((opt) => {
                const amt = opt.percent === 100 ? totalAmount : Math.round((opt.percent / 100) * totalAmount);
                const isActive = selectedPercent === opt.percent;
                return (
                  <button
                    key={opt.percent}
                    className={`${styles.payOptionCard} ${isActive ? styles.payOptionActive : ''}`}
                    onClick={() => setSelectedPercent(opt.percent)}
                    id={`pay-option-${opt.percent}`}
                  >
                    <span className={styles.payOptionLabel}>{opt.label}</span>
                    <span className={styles.payOptionAmount}>{formatPrice(amt)}</span>
                    <span className={styles.payOptionDesc}>{opt.description}</span>
                    {isActive && <span className={styles.payOptionCheck}>✓</span>}
                  </button>
                );
              })}
            </div>

            {selectedPercent < 100 && (
              <div className={styles.remainderNote}>
                <span>
                  Remaining <strong>{formatPrice(remaining)}</strong> ({100 - selectedPercent}%) to be paid at the venue before playing.
                </span>
              </div>
            )}
          </div>
        </div>

        <div className={styles.summaryCard}>
          <h3>Payment Summary</h3>
          <div className={styles.row}>
            <span>Price per hour</span>
            <span>{formatPrice(bookingData.turf.pricePerHour)}</span>
          </div>
          <div className={styles.row}>
            <span>Duration</span>
            <span>{totalDurationMin} min</span>
          </div>
          <div className={`${styles.row} ${styles.totalRow}`}>
            <strong>Total Amount</strong>
            <strong className={styles.totalAmount}>{formatPrice(totalAmount)}</strong>
          </div>

          {selectedPercent < 100 && (
            <>
              <div style={{ borderTop: '1px dashed #e2e8f0', margin: '12px 0' }} />
              <div className={styles.row}>
                <span style={{ color: '#10b981', fontWeight: 600 }}>Pay Now ({selectedPercent}%)</span>
                <span style={{ color: '#10b981', fontWeight: 700 }}>{formatPrice(payNow)}</span>
              </div>
              <div className={styles.row}>
                <span style={{ color: '#f59e0b', fontWeight: 600 }}>Due at Venue</span>
                <span style={{ color: '#f59e0b', fontWeight: 700 }}>{formatPrice(remaining)}</span>
              </div>
            </>
          )}

          {error && <p className={styles.error}>{error}</p>}

          <button className={styles.payBtn} onClick={handlePayment} disabled={loading} id="pay-btn">
            {loading
              ? 'Processing...'
              : selectedPercent === 100
              ? `Pay Full ${formatPrice(totalAmount)}`
              : `Pay ${selectedPercent}% – ${formatPrice(payNow)}`}
          </button>
          <p className={styles.secure}>Secured by Razorpay</p>

          {/* Payment breakdown visual */}
          {selectedPercent < 100 && (
            <div className={styles.progressBar}>
              <div
                className={styles.progressFill}
                style={{ width: `${selectedPercent}%` }}
              />
              <div className={styles.progressLabels}>
                <span style={{ color: '#10b981', fontSize: 11, fontWeight: 700 }}>
                  {selectedPercent}% now
                </span>
                <span style={{ color: '#f59e0b', fontSize: 11, fontWeight: 700 }}>
                  {100 - selectedPercent}% at venue
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Booking;
