const supabase = require('../config/supabase');
const { asyncHandler } = require('../utils/helpers');

// @desc    Get earnings summary for turf owner
// @route   GET /api/turf-owner/earnings/summary
exports.getEarningsSummary = asyncHandler(async (req, res) => {
  const turfOwnerId = req.user.id;

  // Get all turfs owned by this user
  const { data: turfs } = await supabase
    .from('turfs')
    .select('id')
    .eq('owner_id', turfOwnerId);

  if (!turfs || turfs.length === 0) {
    return res.json({
      success: true,
      earnings: {
        totalEarnings: 0,
        pendingAmount: 0,
        completedAmount: 0,
        pendingCount: 0,
        completedCount: 0,
        thisMonth: 0,
        thisMonthCount: 0,
      },
    });
  }

  const turfIds = turfs.map(t => t.id);

  // Get all wallet-paid bookings for these turfs
  const { data: allBookings } = await supabase
    .from('bookings')
    .select('wallet_amount_used, payout_status, payout_amount, created_at')
    .in('turf_id', turfIds)
    .gt('wallet_amount_used', 0);

  const bookings = allBookings || [];

  // Calculate stats
  const totalEarnings = bookings.reduce((sum, b) => sum + Number(b.wallet_amount_used || 0), 0);
  const totalCount = bookings.length;

  const pendingBookings = bookings.filter(b => b.payout_status !== 'completed');
  const pendingAmount = pendingBookings.reduce((sum, b) => sum + Number(b.wallet_amount_used || 0), 0);
  const pendingCount = pendingBookings.length;

  const completedBookings = bookings.filter(b => b.payout_status === 'completed');
  const completedAmount = completedBookings.reduce((sum, b) => sum + Number(b.payout_amount || 0), 0);
  const completedCount = completedBookings.length;

  // This month stats
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const thisMonthBookings = bookings.filter(b => new Date(b.created_at) >= startOfMonth);
  const thisMonth = thisMonthBookings.reduce((sum, b) => sum + Number(b.wallet_amount_used || 0), 0);
  const thisMonthCount = thisMonthBookings.length;

  res.json({
    success: true,
    earnings: {
      totalEarnings,
      totalCount,
      pendingAmount,
      completedAmount,
      pendingCount,
      completedCount,
      thisMonth,
      thisMonthCount,
    },
  });
});

// @desc    Get earnings transactions for turf owner
// @route   GET /api/turf-owner/earnings/transactions
exports.getEarningsTransactions = asyncHandler(async (req, res) => {
  const turfOwnerId = req.user.id;
  const { status = 'all', page = 1, limit = 20 } = req.query;

  // Get all turfs owned by this user
  const { data: turfs } = await supabase
    .from('turfs')
    .select('id')
    .eq('owner_id', turfOwnerId);

  if (!turfs || turfs.length === 0) {
    return res.json({
      success: true,
      transactions: [],
      pagination: { total: 0, page: 1, pages: 0 },
    });
  }

  const turfIds = turfs.map(t => t.id);

  let query = supabase
    .from('bookings')
    .select(`
      *,
      user:user_id(id, name, email, phone)
    `, { count: 'exact' })
    .in('turf_id', turfIds)
    .gt('wallet_amount_used', 0)
    .order('created_at', { ascending: false });

  if (status !== 'all') {
    query = query.eq('payout_status', status);
  }

  const from = (page - 1) * limit;
  const to = from + limit - 1;
  query = query.range(from, to);

  const { data: transactions, error, count } = await query;

  if (error) throw error;

  res.json({
    success: true,
    transactions: transactions || [],
    pagination: {
      total: count || 0,
      page: Number(page),
      pages: Math.ceil((count || 0) / limit),
    },
  });
});
