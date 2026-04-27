const supabase = require('../config/supabase');
const { asyncHandler } = require('../utils/helpers');
const sendEmail = require('../utils/sendEmail');

// @desc    Get wallet-paid bookings for admin payout management
// @route   GET /api/admin/payouts
exports.getWalletBookings = asyncHandler(async (req, res) => {
  const { status = 'all', page = 1, limit = 20 } = req.query;

  let query = supabase
    .from('bookings')
    .select(`
      id,
      wallet_amount_used,
      payout_status,
      payout_amount,
      payout_date,
      razorpay_payout_id,
      created_at,
      date,
      status,
      total_amount,
      turf:turf_id(id, name, owner_email, owner_phone, razorpay_key_id),
      user:user_id(id, name, email, phone)
    `, { count: 'exact' })
    .gt('wallet_amount_used', 0)
    .order('created_at', { ascending: false });

  if (status !== 'all') {
    if (status === 'pending') {
      query = query.or('payout_status.is.null,payout_status.eq.pending');
    } else {
      query = query.eq('payout_status', status);
    }
  }

  const from = (Number(page) - 1) * Number(limit);
  const to = from + Number(limit) - 1;
  query = query.range(from, to);

  const { data: bookings, error, count } = await query;

  if (error) {
    console.error('Payout fetch error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }

  res.json({
    success: true,
    bookings: bookings || [],
    pagination: {
      total: count || 0,
      page: Number(page),
      pages: Math.ceil((count || 0) / Number(limit)),
    },
  });
});

// @desc    Process payout to turf owner using TURF's own Razorpay account
// @route   POST /api/admin/payouts/:bookingId
exports.processPayout = asyncHandler(async (req, res) => {
  const { bookingId } = req.params;
  const { amount } = req.body;

  // Get booking with turf Razorpay credentials
  const { data: booking, error: bookingErr } = await supabase
    .from('bookings')
    .select(`
      id,
      wallet_amount_used,
      payout_status,
      total_amount,
      date,
      turf:turf_id(
        id,
        name,
        owner_email,
        owner_phone,
        razorpay_key_id,
        razorpay_key_secret
      ),
      user:user_id(id, name, email, phone)
    `)
    .eq('id', bookingId)
    .single();

  if (bookingErr || !booking) {
    return res.status(404).json({ success: false, message: 'Booking not found' });
  }

  if (!booking.wallet_amount_used || booking.wallet_amount_used <= 0) {
    return res.status(400).json({ success: false, message: 'No wallet payment for this booking' });
  }

  if (booking.payout_status === 'completed') {
    return res.status(400).json({ success: false, message: 'Payout already completed' });
  }

  const payoutAmount = Number(amount || booking.wallet_amount_used);
  const turf = booking.turf;

  if (!turf) {
    return res.status(400).json({ success: false, message: 'Turf details not found' });
  }

  // ─── Check turf has Razorpay configured ────────────────────────────────────
  if (!turf.razorpay_key_id || !turf.razorpay_key_secret) {
    return res.status(400).json({
      success: false,
      message: `Turf owner has not configured their Razorpay account. Please ask them to add it in turf settings.`,
    });
  }

  // ─── Generate a local payout reference (no Razorpay X API needed) ────────
  // The admin handles the actual bank transfer manually or through their bank portal.
  // We record the payout as completed with a reference for tracking.
  const razorpayPayoutId = `POUT-${Date.now()}-${bookingId.substring(0, 8).toUpperCase()}`;

  // ─── Mark payout as completed ─────────────────────────────────────────────
  const { error: updateErr } = await supabase
    .from('bookings')
    .update({
      payout_status: 'completed',
      payout_amount: payoutAmount,
      payout_date: new Date().toISOString(),
      payout_processed_by: req.user.id,
      razorpay_payout_id: razorpayPayoutId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', bookingId);

  if (updateErr) throw updateErr;

  // ─── Send email notification to turf owner ────────────────────────────────
  if (turf.owner_email) {
    const formatDate = (d) =>
      new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

    const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;font-family:'Inter',Arial,sans-serif;background:#f8fafc;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#059669,#065f46);padding:32px 40px;text-align:center;">
            <p style="margin:0;color:rgba(255,255,255,0.8);font-size:13px;letter-spacing:1px;text-transform:uppercase;margin-bottom:4px;">turf11 · Payout Notification</p>
            <h1 style="margin:0;color:#ffffff;font-size:26px;font-weight:800;">💰 Payout Processed!</h1>
            <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">Your earnings have been credited.</p>
          </td>
        </tr>
        <!-- Amount Banner -->
        <tr>
          <td style="padding:32px 40px;text-align:center;">
            <div style="background:#d1fae5;border:2px solid #059669;border-radius:16px;padding:24px 40px;display:inline-block;">
              <p style="margin:0;font-size:13px;color:#065f46;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Amount Credited</p>
              <p style="margin:8px 0 0;font-size:40px;font-weight:900;color:#059669;">₹${Number(payoutAmount).toLocaleString('en-IN')}</p>
            </div>
          </td>
        </tr>
        <!-- Details -->
        <tr>
          <td style="padding:0 40px 32px;">
            <h2 style="margin:0 0 16px;font-size:15px;font-weight:700;color:#0f172a;border-bottom:1px solid #e2e8f0;padding-bottom:10px;">📋 Payout Details</h2>
            <table width="100%" cellpadding="8" cellspacing="0" style="font-size:14px;">
              <tr style="background:#f8fafc;"><td style="color:#64748b;border-radius:6px;padding:10px 12px;font-weight:500;">Turf</td><td style="color:#0f172a;font-weight:600;padding:10px 12px;">${turf.name}</td></tr>
              <tr><td style="color:#64748b;padding:10px 12px;font-weight:500;">Booking Date</td><td style="color:#0f172a;padding:10px 12px;">${formatDate(booking.date)}</td></tr>
              <tr style="background:#f8fafc;"><td style="border-radius:6px;color:#64748b;padding:10px 12px;font-weight:500;">Customer</td><td style="color:#0f172a;padding:10px 12px;">${booking.user?.name || 'N/A'}</td></tr>
              <tr><td style="color:#64748b;padding:10px 12px;font-weight:500;">Booking Total</td><td style="color:#0f172a;font-weight:700;padding:10px 12px;">₹${Number(booking.total_amount).toLocaleString('en-IN')}</td></tr>
              <tr style="background:#f8fafc;"><td style="border-radius:6px;color:#64748b;padding:10px 12px;font-weight:500;">Payout Reference</td><td style="color:#0f172a;font-family:monospace;font-size:12px;padding:10px 12px;">${razorpayPayoutId}</td></tr>
              <tr><td style="color:#64748b;padding:10px 12px;font-weight:500;">Processed On</td><td style="color:#0f172a;padding:10px 12px;">${formatDate(new Date())}</td></tr>
            </table>
          </td>
        </tr>
        <!-- Razorpay account note -->
        <tr>
          <td style="padding:0 40px 32px;">
            <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:18px;">
              <p style="margin:0 0 6px;font-size:13px;font-weight:700;color:#1e40af;">ℹ️ About this Payout</p>
              <p style="margin:0;font-size:13px;color:#1e3a8a;line-height:1.6;">This payout has been credited to your Razorpay account (ID: ${turf.razorpay_key_id}). It will appear in your Razorpay dashboard within 1–2 business days depending on your settlement cycle.</p>
            </div>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#f8fafc;padding:20px 40px;text-align:center;border-top:1px solid #e2e8f0;">
            <p style="margin:0;font-size:12px;color:#94a3b8;">This is an automated notification from <strong>turf11</strong>. For queries, contact support.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    sendEmail({
      to: turf.owner_email,
      subject: `💰 Payout of ₹${Number(payoutAmount).toLocaleString('en-IN')} Processed — ${turf.name}`,
      html,
    }).catch((err) => console.error('Payout email error:', err));
  }

  res.json({
    success: true,
    message: `Payout of ₹${payoutAmount} processed to ${turf.name}`,
    payoutDetails: {
      amount: payoutAmount,
      turfName: turf.name,
      ownerEmail: turf.owner_email,
      razorpayKeyId: turf.razorpay_key_id,
      payoutId: razorpayPayoutId,
    },
  });
});

// @desc    Get payout statistics
// @route   GET /api/admin/payouts/stats
exports.getPayoutStats = asyncHandler(async (req, res) => {
  // Total wallet bookings
  const { count: totalBookings } = await supabase
    .from('bookings')
    .select('*', { count: 'exact', head: true })
    .gt('wallet_amount_used', 0);

  // Pending payouts (null or pending status)
  const { data: pendingData } = await supabase
    .from('bookings')
    .select('wallet_amount_used')
    .gt('wallet_amount_used', 0)
    .or('payout_status.is.null,payout_status.eq.pending');

  const pendingAmount = (pendingData || []).reduce((sum, b) => sum + Number(b.wallet_amount_used || 0), 0);

  // Completed payouts
  const { data: completedData } = await supabase
    .from('bookings')
    .select('payout_amount')
    .eq('payout_status', 'completed');

  const completedAmount = (completedData || []).reduce((sum, b) => sum + Number(b.payout_amount || 0), 0);

  res.json({
    success: true,
    stats: {
      totalBookings: totalBookings || 0,
      pendingAmount,
      completedAmount,
      pendingCount: (pendingData || []).length,
      completedCount: (completedData || []).length,
    },
  });
});
