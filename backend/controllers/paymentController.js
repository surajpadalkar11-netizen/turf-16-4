const crypto = require('crypto');
const defaultRazorpay = require('../config/razorpay');
const Razorpay = require('razorpay');
const supabase = require('../config/supabase');
const sendEmail = require('../utils/sendEmail');
const { asyncHandler } = require('../utils/helpers');

// Helper: payment status badge text + color
const getPaymentStatusLabel = (paymentStatus, totalAmount, amountPaid) => {
  const remaining = totalAmount - amountPaid;
  if (paymentStatus === 'paid') return { label: '✅ Fully Paid', color: '#10b981', bgColor: '#d1fae5' };
  if (paymentStatus === 'partially_paid') return { label: '⚠️ Partially Paid', color: '#f59e0b', bgColor: '#fef3c7' };
  return { label: '❌ Unpaid', color: '#ef4444', bgColor: '#fee2e2' };
};

// @desc    Create Razorpay order (supports partial/advance payment)
// @route   POST /api/payments/create-order
exports.createOrder = asyncHandler(async (req, res) => {
  const { bookingId, payAmount } = req.body;

  // Get booking with turf details
  const { data: booking, error: bookingErr } = await supabase
    .from('bookings')
    .select('*, turf:turf_id(id, name, razorpay_key_id, razorpay_key_secret, owner_email)')
    .eq('id', bookingId)
    .single();

  if (bookingErr || !booking) {
    return res.status(404).json({ success: false, message: 'Booking not found' });
  }

  if (booking.user_id !== req.user.id) {
    return res.status(403).json({ success: false, message: 'Not authorized' });
  }

  // Use provided payAmount (advance), otherwise use full total_amount
  const amountToCharge = payAmount
    ? Math.max(1, Math.min(Number(payAmount), Number(booking.total_amount)))
    : Number(booking.total_amount);

  const options = {
    amount: Math.round(amountToCharge * 100), // paise
    currency: 'INR',
    receipt: `booking_${booking.id.substring(0, 8)}`,
    notes: {
      bookingId: booking.id,
      turfName: booking.turf?.name || '',
      isAdvancePayment: amountToCharge < booking.total_amount ? 'yes' : 'no',
    },
  };

  const instance =
    booking.turf?.razorpay_key_id && booking.turf?.razorpay_key_secret
      ? new Razorpay({ key_id: booking.turf.razorpay_key_id, key_secret: booking.turf.razorpay_key_secret })
      : defaultRazorpay;

  if (!instance) {
    return res.status(400).json({ success: false, message: 'Razorpay keys not configured.' });
  }

  const order = await instance.orders.create(options);

  // Create payment record
  const { data: payment, error: payErr } = await supabase
    .from('payments')
    .insert({
      booking_id: booking.id,
      user_id: req.user.id,
      razorpay_order_id: order.id,
      amount: amountToCharge,
    })
    .select()
    .single();

  if (payErr) throw payErr;

  // Link payment to booking
  await supabase
    .from('bookings')
    .update({ payment_id: payment.id, updated_at: new Date().toISOString() })
    .eq('id', booking.id);

  res.json({
    success: true,
    order: { id: order.id, amount: order.amount, currency: order.currency },
    key: booking.turf?.razorpay_key_id || process.env.RAZORPAY_KEY_ID,
    isAdvancePayment: amountToCharge < booking.total_amount,
    amountToCharge,
    totalAmount: booking.total_amount,
    remainingAfterPayment: booking.total_amount - amountToCharge,
  });
});

// @desc    Verify payment signature
// @route   POST /api/payments/verify
exports.verifyPayment = asyncHandler(async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

  // Fetch payment with nested booking + turf
  const { data: payment, error } = await supabase
    .from('payments')
    .select('*, booking:booking_id(*, turf:turf_id(id, name, owner_email, owner_phone, razorpay_key_secret))')
    .eq('razorpay_order_id', razorpay_order_id)
    .single();

  if (error || !payment) {
    return res.status(404).json({ success: false, message: 'Payment not found' });
  }

  const secret = payment.booking?.turf?.razorpay_key_secret || process.env.RAZORPAY_KEY_SECRET;

  // Verify signature
  const body = razorpay_order_id + '|' + razorpay_payment_id;
  const expectedSignature = crypto.createHmac('sha256', secret).update(body).digest('hex');

  if (expectedSignature !== razorpay_signature) {
    return res.status(400).json({ success: false, message: 'Payment verification failed' });
  }

  // Update payment record
  await supabase
    .from('payments')
    .update({
      razorpay_payment_id,
      razorpay_signature,
      status: 'paid',
      updated_at: new Date().toISOString(),
    })
    .eq('id', payment.id);

  // Update booking: amount_paid, payment_status, and booking status
  const booking = payment.booking;
  const prevAmountPaid = Number(booking.amount_paid || 0);
  const newAmountPaid = Math.min(prevAmountPaid + Number(payment.amount), Number(booking.total_amount));
  const remaining = Number(booking.total_amount) - newAmountPaid;
  const paymentStatus = remaining <= 0 ? 'paid' : 'partially_paid';
  const bookingStatus = paymentStatus === 'paid' ? 'confirmed' : 'pending';

  await supabase
    .from('bookings')
    .update({
      status: bookingStatus,
      amount_paid: newAmountPaid,
      payment_status: paymentStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('id', payment.booking_id);

  // Get user details for email
  const { data: user } = await supabase.from('users').select('name, email').eq('id', payment.user_id).single();

  const bookingCode = `TRF-${booking.id.substring(0, 5).toUpperCase()}`;
  const dateOptions = { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' };
  const formattedDate = new Date(booking.date).toLocaleDateString('en-IN', dateOptions);
  const formatTime = (timeStr) => {
    if (!timeStr) return '';
    const [h, m] = timeStr.split(':');
    const hour = parseInt(h);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hr = hour % 12 || 12;
    return `${hr}:${m} ${ampm}`;
  };
  const timings = (booking.time_slots || []).map((t) => `${formatTime(t.start)} to ${formatTime(t.end)}`).join(', ');
  const isPartial = paymentStatus === 'partially_paid';
  const { label: psLabel, color: psColor, bgColor: psBg } = getPaymentStatusLabel(
    paymentStatus, booking.total_amount, newAmountPaid
  );

  // 1. Email to User
  if (user?.email) {
    await sendEmail({
      to: user.email,
      subject: `${isPartial ? '⚠️' : '✅'} turf11 – Booking ${isPartial ? 'Partially Paid' : 'Confirmed'} at ${booking.turf?.name}`,
      html: `
        <div style="font-family: Inter, Arial, sans-serif; max-width: 560px; margin: 0 auto; background: #f4f6fb; padding: 32px 16px;">
          <div style="background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">
            <div style="background: linear-gradient(135deg, #00d4aa 0%, #00a884 100%); padding: 32px; text-align: center;">
              <h1 style="color: #fff; margin: 0; font-size: 26px; font-weight: 800;">🏟️ turf11</h1>
              <p style="color: rgba(255,255,255,0.88); margin: 8px 0 0; font-size: 15px;">
                ${isPartial ? 'Advance paid — remaining due at venue' : 'Your booking is confirmed!'}
              </p>
            </div>
            <div style="padding: 32px;">
              <p style="font-size: 16px; color: #333; margin-bottom: 24px;">Hi <strong>${user.name}</strong> 👋,</p>
              
              <!-- Payment Status Badge -->
              <div style="background: ${psBg}; border: 2px solid ${psColor}; border-radius: 12px; padding: 16px 20px; margin-bottom: 24px; text-align: center;">
                <p style="margin: 0; font-size: 18px; font-weight: 700; color: ${psColor};">${psLabel}</p>
                ${isPartial ? `<p style="margin: 8px 0 0; font-size: 13px; color: #666;">Please pay <strong>₹${remaining}</strong> remaining amount at venue</p>` : ''}
              </div>

              <div style="background: #f0fdf9; border: 1.5px solid #00d4aa; border-radius: 12px; padding: 20px 24px; margin: 24px 0; text-align: center;">
                <p style="margin: 0 0 6px; font-size: 12px; color: #888; letter-spacing: 1px; text-transform: uppercase;">Your Booking Code</p>
                <p style="margin: 0; font-size: 30px; font-weight: 800; letter-spacing: 5px; color: #00a884; font-family: monospace;">${bookingCode}</p>
                <p style="margin: 6px 0 0; font-size: 12px; color: #888;">Show this code at the entrance</p>
              </div>

              <table style="width: 100%; border-collapse: collapse; font-size: 14px; color: #444;">
                <tr style="border-bottom: 1px solid #eee;"><td style="padding: 10px 0; color: #888;">Turf</td><td style="padding: 10px 0; font-weight: 600; text-align: right;">${booking.turf?.name}</td></tr>
                <tr style="border-bottom: 1px solid #eee;"><td style="padding: 10px 0; color: #888;">Date</td><td style="padding: 10px 0; font-weight: 600; text-align: right;">${formattedDate}</td></tr>
                <tr style="border-bottom: 1px solid #eee;"><td style="padding: 10px 0; color: #888;">Time</td><td style="padding: 10px 0; font-weight: 600; text-align: right;">${timings}</td></tr>
                <tr style="border-bottom: 1px solid #eee;"><td style="padding: 10px 0; color: #888;">Total Amount</td><td style="padding: 10px 0; font-weight: 600; text-align: right;">₹${booking.total_amount}</td></tr>
                <tr style="border-bottom: 1px solid #eee;"><td style="padding: 10px 0; color: #888;">Amount Paid Now</td><td style="padding: 10px 0; font-weight: 800; text-align: right; color: #00a884;">₹${payment.amount}</td></tr>
                ${isPartial ? `<tr><td style="padding: 10px 0; color: #888;">Remaining at Venue</td><td style="padding: 10px 0; font-weight: 800; text-align: right; color: #f59e0b;">₹${remaining}</td></tr>` : ''}
              </table>
            </div>
            <div style="background: #f8fafb; padding: 16px; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #bbb;">© ${new Date().getFullYear()} turf11. All rights reserved.</p>
            </div>
          </div>
        </div>
      `,
    });
  }

  // 2. Email to Turf Owner — with full payment breakdown
  if (booking.turf?.owner_email) {
    await sendEmail({
      to: booking.turf.owner_email,
      subject: `💰 turf11 – New Booking! ${isPartial ? '[PARTIAL PAYMENT]' : '[FULLY PAID]'} (${bookingCode})`,
      html: `
        <div style="font-family: Inter, Arial, sans-serif; max-width: 560px; margin: 0 auto; background: #f4f6fb; padding: 32px 16px;">
          <div style="background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">
            <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 32px; text-align: center;">
              <h1 style="color: #00d4aa; margin: 0; font-size: 26px; font-weight: 800;">🏟️ turf11</h1>
              <p style="color: rgba(255,255,255,0.7); margin: 8px 0 0;">New booking received for your turf!</p>
            </div>
            <div style="padding: 32px;">
              
              <!-- Payment Status -->
              <div style="background: ${psBg}; border: 2px solid ${psColor}; border-radius: 12px; padding: 16px 20px; margin-bottom: 24px; text-align: center;">
                <p style="margin: 0 0 4px; font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 1px;">Payment Status</p>
                <p style="margin: 0; font-size: 22px; font-weight: 800; color: ${psColor};">${psLabel}</p>
              </div>

              <!-- Booking Code -->
              <div style="background: #fff8e1; border: 1.5px solid #ffc107; border-radius: 12px; padding: 20px 24px; margin-bottom: 24px; text-align: center;">
                <p style="margin: 0 0 4px; font-size: 12px; color: #888; text-transform: uppercase; letter-spacing: 1px;">Booking Code</p>
                <p style="margin: 0; font-size: 28px; font-weight: 800; letter-spacing: 5px; color: #f57c00; font-family: monospace;">${bookingCode}</p>
              </div>

              <!-- Booking Details -->
              <table style="width: 100%; border-collapse: collapse; font-size: 14px; color: #444;">
                <tr style="border-bottom: 1px solid #eee;"><td style="padding: 10px 0; color: #888;">Turf</td><td style="padding: 10px 0; font-weight: 600; text-align: right;">${booking.turf?.name}</td></tr>
                <tr style="border-bottom: 1px solid #eee;"><td style="padding: 10px 0; color: #888;">Date</td><td style="padding: 10px 0; font-weight: 600; text-align: right;">${formattedDate}</td></tr>
                <tr style="border-bottom: 1px solid #eee;"><td style="padding: 10px 0; color: #888;">Time Slots</td><td style="padding: 10px 0; font-weight: 600; text-align: right;">${timings}</td></tr>
                <tr style="border-bottom: 1px solid #eee;"><td style="padding: 10px 0; color: #888;">Customer</td><td style="padding: 10px 0; font-weight: 600; text-align: right;">${user?.name} (${user?.email})</td></tr>
                <tr style="border-bottom: 2px solid #e2e8f0;"><td style="padding: 10px 0; color: #888;">Total Amount</td><td style="padding: 10px 0; font-weight: 700; text-align: right;">₹${booking.total_amount}</td></tr>
                <tr style="border-bottom: 1px solid #eee;"><td style="padding: 10px 0; color: #10b981; font-weight: 600;">✅ Amount Received</td><td style="padding: 10px 0; font-weight: 800; text-align: right; color: #10b981;">₹${newAmountPaid}</td></tr>
                ${isPartial ? `<tr><td style="padding: 10px 0; color: #f59e0b; font-weight: 600;">⚠️ Remaining to Collect</td><td style="padding: 10px 0; font-weight: 800; text-align: right; color: #f59e0b;">₹${remaining}</td></tr>` : ''}
              </table>

              ${isPartial ? `
              <div style="background: #fff7ed; border: 1px solid #fed7aa; border-radius: 12px; padding: 16px; margin-top: 24px;">
                <p style="margin: 0; font-size: 13px; color: #9a3412; font-weight: 600;">⚠️ Action Required</p>
                <p style="margin: 6px 0 0; font-size: 13px; color: #7c2d12;">This customer has paid ₹${newAmountPaid} as advance. Please collect the remaining <strong>₹${remaining}</strong> at the venue before they start playing.</p>
              </div>` : ''}
            </div>
            <div style="background: #f8fafb; padding: 16px; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #bbb;">© ${new Date().getFullYear()} turf11. All rights reserved.</p>
            </div>
          </div>
        </div>
      `,
    });
  }

  res.json({
    success: true,
    message: 'Payment verified successfully',
    paymentStatus,
    amountPaid: newAmountPaid,
    remainingAmount: remaining,
  });
});

// @desc    Get payment details
// @route   GET /api/payments/:id
exports.getPayment = asyncHandler(async (req, res) => {
  const { data: payment, error } = await supabase
    .from('payments')
    .select('*, booking:booking_id(*), user:user_id(id, name, email)')
    .eq('id', req.params.id)
    .single();

  if (error || !payment) {
    return res.status(404).json({ success: false, message: 'Payment not found' });
  }

  res.json({ success: true, payment: { _id: payment.id, ...payment } });
});
