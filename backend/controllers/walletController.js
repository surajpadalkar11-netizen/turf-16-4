const supabase = require('../config/supabase');
const { asyncHandler } = require('../utils/helpers');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const sendEmail = require('../utils/sendEmail');

// ── Helper: credit / debit wallet and record transaction ──────────────────────
async function recordWalletTransaction(userId, type, amount, description, reference = '') {
  // Atomically update balance and insert transaction
  const { data: user, error: userErr } = await supabase
    .from('users')
    .select('wallet_balance')
    .eq('id', userId)
    .single();

  if (userErr || !user) throw new Error('User not found');

  const currentBalance = Number(user.wallet_balance || 0);
  const newBalance =
    type === 'credit'
      ? currentBalance + Number(amount)
      : currentBalance - Number(amount);

  if (newBalance < 0) throw new Error('Insufficient wallet balance');

  // Update user balance
  const { error: balErr } = await supabase
    .from('users')
    .update({ wallet_balance: newBalance, updated_at: new Date().toISOString() })
    .eq('id', userId);

  if (balErr) throw balErr;

  // Insert transaction record
  const { data: txn, error: txnErr } = await supabase
    .from('wallet_transactions')
    .insert({
      user_id: userId,
      type,
      amount: Number(amount),
      description,
      reference,
      balance_after: newBalance,
    })
    .select()
    .single();

  if (txnErr) throw txnErr;

  return { newBalance, transaction: txn };
}

// @desc    Get wallet balance & recent transactions
// @route   GET /api/wallet
exports.getWallet = asyncHandler(async (req, res) => {
  const { data: user, error: userErr } = await supabase
    .from('users')
    .select('id, name, wallet_balance')
    .eq('id', req.user.id)
    .single();

  if (userErr) throw userErr;

  const { data: transactions, error: txnErr } = await supabase
    .from('wallet_transactions')
    .select('*')
    .eq('user_id', req.user.id)
    .order('created_at', { ascending: false })
    .limit(50);

  if (txnErr) throw txnErr;

  res.json({
    success: true,
    balance: Number(user.wallet_balance || 0),
    transactions: transactions || [],
  });
});

// @desc    Create Razorpay order for wallet top-up
// @route   POST /api/wallet/create-order
exports.createWalletOrder = asyncHandler(async (req, res) => {
  const { amount } = req.body;

  if (!amount || Number(amount) < 10 || Number(amount) > 100000) {
    return res.status(400).json({ success: false, message: 'Amount must be between ₹10 and ₹1,00,000' });
  }

  // Get admin Razorpay keys from settings
  const { data: settings } = await supabase
    .from('admin_settings')
    .select('razorpay_key_id, razorpay_key_secret')
    .single();

  if (!settings?.razorpay_key_id || !settings?.razorpay_key_secret) {
    return res.status(400).json({ success: false, message: 'Razorpay not configured. Contact admin.' });
  }

  const razorpay = new Razorpay({
    key_id: settings.razorpay_key_id,
    key_secret: settings.razorpay_key_secret,
  });

  const options = {
    amount: Math.round(Number(amount) * 100), // paise
    currency: 'INR',
    receipt: `wallet_${req.user.id.substring(0, 8)}_${Date.now()}`,
    notes: {
      userId: req.user.id,
      userName: req.user.name || req.user.email,
      type: 'wallet_topup',
    },
  };

  const order = await razorpay.orders.create(options);

  // Store pending transaction
  const { data: pendingTxn } = await supabase
    .from('wallet_transactions')
    .insert({
      user_id: req.user.id,
      type: 'credit',
      amount: Number(amount),
      description: 'Wallet top-up (pending)',
      reference: order.id,
      balance_after: 0, // will update on verification
      status: 'pending',
    })
    .select()
    .single();

  res.json({
    success: true,
    order: { id: order.id, amount: order.amount, currency: order.currency },
    key: settings.razorpay_key_id,
  });
});

// @desc    Verify wallet payment
// @route   POST /api/wallet/verify-payment
exports.verifyWalletPayment = asyncHandler(async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

  // Get admin Razorpay secret
  const { data: settings } = await supabase
    .from('admin_settings')
    .select('razorpay_key_secret')
    .single();

  if (!settings?.razorpay_key_secret) {
    return res.status(400).json({ success: false, message: 'Razorpay not configured' });
  }

  // Verify signature
  const body = razorpay_order_id + '|' + razorpay_payment_id;
  const expectedSignature = crypto.createHmac('sha256', settings.razorpay_key_secret).update(body).digest('hex');

  if (expectedSignature !== razorpay_signature) {
    return res.status(400).json({ success: false, message: 'Payment verification failed' });
  }

  // Get pending transaction
  const { data: txn } = await supabase
    .from('wallet_transactions')
    .select('*')
    .eq('reference', razorpay_order_id)
    .eq('user_id', req.user.id)
    .single();

  if (!txn) {
    return res.status(404).json({ success: false, message: 'Transaction not found' });
  }

  // Credit wallet
  const { newBalance, transaction } = await recordWalletTransaction(
    req.user.id,
    'credit',
    Number(txn.amount),
    'Wallet top-up',
    razorpay_payment_id
  );

  // Delete pending transaction
  await supabase.from('wallet_transactions').delete().eq('id', txn.id);

  // Get user details for email
  const { data: user } = await supabase.from('users').select('name, email').eq('id', req.user.id).single();

  // Send confirmation email
  if (user?.email) {
    await sendEmail({
      to: user.email,
      subject: '✅ turf11 – Wallet Credited Successfully',
      html: `
        <div style="font-family: Inter, Arial, sans-serif; max-width: 560px; margin: 0 auto; background: #f4f6fb; padding: 32px 16px;">
          <div style="background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">
            <div style="background: linear-gradient(135deg, #00d4aa 0%, #00a884 100%); padding: 32px; text-align: center;">
              <h1 style="color: #fff; margin: 0; font-size: 26px; font-weight: 800;">💰 turf11</h1>
              <p style="color: rgba(255,255,255,0.88); margin: 8px 0 0; font-size: 15px;">Wallet credited successfully!</p>
            </div>
            <div style="padding: 32px;">
              <p style="font-size: 16px; color: #333; margin-bottom: 24px;">Hi <strong>${user.name}</strong> 👋,</p>

              <div style="background: #d1fae5; border: 2px solid #10b981; border-radius: 12px; padding: 20px 24px; margin-bottom: 24px; text-align: center;">
                <p style="margin: 0 0 6px; font-size: 13px; color: #065f46; text-transform: uppercase; letter-spacing: 1px;">Amount Added</p>
                <p style="margin: 0; font-size: 36px; font-weight: 900; color: #059669;">₹${Number(txn.amount).toLocaleString('en-IN')}</p>
              </div>

              <table style="width: 100%; border-collapse: collapse; font-size: 14px; color: #444; margin-bottom: 24px;">
                <tr style="border-bottom: 1px solid #eee;"><td style="padding: 10px 0; color: #888;">New Balance</td><td style="padding: 10px 0; font-weight: 700; text-align: right; color: #059669;">₹${newBalance.toLocaleString('en-IN')}</td></tr>
                <tr style="border-bottom: 1px solid #eee;"><td style="padding: 10px 0; color: #888;">Payment ID</td><td style="padding: 10px 0; font-weight: 600; text-align: right; font-family: monospace; font-size: 12px;">${razorpay_payment_id}</td></tr>
                <tr><td style="padding: 10px 0; color: #888;">Date & Time</td><td style="padding: 10px 0; font-weight: 600; text-align: right;">${new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</td></tr>
              </table>

              <div style="background: #f0fdf9; border: 1px solid #6ee7b7; border-radius: 12px; padding: 16px; margin-bottom: 20px;">
                <p style="margin: 0; font-size: 13px; color: #065f46;">✓ Your wallet has been credited and is ready to use for bookings!</p>
              </div>
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
    message: `₹${txn.amount} added to wallet`,
    balance: newBalance,
    transaction,
  });
});

// @desc    Admin credits wallet for a user (free points)
// @route   POST /api/wallet/admin-credit
exports.adminCreditWallet = asyncHandler(async (req, res) => {
  const { userId, amount, description } = req.body;

  if (!userId || !amount || Number(amount) <= 0) {
    return res.status(400).json({ success: false, message: 'userId and amount are required' });
  }

  // Verify the user exists
  const { data: targetUser } = await supabase.from('users').select('id, name, email').eq('id', userId).single();
  if (!targetUser) return res.status(404).json({ success: false, message: 'User not found' });

  const desc = description || `Free points by admin`;
  const { newBalance, transaction } = await recordWalletTransaction(
    userId,
    'credit',
    Number(amount),
    desc,
    `admin_free_${req.user.id}`
  );

  // Send email notification
  if (targetUser.email) {
    await sendEmail({
      to: targetUser.email,
      subject: '🎁 turf11 – Free Points Added to Your Wallet!',
      html: `
        <div style="font-family: Inter, Arial, sans-serif; max-width: 560px; margin: 0 auto; background: #f4f6fb; padding: 32px 16px;">
          <div style="background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">
            <div style="background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); padding: 32px; text-align: center;">
              <h1 style="color: #fff; margin: 0; font-size: 26px; font-weight: 800;">🎁 turf11</h1>
              <p style="color: rgba(255,255,255,0.88); margin: 8px 0 0; font-size: 15px;">You've received free points!</p>
            </div>
            <div style="padding: 32px;">
              <p style="font-size: 16px; color: #333; margin-bottom: 24px;">Hi <strong>${targetUser.name}</strong> 👋,</p>

              <div style="background: #eef2ff; border: 2px solid #6366f1; border-radius: 12px; padding: 20px 24px; margin-bottom: 24px; text-align: center;">
                <p style="margin: 0 0 6px; font-size: 13px; color: #4338ca; text-transform: uppercase; letter-spacing: 1px;">Free Points Added</p>
                <p style="margin: 0; font-size: 36px; font-weight: 900; color: #6366f1;">₹${Number(amount).toLocaleString('en-IN')}</p>
              </div>

              <table style="width: 100%; border-collapse: collapse; font-size: 14px; color: #444; margin-bottom: 24px;">
                <tr style="border-bottom: 1px solid #eee;"><td style="padding: 10px 0; color: #888;">New Balance</td><td style="padding: 10px 0; font-weight: 700; text-align: right; color: #6366f1;">₹${newBalance.toLocaleString('en-IN')}</td></tr>
                <tr style="border-bottom: 1px solid #eee;"><td style="padding: 10px 0; color: #888;">Reason</td><td style="padding: 10px 0; font-weight: 600; text-align: right;">${desc}</td></tr>
                <tr><td style="padding: 10px 0; color: #888;">Date & Time</td><td style="padding: 10px 0; font-weight: 600; text-align: right;">${new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</td></tr>
              </table>

              <div style="background: #f0fdf4; border: 1px solid #86efac; border-radius: 12px; padding: 16px; margin-bottom: 20px;">
                <p style="margin: 0; font-size: 13px; color: #166534;">✓ Use these points to book turfs at no extra cost!</p>
              </div>
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
    message: `₹${amount} credited to ${targetUser.name}'s wallet`,
    balance: newBalance,
    transaction,
  });
});

// @desc    Pay for booking using wallet balance
// @route   POST /api/wallet/pay-booking
exports.payBookingWithWallet = asyncHandler(async (req, res) => {
  const { bookingId, amount } = req.body;

  if (!bookingId || !amount || Number(amount) <= 0) {
    return res.status(400).json({ success: false, message: 'bookingId and amount are required' });
  }

  const payAmount = Number(amount);

  // Fetch booking
  const { data: booking, error: bkErr } = await supabase
    .from('bookings')
    .select('*, turf:turf_id(id, name, owner_email)')
    .eq('id', bookingId)
    .single();

  if (bkErr || !booking) {
    return res.status(404).json({ success: false, message: 'Booking not found' });
  }

  if (booking.user_id !== req.user.id) {
    return res.status(403).json({ success: false, message: 'Not authorized' });
  }

  if (booking.status === 'cancelled') {
    return res.status(400).json({ success: false, message: 'Booking is cancelled' });
  }

  // Check user wallet balance
  const { data: walletUser } = await supabase
    .from('users')
    .select('wallet_balance')
    .eq('id', req.user.id)
    .single();

  const currentBalance = Number(walletUser?.wallet_balance || 0);
  const actualPay = Math.min(payAmount, Number(booking.total_amount) - Number(booking.amount_paid || 0));

  if (currentBalance < actualPay) {
    return res.status(400).json({
      success: false,
      message: `Insufficient wallet balance. Available: ₹${currentBalance}, Required: ₹${actualPay}`,
    });
  }

  if (actualPay <= 0) {
    return res.status(400).json({ success: false, message: 'Booking is already fully paid' });
  }

  // Debit wallet
  const turfName = booking.turf?.name || 'Turf';
  const { newBalance, transaction: walletTxn } = await recordWalletTransaction(
    req.user.id,
    'debit',
    actualPay,
    `Booking payment — ${turfName}`,
    bookingId
  );

  // Update booking amounts
  const prevPaid = Number(booking.amount_paid || 0);
  const newAmountPaid = Math.min(prevPaid + actualPay, Number(booking.total_amount));
  const remaining = Number(booking.total_amount) - newAmountPaid;
  const paymentStatus = remaining <= 0 ? 'paid' : 'partially_paid';
  const bookingStatus = paymentStatus === 'paid' ? 'confirmed' : 'pending';
  const prevWalletUsed = Number(booking.wallet_amount_used || 0);

  const { data: updatedBooking, error: upErr } = await supabase
    .from('bookings')
    .update({
      status: bookingStatus,
      amount_paid: newAmountPaid,
      payment_status: paymentStatus,
      wallet_amount_used: prevWalletUsed + actualPay,
      payment_method: prevPaid > 0 ? 'mixed' : 'wallet',
      updated_at: new Date().toISOString(),
    })
    .eq('id', bookingId)
    .select()
    .single();

  if (upErr) throw upErr;

  // Get user details for email
  const { data: user } = await supabase.from('users').select('name, email').eq('id', req.user.id).single();

  // Send email to user about wallet payment
  if (user?.email) {
    const bookingCode = `TRF-${bookingId.substring(0, 5).toUpperCase()}`;
    const dateOptions = { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' };
    const formattedDate = new Date(booking.date).toLocaleDateString('en-IN', dateOptions);

    await sendEmail({
      to: user.email,
      subject: `✅ turf11 – Booking Paid via Wallet at ${turfName}`,
      html: `
        <div style="font-family: Inter, Arial, sans-serif; max-width: 560px; margin: 0 auto; background: #f4f6fb; padding: 32px 16px;">
          <div style="background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">
            <div style="background: linear-gradient(135deg, #00d4aa 0%, #00a884 100%); padding: 32px; text-align: center;">
              <h1 style="color: #fff; margin: 0; font-size: 26px; font-weight: 800;">🏟️ turf11</h1>
              <p style="color: rgba(255,255,255,0.88); margin: 8px 0 0; font-size: 15px;">Payment successful via wallet!</p>
            </div>
            <div style="padding: 32px;">
              <p style="font-size: 16px; color: #333; margin-bottom: 24px;">Hi <strong>${user.name}</strong> 👋,</p>

              <div style="background: #d1fae5; border: 2px solid #10b981; border-radius: 12px; padding: 16px 20px; margin-bottom: 24px; text-align: center;">
                <p style="margin: 0; font-size: 18px; font-weight: 700; color: #059669;">✅ Payment Successful</p>
              </div>

              <div style="background: #f0fdf9; border: 1.5px solid #00d4aa; border-radius: 12px; padding: 20px 24px; margin: 24px 0; text-align: center;">
                <p style="margin: 0 0 6px; font-size: 12px; color: #888; letter-spacing: 1px; text-transform: uppercase;">Booking Code</p>
                <p style="margin: 0; font-size: 30px; font-weight: 800; letter-spacing: 5px; color: #00a884; font-family: monospace;">${bookingCode}</p>
              </div>

              <table style="width: 100%; border-collapse: collapse; font-size: 14px; color: #444;">
                <tr style="border-bottom: 1px solid #eee;"><td style="padding: 10px 0; color: #888;">Turf</td><td style="padding: 10px 0; font-weight: 600; text-align: right;">${turfName}</td></tr>
                <tr style="border-bottom: 1px solid #eee;"><td style="padding: 10px 0; color: #888;">Date</td><td style="padding: 10px 0; font-weight: 600; text-align: right;">${formattedDate}</td></tr>
                <tr style="border-bottom: 1px solid #eee;"><td style="padding: 10px 0; color: #888;">Amount Paid</td><td style="padding: 10px 0; font-weight: 800; text-align: right; color: #00a884;">₹${actualPay}</td></tr>
                <tr style="border-bottom: 1px solid #eee;"><td style="padding: 10px 0; color: #888;">Payment Method</td><td style="padding: 10px 0; font-weight: 600; text-align: right;">Wallet</td></tr>
                <tr><td style="padding: 10px 0; color: #888;">Remaining Wallet Balance</td><td style="padding: 10px 0; font-weight: 700; text-align: right; color: #6366f1;">₹${newBalance.toLocaleString('en-IN')}</td></tr>
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

  // Send email to turf owner about wallet booking
  if (booking.turf?.owner_email) {
    const bookingCode = `TRF-${bookingId.substring(0, 5).toUpperCase()}`;
    const dateOptions = { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' };
    const formattedDate = new Date(booking.date).toLocaleDateString('en-IN', dateOptions);

    await sendEmail({
      to: booking.turf.owner_email,
      subject: `💰 turf11 – Booking Paid via Wallet (${bookingCode})`,
      html: `
        <div style="font-family: Inter, Arial, sans-serif; max-width: 560px; margin: 0 auto; background: #f4f6fb; padding: 32px 16px;">
          <div style="background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">
            <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 32px; text-align: center;">
              <h1 style="color: #00d4aa; margin: 0; font-size: 26px; font-weight: 800;">🏟️ turf11</h1>
              <p style="color: rgba(255,255,255,0.7); margin: 8px 0 0;">New booking paid via wallet!</p>
            </div>
            <div style="padding: 32px;">

              <div style="background: #d1fae5; border: 2px solid #10b981; border-radius: 12px; padding: 16px 20px; margin-bottom: 24px; text-align: center;">
                <p style="margin: 0 0 4px; font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 1px;">Payment Status</p>
                <p style="margin: 0; font-size: 22px; font-weight: 800; color: #059669;">✅ Paid via Wallet</p>
              </div>

              <div style="background: #fff8e1; border: 1.5px solid #ffc107; border-radius: 12px; padding: 20px 24px; margin-bottom: 24px; text-align: center;">
                <p style="margin: 0 0 4px; font-size: 12px; color: #888; text-transform: uppercase; letter-spacing: 1px;">Booking Code</p>
                <p style="margin: 0; font-size: 28px; font-weight: 800; letter-spacing: 5px; color: #f57c00; font-family: monospace;">${bookingCode}</p>
              </div>

              <table style="width: 100%; border-collapse: collapse; font-size: 14px; color: #444;">
                <tr style="border-bottom: 1px solid #eee;"><td style="padding: 10px 0; color: #888;">Turf</td><td style="padding: 10px 0; font-weight: 600; text-align: right;">${turfName}</td></tr>
                <tr style="border-bottom: 1px solid #eee;"><td style="padding: 10px 0; color: #888;">Date</td><td style="padding: 10px 0; font-weight: 600; text-align: right;">${formattedDate}</td></tr>
                <tr style="border-bottom: 1px solid #eee;"><td style="padding: 10px 0; color: #888;">Customer</td><td style="padding: 10px 0; font-weight: 600; text-align: right;">${user?.name} (${user?.email})</td></tr>
                <tr style="border-bottom: 2px solid #e2e8f0;"><td style="padding: 10px 0; color: #888;">Amount Paid</td><td style="padding: 10px 0; font-weight: 800; text-align: right; color: #10b981;">₹${actualPay}</td></tr>
              </table>

              <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 12px; padding: 16px; margin-top: 24px;">
                <p style="margin: 0; font-size: 13px; color: #1e40af; font-weight: 600;">ℹ️ Payment Note</p>
                <p style="margin: 6px 0 0; font-size: 13px; color: #1e3a8a;">This booking was paid using wallet balance. Admin will process payout to your account.</p>
              </div>
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
    message: `₹${actualPay} paid from wallet`,
    walletBalance: newBalance,
    booking: {
      id: updatedBooking.id,
      totalAmount: updatedBooking.total_amount,
      amountPaid: updatedBooking.amount_paid,
      remainingAmount: remaining,
      paymentStatus: updatedBooking.payment_status,
      status: updatedBooking.status,
    },
  });
});

// @desc    Get wallet balance for any user (Admin only)
// @route   GET /api/wallet/admin/user/:userId
exports.getAdminUserWallet = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  const { data: user } = await supabase
    .from('users')
    .select('id, name, email, wallet_balance')
    .eq('id', userId)
    .single();

  if (!user) return res.status(404).json({ success: false, message: 'User not found' });

  const { data: transactions } = await supabase
    .from('wallet_transactions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(30);

  res.json({
    success: true,
    user: { id: user.id, name: user.name, email: user.email },
    balance: Number(user.wallet_balance || 0),
    transactions: transactions || [],
  });
});

// Export helper for use in booking controller
module.exports.recordWalletTransaction = recordWalletTransaction;
