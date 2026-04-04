import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useBooking } from '../../context/BookingContext';
import { useAuth } from '../../context/AuthContext';
import { createBooking } from '../../services/bookingService';
import { createPaymentOrder, verifyPayment } from '../../services/paymentService';
import { formatPrice, formatDate, formatTime } from '../../utils/formatters';
import styles from './Booking.module.css';

const ADVANCE_OPTIONS = (total) => [
  { label: '₹100 Advance', value: 100 },
  { label: '₹200 Advance', value: 200 },
  { label: '₹500 Advance', value: 500 },
  { label: 'Pay Full', value: total },
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
  const [payMode, setPayMode] = useState('full'); // 'full' | 'partial'
  const [advanceAmt, setAdvanceAmt] = useState(100);
  const [customAmt, setCustomAmt] = useState('');
  const [useCustom, setUseCustom] = useState(false);

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
          <div style={{ fontSize: 64, marginBottom: 16 }}>{isPartial ? '⚠️' : '🎉'}</div>
          <h2 style={{ color: isPartial ? '#f59e0b' : '#059669', marginBottom: 8 }}>
            {isPartial ? 'Advance Paid!' : 'Booking Confirmed!'}
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
              <span style={{ color: '#10b981', fontSize: 14 }}>✅ Paid Now</span>
              <span style={{ fontWeight: 700, color: '#10b981' }}>₹{success.amountPaid}</span>
            </div>
            {isPartial && (
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #e2e8f0', paddingTop: 8 }}>
                <span style={{ color: '#f59e0b', fontSize: 14 }}>⚠️ Due at Venue</span>
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
  const selectedAdvance = useCustom
    ? Math.min(Math.max(Number(customAmt) || 0, 1), totalAmount)
    : advanceAmt;
  const payNow = payMode === 'full' ? totalAmount : selectedAdvance;
  const remaining = totalAmount - payNow;

  // ── Payment Handler ─────────────────────────────────────────────
  const handlePayment = async () => {
    setLoading(true);
    setError('');

    if (payMode === 'partial' && payNow < 1) {
      setError('Please enter a valid advance amount.');
      setLoading(false);
      return;
    }

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

      // Step 3: Open Razorpay checkout modal
      const options = {
        key: orderRes.key,
        amount: orderRes.order.amount,
        currency: orderRes.order.currency,
        name: 'turf11',
        description: payMode === 'partial'
          ? `Advance ₹${payNow} for ${bookingData.turf.name}`
          : `Full payment for ${bookingData.turf.name}`,
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
              paymentStatus: verifyRes.data?.paymentStatus || (payMode === 'full' ? 'paid' : 'partially_paid'),
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
            <p className={styles.turfAddr}>📍 {bookingData.turf.address?.city}, {bookingData.turf.address?.state}</p>
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
                {bookingData.selectedSlots.map((s) => (
                  <span key={s.start} className={styles.slotChip}>
                    {formatTime(s.start)} – {formatTime(s.end)}
                  </span>
                ))}
              </div>
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

          {/* ── Advance Payment Section ── */}
          <div className={styles.card}>
            <h3>Payment Mode</h3>
            <div className={styles.payModeRow}>
              <button
                className={`${styles.payModeBtn} ${payMode === 'full' ? styles.payModeActive : ''}`}
                onClick={() => setPayMode('full')}
              >
                💳 Pay Full Amount
              </button>
              <button
                className={`${styles.payModeBtn} ${payMode === 'partial' ? styles.payModeActive : ''}`}
                onClick={() => setPayMode('partial')}
              >
                ⚡ Pay Advance
              </button>
            </div>

            {payMode === 'partial' && (
              <div className={styles.advanceSection}>
                <p className={styles.adviceNote}>
                  💡 Pay a small advance now, pay the rest at the turf.
                </p>
                <div className={styles.advanceOptions}>
                  {ADVANCE_OPTIONS(totalAmount)
                    .filter((opt) => opt.value < totalAmount)
                    .map((opt) => (
                      <button
                        key={opt.value}
                        className={`${styles.advanceChip} ${!useCustom && advanceAmt === opt.value ? styles.advanceChipActive : ''}`}
                        onClick={() => { setAdvanceAmt(opt.value); setUseCustom(false); }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  <button
                    className={`${styles.advanceChip} ${useCustom ? styles.advanceChipActive : ''}`}
                    onClick={() => setUseCustom(true)}
                  >
                    Custom
                  </button>
                </div>
                {useCustom && (
                  <div className={styles.customAmtRow}>
                    <span className={styles.rupeeSign}>₹</span>
                    <input
                      type="number"
                      min="1"
                      max={totalAmount - 1}
                      value={customAmt}
                      onChange={(e) => setCustomAmt(e.target.value)}
                      placeholder={`Max ₹${totalAmount - 1}`}
                      className={styles.customAmtInput}
                    />
                  </div>
                )}
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
            <span>Hours</span>
            <span>× {bookingData.selectedSlots.length}</span>
          </div>
          <div className={`${styles.row} ${styles.totalRow}`}>
            <strong>Total Amount</strong>
            <strong className={styles.totalAmount}>{formatPrice(totalAmount)}</strong>
          </div>

          {payMode === 'partial' && (
            <>
              <div style={{ borderTop: '1px dashed #e2e8f0', margin: '12px 0' }} />
              <div className={styles.row}>
                <span style={{ color: '#10b981', fontWeight: 600 }}>✅ Pay Now (Advance)</span>
                <span style={{ color: '#10b981', fontWeight: 700 }}>{formatPrice(payNow)}</span>
              </div>
              <div className={styles.row}>
                <span style={{ color: '#f59e0b', fontWeight: 600 }}>⚠️ Due at Venue</span>
                <span style={{ color: '#f59e0b', fontWeight: 700 }}>{formatPrice(remaining)}</span>
              </div>
            </>
          )}

          {error && <p className={styles.error}>{error}</p>}

          <button className={styles.payBtn} onClick={handlePayment} disabled={loading} id="pay-btn">
            {loading
              ? 'Processing...'
              : payMode === 'full'
              ? `Pay ${formatPrice(totalAmount)}`
              : `Pay Advance ${formatPrice(payNow)}`}
          </button>
          <p className={styles.secure}>🔒 Secured by Razorpay</p>
        </div>
      </div>
    </div>
  );
}

export default Booking;
