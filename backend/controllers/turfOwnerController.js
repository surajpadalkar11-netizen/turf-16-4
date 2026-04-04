const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const supabase = require('../config/supabase');
const { asyncHandler } = require('../utils/helpers');

const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE });

// @desc    Turf owner login (using owner_email of their turf)
// @route   POST /api/turf-owner/login
exports.turfOwnerLogin = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // Find user by email
  const { data: user, error } = await supabase
    .from('users')
    .select('id, name, email, phone, role, avatar, password')
    .eq('email', email.toLowerCase())
    .single();

  if (error || !user) {
    return res.status(401).json({ success: false, message: 'Invalid credentials' });
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    return res.status(401).json({ success: false, message: 'Invalid credentials' });
  }

  // Check if user is a turf owner (owns at least one turf) or admin
  const { data: ownedTurfs } = await supabase
    .from('turfs')
    .select('id, name')
    .or(`owner_id.eq.${user.id},owner_email.eq.${user.email}`);

  if ((!ownedTurfs || ownedTurfs.length === 0) && user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'No turf associated with this account' });
  }

  const token = generateToken(user.id);
  res.json({
    success: true,
    token,
    user: { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role, avatar: user.avatar },
    turfs: ownedTurfs || [],
  });
});

// @desc    Get turf owner's turfs
// @route   GET /api/turf-owner/turfs
exports.getOwnerTurfs = asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('turfs')
    .select('*')
    .or(`owner_id.eq.${req.user.id},owner_email.eq.${req.user.email}`);

  if (error) throw error;
  res.json({ success: true, turfs: data || [] });
});

// @desc    Get dashboard stats for a turf
// @route   GET /api/turf-owner/stats/:turfId
exports.getTurfStats = asyncHandler(async (req, res) => {
  const { turfId } = req.params;

  // Verify ownership
  const { data: turf } = await supabase
    .from('turfs')
    .select('id, name, owner_id, owner_email, price_per_hour, is_active')
    .eq('id', turfId)
    .single();

  if (!turf) return res.status(404).json({ success: false, message: 'Turf not found' });

  const isOwner =
    req.user.id === turf.owner_id ||
    req.user.email === turf.owner_email ||
    req.user.role === 'admin';

  if (!isOwner) return res.status(403).json({ success: false, message: 'Not authorized' });

  const today = new Date().toISOString().split('T')[0];
  const thisMonth = today.substring(0, 7);
  const monthStart = `${thisMonth}-01`;
  const monthEnd = new Date(
    Number(thisMonth.split('-')[0]),
    Number(thisMonth.split('-')[1]),
    0
  ).toISOString().split('T')[0];

  // Today's bookings
  const { data: todayBookings } = await supabase
    .from('bookings')
    .select('id, status, payment_status, total_amount, amount_paid, time_slots')
    .eq('turf_id', turfId)
    .eq('date', today)
    .neq('status', 'cancelled');

  // This month's bookings
  const { data: monthBookings, count: monthCount } = await supabase
    .from('bookings')
    .select('id, status, payment_status, total_amount, amount_paid', { count: 'exact' })
    .eq('turf_id', turfId)
    .gte('date', monthStart)
    .lte('date', monthEnd)
    .neq('status', 'cancelled');

  // Total revenue collected
  const monthRevenue = (monthBookings || []).reduce((sum, b) => sum + Number(b.amount_paid || 0), 0);
  const monthPending = (monthBookings || []).reduce(
    (sum, b) => sum + (Number(b.total_amount || 0) - Number(b.amount_paid || 0)),
    0
  );

  // Today's slots summary
  const bookedSlotStarts = new Set();
  (todayBookings || []).forEach((b) =>
    (b.time_slots || []).forEach((s) => bookedSlotStarts.add(s.start))
  );

  res.json({
    success: true,
    stats: {
      today: {
        totalBookings: (todayBookings || []).length,
        confirmedBookings: (todayBookings || []).filter((b) => b.status === 'confirmed').length,
        completedBookings: (todayBookings || []).filter((b) => b.status === 'completed').length,
        revenue: (todayBookings || []).reduce((sum, b) => sum + Number(b.amount_paid || 0), 0),
        pending: (todayBookings || []).reduce(
          (sum, b) => sum + (Number(b.total_amount || 0) - Number(b.amount_paid || 0)),
          0
        ),
        bookedSlotsCount: bookedSlotStarts.size,
      },
      month: {
        totalBookings: monthCount || 0,
        revenue: monthRevenue,
        pending: monthPending,
        fullyPaid: (monthBookings || []).filter((b) => b.payment_status === 'paid').length,
        partiallyPaid: (monthBookings || []).filter((b) => b.payment_status === 'partially_paid').length,
        unpaid: (monthBookings || []).filter((b) => b.payment_status === 'unpaid').length,
      },
    },
  });
});

// @desc    Get slot status for a turf on a date
// @route   GET /api/turf-owner/slots/:turfId?date=YYYY-MM-DD
exports.getTurfSlots = asyncHandler(async (req, res) => {
  const { turfId } = req.params;
  const { date } = req.query;

  if (!date) return res.status(400).json({ success: false, message: 'Date required' });

  const { data: turf } = await supabase
    .from('turfs')
    .select('id, operating_open, operating_close, owner_id, owner_email, price_per_hour')
    .eq('id', turfId)
    .single();

  if (!turf) return res.status(404).json({ success: false, message: 'Turf not found' });

  const isOwner =
    req.user.id === turf.owner_id ||
    req.user.email === turf.owner_email ||
    req.user.role === 'admin';

  if (!isOwner) return res.status(403).json({ success: false, message: 'Not authorized' });

  // Generate all slots
  const { generateTimeSlots } = require('../utils/helpers');
  const allSlots = generateTimeSlots(turf.operating_open, turf.operating_close);

  // Get bookings for that date
  const { data: bookings } = await supabase
    .from('bookings')
    .select('id, time_slots, status, payment_status, total_amount, amount_paid, user:user_id(id, name, email, phone)')
    .eq('turf_id', turfId)
    .eq('date', date)
    .neq('status', 'cancelled');

  // Map slots to booking info
  const slotMap = {};
  (bookings || []).forEach((booking) => {
    (booking.time_slots || []).forEach((slot) => {
      slotMap[slot.start] = {
        bookingId: booking.id,
        bookingStatus: booking.status,
        paymentStatus: booking.payment_status,
        totalAmount: booking.total_amount,
        amountPaid: booking.amount_paid,
        remainingAmount: booking.total_amount - booking.amount_paid,
        customer: booking.user,
        slotStart: slot.start,
        slotEnd: slot.end,
      };
    });
  });

  const slots = allSlots.map((slot) => ({
    ...slot,
    booking: slotMap[slot.start] || null,
    slotStatus: slotMap[slot.start]
      ? slotMap[slot.start].bookingStatus === 'completed'
        ? 'completed'
        : slotMap[slot.start].bookingStatus === 'confirmed'
        ? 'booked'
        : 'pending'
      : 'available',
  }));

  res.json({ success: true, slots, date, bookingsCount: bookings?.length || 0 });
});

// @desc    Verify booking code (QR / manual entry)
// @route   POST /api/turf-owner/verify-booking
exports.verifyBookingCode = asyncHandler(async (req, res) => {
  const { bookingCode, turfId } = req.body;

  if (!bookingCode) return res.status(400).json({ success: false, message: 'Booking code required' });

  // Booking code format: TRF-XXXXX (first 5 chars of UUID)
  const prefix = bookingCode.replace('TRF-', '').toLowerCase();

  const { data: bookings } = await supabase
    .from('bookings')
    .select('*, turf:turf_id(id, name, owner_id, owner_email), user:user_id(id, name, email, phone)')
    .ilike('id', `${prefix}%`)
    .neq('status', 'cancelled');

  if (!bookings || bookings.length === 0) {
    return res.status(404).json({ success: false, message: 'Booking not found or cancelled' });
  }

  const booking = turfId
    ? bookings.find((b) => b.turf_id === turfId) || bookings[0]
    : bookings[0];

  // Verify this booking belongs to owner's turf
  const isOwner =
    req.user.id === booking.turf?.owner_id ||
    req.user.email === booking.turf?.owner_email ||
    req.user.role === 'admin';

  if (!isOwner) return res.status(403).json({ success: false, message: 'This booking is not for your turf' });

  const today = new Date().toISOString().split('T')[0];
  const isToday = booking.date === today;

  res.json({
    success: true,
    booking: {
      id: booking.id,
      bookingCode: `TRF-${booking.id.substring(0, 5).toUpperCase()}`,
      date: booking.date,
      timeSlots: booking.time_slots,
      status: booking.status,
      paymentStatus: booking.payment_status,
      totalAmount: booking.total_amount,
      amountPaid: booking.amount_paid || 0,
      remainingAmount: booking.total_amount - (booking.amount_paid || 0),
      customer: booking.user,
      turf: { id: booking.turf?.id, name: booking.turf?.name },
      isToday,
    },
  });
});
