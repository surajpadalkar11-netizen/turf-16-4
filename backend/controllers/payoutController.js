const supabase = require('../config/supabase');
const Razorpay = require('razorpay');
const { asyncHandler } = require('../utils/helpers');

// @desc    Get wallet-paid bookings for admin payout management
// @route   GET /api/admin/payouts
exports.getWalletBookings = asyncHandler(async (req, res) => {
  const { status = 'all', page = 1, limit = 20 } = req.query;

  let query = supabase
    .from('bookings')
    .select(`
      *,
      turf:turf_id(id, name, owner_email, owner_phone, razorpay_key_id),
      user:user_id(id, name, email, phone)
    `, { count: 'exact' })
    .gt('wallet_amount_used', 0)
    .order('created_at', { ascending: false });

  if (status !== 'all') {
    query = query.eq('payout_status', status);
  }

  const from = (page - 1) * limit;
  const to = from + limit - 1;
  query = query.range(from, to);

  const { data: bookings, error, count } = await query;

  if (error) throw error;

  res.json({
    success: true,
    bookings: bookings || [],
    pagination: {
      total: count || 0,
      page: Number(page),
      pages: Math.ceil((count || 0) / limit),
    },
  });
});

// @desc    Process payout to turf owner
// @route   POST /api/admin/payouts/:bookingId
exports.processPayout = asyncHandler(async (req, res) => {
  const { bookingId } = req.params;
  const { amount } = req.body;

  // Get booking details
  const { data: booking, error: bookingErr } = await supabase
    .from('bookings')
    .select(`
      *,
      turf:turf_id(id, name, owner_email, owner_phone, razorpay_key_id, razorpay_key_secret)
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

  const payoutAmount = amount || booking.wallet_amount_used;

  // Get admin Razorpay keys
  const { data: settings } = await supabase
    .from('admin_settings')
    .select('razorpay_key_id, razorpay_key_secret')
    .single();

  if (!settings?.razorpay_key_id || !settings?.razorpay_key_secret) {
    return res.status(400).json({ success: false, message: 'Admin Razorpay not configured' });
  }

  // Note: Razorpay Payouts require X account with payouts enabled
  // For now, we'll mark as completed and admin processes manually
  // In production, integrate Razorpay Payouts API

  const { data: updatedBooking, error: updateErr } = await supabase
    .from('bookings')
    .update({
      payout_status: 'completed',
      payout_amount: payoutAmount,
      payout_date: new Date().toISOString(),
      payout_processed_by: req.user.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', bookingId)
    .select()
    .single();

  if (updateErr) throw updateErr;

  res.json({
    success: true,
    message: `Payout of ₹${payoutAmount} marked as completed`,
    booking: updatedBooking,
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

  // Pending payouts
  const { data: pendingData } = await supabase
    .from('bookings')
    .select('wallet_amount_used')
    .gt('wallet_amount_used', 0)
    .or('payout_status.is.null,payout_status.eq.pending');

  const pendingAmount = pendingData?.reduce((sum, b) => sum + Number(b.wallet_amount_used || 0), 0) || 0;

  // Completed payouts
  const { data: completedData } = await supabase
    .from('bookings')
    .select('payout_amount')
    .eq('payout_status', 'completed');

  const completedAmount = completedData?.reduce((sum, b) => sum + Number(b.payout_amount || 0), 0) || 0;

  res.json({
    success: true,
    stats: {
      totalBookings: totalBookings || 0,
      pendingAmount,
      completedAmount,
      pendingCount: pendingData?.length || 0,
      completedCount: completedData?.length || 0,
    },
  });
});
