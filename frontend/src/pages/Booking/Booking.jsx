import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useBooking } from '../../context/BookingContext';
import { useAuth } from '../../context/AuthContext';
import { createBooking, abortBooking } from '../../services/bookingService';
import { createPaymentOrder, verifyPayment } from '../../services/paymentService';
import { payBookingWithWallet } from '../../services/walletService';
import { getWallet } from '../../services/walletService';
import { formatPrice, formatDate, formatTime } from '../../utils/formatters';
import styles from './Booking.module.css';

// Payment mode options
const PAY_MODES = [
  { id: 'full',    label: 'Full Payment',  icon: '💳', desc: 'Pay complete amount online' },
  { id: 'wallet',  label: 'Pay with Wallet', icon: '💰', desc: 'Use your wallet balance' },
  { id: 'advance', label: 'Partial Advance', icon: '⚡', desc: 'Pay part now, rest at venue' },
];

const ADVANCE_OPTIONS = [
  { label: '75%', percent: 75 },
  { label: '50%', percent: 50 },
  { label: '25%', percent: 25 },
  { label: 'Custom', percent: -1 },
];

function Booking() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, updateUser } = useAuth();
  const { bookingData, clearBooking, setPlayerCount } = useBooking();

  const [notes, setNotes]     = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [success, setSuccess] = useState(null);

  // Payment state
  const [payMode, setPayMode]         = useState('full'); // 'full' | 'wallet' | 'advance'
  const [advPercent, setAdvPercent]   = useState(50);     // for advance mode
  const [customAmt, setCustomAmt]     = useState('');     // for custom advance
  const [walletBal, setWalletBal]     = useState(user?.walletBalance || 0);
  const [walletLoading, setWalletLoading] = useState(false);

  // Fetch fresh wallet balance
  useEffect(() => {
    if (!user) return;
    setWalletLoading(true);
    getWallet()
      .then(({ data }) => {
        setWalletBal(data.balance);
        if (updateUser) updateUser({ ...user, walletBalance: data.balance });
      })
      .catch(() => {})
      .finally(() => setWalletLoading(false));
  }, []);

  if (!user) { navigate('/login'); return null; }

  // ── Success Screen ─────────────────────────────────────────────────────────
  if (success) {
    const isPartial = success.paymentStatus === 'partially_paid';
    return (
      <div className={styles.successPage}>
        <div className={styles.successCard}>
          <div className={styles.successIconWrap}>
            <span className={styles.successIcon}>{isPartial ? '⚡' : '✅'}</span>
          </div>
          <h2 className={styles.successTitle}>
            {isPartial ? 'Advance Paid!' : 'Booking Confirmed!'}
          </h2>
          <p className={styles.successSubtitle}>
            {isPartial
              ? `Pay ₹${success.remainingAmount} remaining at the venue`
              : `Confirmation sent to ${user.email}`}
          </p>

          {/* Booking code */}
          <div className={styles.bookingCodeBox}>
            <p className={styles.bookingCodeLabel}>Booking Code</p>
            <p className={styles.bookingCode}>{success.bookingCode}</p>
            <p className={styles.bookingCodeHint}>
              {isPartial ? 'Show this + pay remaining at entrance' : 'Show at the entrance'}
            </p>
          </div>

          {/* Payment breakdown */}
          <div className={styles.successBreakdown}>
            <div className={styles.successRow}>
              <span>Total Amount</span>
              <strong>₹{success.totalAmount}</strong>
            </div>
            <div className={styles.successRow} style={{ color: '#10b981' }}>
              <span>Paid Now</span>
              <strong>₹{success.amountPaid}</strong>
            </div>
            {isPartial && (
              <div className={styles.successRow} style={{ color: '#f59e0b' }}>
                <span>Due at Venue</span>
                <strong>₹{success.remainingAmount}</strong>
              </div>
            )}
          </div>

          <div className={styles.successActions}>
            <button className={styles.successBtn} onClick={() => navigate('/dashboard')}>
              📅 My Bookings
            </button>
            <button className={styles.successBtnSecondary} onClick={() => navigate('/')}>
              🏠 Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!bookingData.turf || bookingData.selectedSlots.length === 0) {
    return (
      <div className={styles.emptyPage}>
        <div className={styles.emptyCard}>
          <span style={{ fontSize: 52 }}>🏟️</span>
          <h2>No Booking Data</h2>
          <p>Please select a turf and time slots first.</p>
          <button onClick={() => navigate('/search')} className={styles.browseBtn}>
            Browse Turfs →
          </button>
        </div>
      </div>
    );
  }

  const totalAmount = bookingData.totalAmount;
  const totalDurationMin = bookingData.selectedSlots.reduce((s, sl) => s + (sl.durationMinutes || 60), 0);
  const totalHours = (totalDurationMin / 60).toFixed(1).replace('.0', '');

  // Compute payNow based on mode
  let payNow = totalAmount;
  if (payMode === 'wallet') {
    payNow = Math.min(walletBal, totalAmount);
  } else if (payMode === 'advance') {
    if (advPercent === -1) {
      payNow = Math.max(1, Math.min(parseInt(customAmt, 10) || 1, totalAmount));
    } else {
      payNow = Math.max(1, Math.round((advPercent / 100) * totalAmount));
    }
  }
  const remaining = totalAmount - payNow;
  const payPercent = Math.round((payNow / totalAmount) * 100);

  const walletCoversAll = walletBal >= totalAmount;
  const walletShortfall = payMode === 'wallet' ? Math.max(0, totalAmount - walletBal) : 0;

  // ── Payment Handler ────────────────────────────────────────────────────────
  const handlePayment = async () => {
    setLoading(true);
    setError('');
    let createdBookingId = null;

    try {
      // Step 1: Create booking
      const { data: bookingRes } = await createBooking({
        turfId: id,
        date: bookingData.date,
        timeSlots: bookingData.selectedSlots,
        playerCount: bookingData.playerCount,
        notes,
        advanceAmount: payNow,
      });
      createdBookingId = bookingRes.booking._id;

      // ── Wallet payment path ────────────────────────────────────────────────
      if (payMode === 'wallet') {
        const { data: walletRes } = await payBookingWithWallet(createdBookingId, payNow);
        // Update local wallet balance
        setWalletBal(walletRes.walletBalance);
        if (updateUser) updateUser({ ...user, walletBalance: walletRes.walletBalance });
        clearBooking();
        setSuccess({
          bookingCode: `TRF-${createdBookingId.substring(0, 5).toUpperCase()}`,
          totalAmount,
          amountPaid: walletRes.booking.amountPaid,
          remainingAmount: walletRes.booking.remainingAmount,
          paymentStatus: walletRes.booking.paymentStatus,
        });
        return;
      }

      // ── Razorpay payment path ──────────────────────────────────────────────
      const { data: orderRes } = await createPaymentOrder(createdBookingId, payNow);

      if (!window.Razorpay) {
        if (createdBookingId) abortBooking(createdBookingId).catch(() => {});
        setError('Payment gateway failed to load. Please refresh and try again.');
        setLoading(false);
        return;
      }

      const options = {
        key: orderRes.key,
        amount: orderRes.order.amount,
        currency: orderRes.order.currency,
        name: 'turf11',
        description: `Booking for ${bookingData.turf.name}`,
        order_id: orderRes.order.id,
        handler: async (response) => {
          try {
            const verifyRes = await verifyPayment({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            clearBooking();
            setSuccess({
              bookingCode: `TRF-${createdBookingId.substring(0, 5).toUpperCase()}`,
              totalAmount,
              amountPaid: verifyRes.data?.amountPaid || payNow,
              remainingAmount: verifyRes.data?.remainingAmount || remaining,
              paymentStatus: verifyRes.data?.paymentStatus || (payMode === 'full' ? 'paid' : 'partially_paid'),
            });
          } catch {
            setError('Payment verification failed. Contact support with ID: ' + response.razorpay_payment_id);
          }
        },
        modal: {
          ondismiss: () => {
            if (createdBookingId) abortBooking(createdBookingId).catch(() => {});
            setLoading(false);
            setError('Payment cancelled. Your slot has been released.');
          },
        },
        prefill: { name: user.name, email: user.email, contact: user.phone || '' },
        theme: { color: '#00d4aa' },
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', (response) => {
        if (createdBookingId) abortBooking(createdBookingId).catch(() => {});
        setError(`Payment failed: ${response.error.description}`);
        setLoading(false);
      });
      rzp.open();
    } catch (err) {
      if (createdBookingId) abortBooking(createdBookingId).catch(() => {});
      setError(err.response?.data?.message || 'Booking failed. Please try again.');
      setLoading(false);
    }
  };

  // ── UI ─────────────────────────────────────────────────────────────────────
  return (
    <div className={styles.page}>
      <div className={styles.container}>

        {/* Page Header */}
        <div className={styles.pageHeader}>
          <button className={styles.backBtn} onClick={() => navigate(-1)}>← Back</button>
          <div>
            <h1 className={styles.pageTitle}>Confirm Booking</h1>
            <p className={styles.pageSubtitle}>{bookingData.turf.name}</p>
          </div>
        </div>

        {/* ── SINGLE COLUMN STACK (top to bottom) ── */}
        <div className={styles.stack}>

          {/* 1. Turf Summary */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <span className={styles.cardIcon}>🏟️</span>
              <h2 className={styles.cardTitle}>Turf Details</h2>
            </div>
            <div className={styles.turfSummary}>
              <div className={styles.turfName}>{bookingData.turf.name}</div>
              <div className={styles.turfAddr}>
                📍 {[bookingData.turf.address?.city, bookingData.turf.address?.state].filter(Boolean).join(', ') || 'Location not set'}
              </div>
            </div>
          </div>

          {/* 2. Booking Details */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <span className={styles.cardIcon}>📅</span>
              <h2 className={styles.cardTitle}>Booking Details</h2>
            </div>
            <div className={styles.detailRows}>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Date</span>
                <span className={styles.detailValue}>{formatDate(bookingData.date)}</span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Duration</span>
                <span className={styles.detailValue}>
                  <strong>{totalDurationMin} min</strong> ({totalHours} hr{totalHours !== '1' ? 's' : ''})
                </span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Rate</span>
                <span className={styles.detailValue}>{formatPrice(bookingData.turf.pricePerHour)}/hr</span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Time Slots</span>
                <div className={styles.slotsWrap}>
                  {bookingData.selectedSlots.map((s) => {
                    const isPeak = s.priceUsed && bookingData.turf.peakPricePerHour && s.priceUsed === bookingData.turf.peakPricePerHour;
                    return (
                      <span key={s.start} className={`${styles.slotChip} ${isPeak ? styles.peakSlot : ''}`}>
                        {formatTime(s.start)} – {formatTime(s.end)}
                        {isPeak && <span className={styles.peakDot}>🌙</span>}
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* 3. Player Details */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <span className={styles.cardIcon}>⚽</span>
              <h2 className={styles.cardTitle}>Player Details</h2>
            </div>
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Number of Players</label>
              <div className={styles.playerCounter}>
                <button
                  type="button"
                  className={styles.counterBtn}
                  onClick={() => setPlayerCount(Math.max(1, bookingData.playerCount - 1))}
                >−</button>
                <span className={styles.counterVal}>{bookingData.playerCount}</span>
                <button
                  type="button"
                  className={styles.counterBtn}
                  onClick={() => setPlayerCount(Math.min(30, bookingData.playerCount + 1))}
                >+</button>
              </div>
            </div>
            <div className={styles.fieldGroup} style={{ marginTop: 16 }}>
              <label className={styles.fieldLabel}>Special Requests <span className={styles.optionalTag}>(Optional)</span></label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any special requirements..."
                className={styles.textarea}
                rows={3}
                id="booking-notes"
              />
            </div>
          </div>

          {/* 4. Amount Summary */}
          <div className={styles.amtSummaryCard}>
            <div className={styles.amtRow}>
              <span>Price per hour</span>
              <span>{formatPrice(bookingData.turf.pricePerHour)}</span>
            </div>
            <div className={styles.amtRow}>
              <span>Duration</span>
              <span>{totalDurationMin} min ({totalHours}h)</span>
            </div>
            <div className={styles.amtRowTotal}>
              <strong>Total Amount</strong>
              <strong className={styles.totalPrice}>{formatPrice(totalAmount)}</strong>
            </div>
          </div>

          {/* 5. Payment Method */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <span className={styles.cardIcon}>💳</span>
              <h2 className={styles.cardTitle}>Choose Payment Method</h2>
            </div>

            {/* Mode cards */}
            <div className={styles.payModeGrid}>
              {PAY_MODES.map((pm) => {
                const isActive = payMode === pm.id;
                const isDisabled = pm.id === 'wallet' && walletBal <= 0;
                return (
                  <button
                    key={pm.id}
                    className={`${styles.payModeCard} ${isActive ? styles.payModeActive : ''} ${isDisabled ? styles.payModeDisabled : ''}`}
                    onClick={() => !isDisabled && setPayMode(pm.id)}
                    id={`paymode-${pm.id}`}
                    disabled={isDisabled}
                  >
                    <span className={styles.payModeIcon}>{pm.icon}</span>
                    <div className={styles.payModeText}>
                      <span className={styles.payModeLabel}>{pm.label}</span>
                      <span className={styles.payModeDesc}>
                        {pm.id === 'wallet'
                          ? walletLoading
                            ? 'Loading...'
                            : walletBal > 0
                              ? `Balance: ₹${walletBal.toLocaleString('en-IN')}`
                              : 'No balance — Add funds'
                          : pm.desc}
                      </span>
                    </div>
                    {isActive && <span className={styles.payModeCheck}>✓</span>}
                  </button>
                );
              })}
            </div>

            {/* Wallet shortfall notice */}
            {payMode === 'wallet' && walletShortfall > 0 && (
              <div className={styles.walletShortNote}>
                <span>⚠️</span>
                <div>
                  <div className={styles.walletShortTitle}>
                    Wallet covers ₹{payNow} — ₹{walletShortfall} remains
                  </div>
                  <div className={styles.walletShortDesc}>
                    Pay remaining ₹{walletShortfall} in cash at the venue, or{' '}
                    <Link to="/wallet" className={styles.topUpLink}>top up wallet</Link>
                  </div>
                </div>
              </div>
            )}

            {/* Wallet zero notice */}
            {payMode === 'wallet' && walletBal <= 0 && (
              <div className={styles.walletEmptyNote}>
                💰 Your wallet is empty.{' '}
                <Link to="/wallet" className={styles.topUpLink}>Add funds →</Link>
              </div>
            )}

            {/* Advance options */}
            {payMode === 'advance' && (
              <div className={styles.advanceBlock}>
                <p className={styles.advanceHint}>How much to pay online now?</p>
                <div className={styles.advanceOptions}>
                  {ADVANCE_OPTIONS.map((opt) => (
                    <button
                      key={opt.percent}
                      className={`${styles.advBtn} ${advPercent === opt.percent ? styles.advBtnActive : ''}`}
                      onClick={() => { setAdvPercent(opt.percent); if (opt.percent !== -1) setCustomAmt(''); }}
                    >
                      {opt.label}
                      {opt.percent !== -1 && (
                        <span className={styles.advAmt}>₹{Math.round((opt.percent / 100) * totalAmount)}</span>
                      )}
                    </button>
                  ))}
                </div>
                {advPercent === -1 && (
                  <div className={styles.customInputWrap}>
                    <span className={styles.rupeeSign}>₹</span>
                    <input
                      type="number"
                      min={1}
                      max={totalAmount}
                      value={customAmt}
                      onChange={(e) => setCustomAmt(e.target.value)}
                      placeholder={`1 – ${totalAmount}`}
                      className={styles.customInput}
                      id="custom-advance-amount"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Cash note */}
            {remaining > 0 && payMode !== 'wallet' && (
              <div className={styles.cashNote}>
                <span>💵</span>
                <div>
                  <div className={styles.cashNoteTitle}>₹{remaining} due in cash at venue</div>
                  <div className={styles.cashNoteDesc}>Bring exact change. Show booking code at entrance.</div>
                </div>
              </div>
            )}

            {/* Split visualiser */}
            {remaining > 0 && payMode !== 'wallet' && (
              <div className={styles.splitBar}>
                <div className={styles.splitOnline} style={{ width: `${payPercent}%` }} title={`Online: ₹${payNow}`} />
                <div className={styles.splitCash} style={{ width: `${100 - payPercent}%` }} title={`Cash: ₹${remaining}`} />
              </div>
            )}
            {remaining > 0 && payMode !== 'wallet' && (
              <div className={styles.splitLegend}>
                <span className={styles.splitDotOnline} />
                Online: <strong>₹{payNow}</strong>
                <span className={styles.splitDotCash} style={{ marginLeft: 14 }} />
                Cash: <strong>₹{remaining}</strong>
              </div>
            )}
          </div>

          {/* 6. CTA */}
          <div className={styles.ctaBox}>
            {error && <div className={styles.errorBox}>⚠️ {error}</div>}

            <div className={styles.ctaSummary}>
              <div>
                <span className={styles.ctaLabel}>
                  {payMode === 'wallet' ? '💰 From Wallet' : payMode === 'full' ? '💳 Pay Online' : '⚡ Pay Online Now'}
                </span>
                <span className={styles.ctaAmount}>{formatPrice(payNow)}</span>
              </div>
              {remaining > 0 && payMode !== 'wallet' && (
                <span className={styles.ctaCash}>+ ₹{remaining} cash at venue</span>
              )}
              {payMode === 'wallet' && remaining > 0 && (
                <span className={styles.ctaCash}>+ ₹{remaining} cash at venue</span>
              )}
            </div>

            <button
              className={styles.payBtn}
              onClick={handlePayment}
              disabled={loading || (payMode === 'wallet' && walletBal <= 0)}
              id="confirm-pay-btn"
            >
              {loading ? (
                <><span className={styles.btnSpinner} /> Processing…</>
              ) : payMode === 'wallet' ? (
                `💰 Pay ₹${payNow} from Wallet`
              ) : payNow >= totalAmount ? (
                `💳 Pay Full ${formatPrice(totalAmount)}`
              ) : (
                `💳 Pay ${formatPrice(payNow)} Online`
              )}
            </button>

            <p className={styles.secureNote}>🔒 100% Secure · Powered by Razorpay & turf11 Wallet</p>
          </div>

        </div>{/* end .stack */}
      </div>
    </div>
  );
}

export default Booking;
