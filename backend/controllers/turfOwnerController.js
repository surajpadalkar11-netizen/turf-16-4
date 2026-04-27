const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const supabase = require('../config/supabase');
const { asyncHandler } = require('../utils/helpers');

const generateToken = (payload) =>
  jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE });

// @desc    Turf owner / supervisor login
// @route   POST /api/turf-owner/login
exports.turfOwnerLogin = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const normalizedEmail = email.trim().toLowerCase();

  // ── 1. Check supervisors table first ──────────────────────────────────
  const { data: supervisor } = await supabase
    .from('supervisors')
    .select('id, turf_id, name, email, password, is_active, turf:turf_id(id, name)')
    .eq('email', normalizedEmail)
    .single();

  if (supervisor) {
    if (!supervisor.is_active) {
      return res.status(403).json({ success: false, message: 'Supervisor account is disabled' });
    }
    const isMatch = await bcrypt.compare(password, supervisor.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    // Return supervisor session – token payload marks it as supervisor
    const token = generateToken({ supervisorId: supervisor.id, role: 'supervisor' });
    return res.json({
      success: true,
      token,
      user: {
        id: supervisor.id,
        name: supervisor.name,
        email: supervisor.email,
        role: 'supervisor',
        avatar: '',
      },
      turfs: supervisor.turf ? [supervisor.turf] : [],
      supervisorTurfId: supervisor.turf_id,
    });
  }

  // ── 2. Normal owner / admin login ─────────────────────────────────────
  const { data: user, error } = await supabase
    .from('users')
    .select('id, name, email, phone, role, avatar, password')
    .eq('email', normalizedEmail)
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

  const token = generateToken({ id: user.id });
  res.json({
    success: true,
    token,
    user: { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role || 'owner', avatar: user.avatar },
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

  const curr = new Date();
  const first = curr.getDate() - curr.getDay() + (curr.getDay() === 0 ? -6 : 1);
  const weekStartDt = new Date(curr.setDate(first));
  const weekEndDt = new Date(curr.setDate(first + 6));
  const weekStartStr = weekStartDt.toISOString().split('T')[0];
  const weekEndStr = weekEndDt.toISOString().split('T')[0];

  // Today's bookings
  const { data: todayBookingsData } = await supabase
    .from('bookings')
    .select('id, status, payment_status, total_amount, amount_paid, wallet_amount_used, time_slots, notes')
    .eq('turf_id', turfId)
    .eq('date', today)
    .neq('status', 'cancelled');
  const todayBookings = (todayBookingsData || []).filter((b) => b.notes !== 'Blocked by Admin');

  // This month's bookings
  const { data: monthBookingsData } = await supabase
    .from('bookings')
    .select('id, status, payment_status, total_amount, amount_paid, wallet_amount_used, time_slots, notes')
    .eq('turf_id', turfId)
    .gte('date', monthStart)
    .lte('date', monthEnd)
    .neq('status', 'cancelled');
  const monthBookings = (monthBookingsData || []).filter((b) => b.notes !== 'Blocked by Admin');
  const monthCount = monthBookings.length;

  const monthRevenue = (monthBookings || []).reduce((sum, b) => sum + Number(b.amount_paid || 0), 0);
  const monthPending = (monthBookings || []).reduce(
    (sum, b) => sum + (Number(b.total_amount || 0) - Number(b.amount_paid || 0)),
    0
  );

  const monthBookedHours = (monthBookings || []).reduce((total, b) => {
    const min = (b.time_slots || []).reduce((sum, s) => {
      const [h1, m1] = s.start.split(':').map(Number);
      const [h2, m2] = s.end.split(':').map(Number);
      const startMins = h1 * 60 + m1;
      let endMins = h2 * 60 + m2;
      if (endMins <= startMins) endMins += 1440; // midnight crossing
      return sum + (endMins - startMins);
    }, 0);
    return total + (min / 60);
  }, 0);

  // This week's bookings
  const { data: weekBookingsData } = await supabase
    .from('bookings')
    .select('id, status, payment_status, total_amount, amount_paid, wallet_amount_used, time_slots, notes')
    .eq('turf_id', turfId)
    .gte('date', weekStartStr)
    .lte('date', weekEndStr)
    .neq('status', 'cancelled');
  const weekBookings = (weekBookingsData || []).filter((b) => b.notes !== 'Blocked by Admin');
  const weekCount = weekBookings.length;

  const weekRevenue = (weekBookings || []).reduce((sum, b) => sum + Number(b.amount_paid || 0), 0);
  const weekPending = (weekBookings || []).reduce(
    (sum, b) => sum + (Number(b.total_amount || 0) - Number(b.amount_paid || 0)),
    0
  );

  const weekBookedHours = (weekBookings || []).reduce((total, b) => {
    const min = (b.time_slots || []).reduce((sum, s) => {
      const [h1, m1] = s.start.split(':').map(Number);
      const [h2, m2] = s.end.split(':').map(Number);
      const startMins = h1 * 60 + m1;
      let endMins = h2 * 60 + m2;
      if (endMins <= startMins) endMins += 1440;
      return sum + (endMins - startMins);
    }, 0);
    return total + (min / 60);
  }, 0);

  // Today's slots summary
  const todayBookedHours = (todayBookings || []).reduce((total, b) => {
    const min = (b.time_slots || []).reduce((sum, s) => {
      const [h1, m1] = s.start.split(':').map(Number);
      const [h2, m2] = s.end.split(':').map(Number);
      const startMins = h1 * 60 + m1;
      let endMins = h2 * 60 + m2;
      if (endMins <= startMins) endMins += 1440;
      return sum + (endMins - startMins);
    }, 0);
    return total + (min / 60);
  }, 0);

  // Overall all-time bookings
  const { data: overallBookingsData } = await supabase
    .from('bookings')
    .select('id, status, payment_status, total_amount, amount_paid, wallet_amount_used, time_slots, notes')
    .eq('turf_id', turfId)
    .neq('status', 'cancelled');
  const overallBookings = (overallBookingsData || []).filter((b) => b.notes !== 'Blocked by Admin');
  const overallCount = overallBookings.length;

  const overallRevenue = (overallBookings || []).reduce((sum, b) => sum + Number(b.amount_paid || 0), 0);
  const overallPending = (overallBookings || []).reduce(
    (sum, b) => sum + (Number(b.total_amount || 0) - Number(b.amount_paid || 0)),
    0
  );

  const overallBookedHours = (overallBookings || []).reduce((total, b) => {
    const min = (b.time_slots || []).reduce((sum, s) => {
      const [h1, m1] = s.start.split(':').map(Number);
      const [h2, m2] = s.end.split(':').map(Number);
      const startMins = h1 * 60 + m1;
      let endMins = h2 * 60 + m2;
      if (endMins <= startMins) endMins += 1440;
      return sum + (endMins - startMins);
    }, 0);
    return total + (min / 60);
  }, 0);

  res.json({
    success: true,
    isActive: turf.is_active,
    stats: {
      today: {
        totalBookings: (todayBookings || []).length,
        confirmedBookings: (todayBookings || []).filter((b) => b.status === 'confirmed').length,
        completedBookings: (todayBookings || []).filter((b) => b.status === 'completed').length,
        revenue: (todayBookings || []).reduce((sum, b) => sum + Number(b.amount_paid || 0), 0),
        walletRevenue: (todayBookings || []).reduce((sum, b) => sum + Number(b.wallet_amount_used || 0), 0),
        pending: (todayBookings || []).reduce(
          (sum, b) => sum + (Number(b.total_amount || 0) - Number(b.amount_paid || 0)),
          0
        ),
        fullyPaid: (todayBookings || []).filter((b) => b.payment_status === 'paid').length,
        partiallyPaid: (todayBookings || []).filter((b) => b.payment_status === 'partially_paid').length,
        unpaid: (todayBookings || []).filter((b) => b.payment_status === 'unpaid').length,
        bookedSlotsCount: todayBookedHours,
      },
      week: {
        totalBookings: weekCount || 0,
        confirmedBookings: (weekBookings || []).filter((b) => b.status === 'confirmed').length,
        completedBookings: (weekBookings || []).filter((b) => b.status === 'completed').length,
        revenue: weekRevenue,
        walletRevenue: (weekBookings || []).reduce((sum, b) => sum + Number(b.wallet_amount_used || 0), 0),
        pending: weekPending,
        fullyPaid: (weekBookings || []).filter((b) => b.payment_status === 'paid').length,
        partiallyPaid: (weekBookings || []).filter((b) => b.payment_status === 'partially_paid').length,
        unpaid: (weekBookings || []).filter((b) => b.payment_status === 'unpaid').length,
        bookedSlotsCount: weekBookedHours,
      },
      month: {
        totalBookings: monthCount || 0,
        confirmedBookings: (monthBookings || []).filter((b) => b.status === 'confirmed').length,
        completedBookings: (monthBookings || []).filter((b) => b.status === 'completed').length,
        revenue: monthRevenue,
        walletRevenue: (monthBookings || []).reduce((sum, b) => sum + Number(b.wallet_amount_used || 0), 0),
        pending: monthPending,
        fullyPaid: (monthBookings || []).filter((b) => b.payment_status === 'paid').length,
        partiallyPaid: (monthBookings || []).filter((b) => b.payment_status === 'partially_paid').length,
        unpaid: (monthBookings || []).filter((b) => b.payment_status === 'unpaid').length,
        bookedSlotsCount: monthBookedHours,
      },
      overall: {
        totalBookings: overallCount || 0,
        confirmedBookings: (overallBookings || []).filter((b) => b.status === 'confirmed').length,
        completedBookings: (overallBookings || []).filter((b) => b.status === 'completed').length,
        revenue: overallRevenue,
        walletRevenue: (overallBookings || []).reduce((sum, b) => sum + Number(b.wallet_amount_used || 0), 0),
        pending: overallPending,
        bookedSlotsCount: overallBookedHours,
        fullyPaid: (overallBookings || []).filter((b) => b.payment_status === 'paid').length,
        partiallyPaid: (overallBookings || []).filter((b) => b.payment_status === 'partially_paid').length,
        unpaid: (overallBookings || []).filter((b) => b.payment_status === 'unpaid').length,
      }
    },
  });
});


// @desc    Get slot status for a turf on a date
// @route   GET /api/turf-owner/slots/:turfId?date=YYYY-MM-DD
exports.getTurfSlots = asyncHandler(async (req, res) => {
  const { turfId } = req.params;
  const { date, interval } = req.query;

  if (!date) return res.status(400).json({ success: false, message: 'Date required' });
  const intervalMinutes = Math.max(15, parseInt(interval, 10) || 60);

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

  // Generate all slots based on requested interval
  const { generateTimeSlots } = require('../utils/helpers');
  const allSlots = generateTimeSlots(turf.operating_open, turf.operating_close, intervalMinutes);

  // Get bookings for that date
  const { data: bookingsData } = await supabase
    .from('bookings')
    .select('id, time_slots, status, payment_status, total_amount, amount_paid, notes, user:user_id(id, name, email, phone)')
    .eq('turf_id', turfId)
    .eq('date', date)
    .neq('status', 'cancelled');
  const bookings = bookingsData || [];

  // Map slots to booking info
  const bookedRanges = [];
  (bookings || []).forEach((booking) => {
    (booking.time_slots || []).forEach((slot) => {
      const [h1, m1] = slot.start.split(':').map(Number);
      const [h2, m2] = slot.end.split(':').map(Number);
      const startMins = h1 * 60 + m1;
      let endMins = h2 * 60 + m2;
      if (endMins <= startMins) endMins += 1440;
      bookedRanges.push({
        startMins,
        endMins,
        info: {
          bookingId: booking.id,
          bookingStatus: booking.status,
          paymentStatus: booking.payment_status,
          totalAmount: booking.total_amount,
          amountPaid: booking.amount_paid,
          remainingAmount: booking.total_amount - booking.amount_paid,
          customer: booking.user,
          notes: booking.notes,
          slotStart: slot.start,
          slotEnd: slot.end,
        }
      });
    });
  });

  const slots = allSlots.map((slot) => {
    const [h1, m1] = slot.start.split(':').map(Number);
    const [h2, m2] = slot.end.split(':').map(Number);
    const slotStart = h1 * 60 + m1;
    let slotEnd = h2 * 60 + m2;
    if (slotEnd <= slotStart) slotEnd += 1440;

    let overlappingInfo = null;
    for (const r of bookedRanges) {
      if ((slotStart >= r.startMins && slotStart < r.endMins) || 
          (slotEnd > r.startMins && slotEnd <= r.endMins) ||
          (slotStart <= r.startMins && slotEnd >= r.endMins)) {
        overlappingInfo = r.info;
        break;
      }
    }

    return {
      ...slot,
      booking: overlappingInfo || null,
      slotStatus: overlappingInfo
        ? overlappingInfo.notes === 'Blocked by Admin'
          ? 'blocked'
          : overlappingInfo.bookingStatus === 'completed'
          ? 'completed'
          : (overlappingInfo.bookingStatus === 'confirmed' && overlappingInfo.paymentStatus === 'paid')
          ? 'booked'
          : 'pending'
        : 'available',
    };
  });

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
    req.user.role === 'admin' ||
    (req.user.role === 'supervisor' && req.supervisor && req.supervisor.turf_id === booking.turf_id);


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

// @desc    Toggle turf active status
// @route   PUT /api/turf-owner/turf/:turfId/toggle-status
exports.toggleTurfStatus = asyncHandler(async (req, res) => {
  const { turfId } = req.params;

  // Verify ownership
  const { data: turf } = await supabase
    .from('turfs')
    .select('id, owner_id, owner_email, is_active')
    .eq('id', turfId)
    .single();

  if (!turf) return res.status(404).json({ success: false, message: 'Turf not found' });

  const isOwner =
    req.user.id === turf.owner_id ||
    req.user.email === turf.owner_email ||
    req.user.role === 'admin';

  if (!isOwner) return res.status(403).json({ success: false, message: 'Not authorized' });

  const { data: updated, error } = await supabase
    .from('turfs')
    .update({ is_active: !turf.is_active })
    .eq('id', turfId)
    .select()
    .single();

  if (error) throw error;
  res.json({ success: true, is_active: updated.is_active });
});

// @desc    Toggle slot blocking (admin block/unblock)
// @route   POST /api/turf-owner/slots/:turfId/toggle-block
exports.toggleSlotBlock = asyncHandler(async (req, res) => {
  const { turfId } = req.params;
  const { date, slot } = req.body;

  if (!date || !slot?.start || !slot?.end) {
    return res.status(400).json({ success: false, message: 'date, slot.start and slot.end are required' });
  }

  // Verify ownership
  const { data: turf } = await supabase
    .from('turfs')
    .select('id, owner_id, owner_email')
    .eq('id', turfId)
    .single();

  if (!turf) return res.status(404).json({ success: false, message: 'Turf not found' });

  const isOwner =
    req.user.id === turf.owner_id ||
    req.user.email === turf.owner_email ||
    req.user.role === 'admin';

  if (!isOwner) return res.status(403).json({ success: false, message: 'Not authorized' });

  // Parse the requested slot into minutes for overlap detection
  const [rH1, rM1] = slot.start.split(':').map(Number);
  const [rH2, rM2] = slot.end.split(':').map(Number);
  const reqStart = rH1 * 60 + rM1;
  let reqEnd   = rH2 * 60 + rM2;
  if (reqEnd <= reqStart) reqEnd += 1440;

  // Fetch ALL non-cancelled bookings for this turf+date
  const { data: existingBookings } = await supabase
    .from('bookings')
    .select('id, time_slots, notes, status')
    .eq('turf_id', turfId)
    .eq('date', date)
    .neq('status', 'cancelled');

  // Find overlapping 'Blocked by Admin' booking and any overlapping user booking
  let blockedBookingId = null;
  let hasUserBooking   = false;

  for (const b of (existingBookings || [])) {
    for (const s of (b.time_slots || [])) {
      const [h1, m1] = s.start.split(':').map(Number);
      const [h2, m2] = s.end.split(':').map(Number);
      const bStart = h1 * 60 + m1;
      let bEnd   = h2 * 60 + m2;
      if (bEnd <= bStart) bEnd += 1440;

      // Check overlap: two ranges overlap if one starts before the other ends
      const overlaps =
        (reqStart < bEnd && reqEnd > bStart);

      if (overlaps) {
        if (b.notes === 'Blocked by Admin') {
          blockedBookingId = b.id;
        } else {
          hasUserBooking = true;
        }
      }
    }
  }

  // UNBLOCK: if this slot (or an overlapping range) is already blocked by admin
  if (blockedBookingId) {
    await supabase.from('bookings').delete().eq('id', blockedBookingId);
    return res.json({ success: true, action: 'unblocked', message: 'Slot unblocked successfully' });
  }

  // GUARD: prevent blocking a slot that has a real user booking
  if (hasUserBooking) {
    return res.status(400).json({
      success: false,
      message: 'This slot already has a user booking. Cancel the booking first before blocking.'
    });
  }

  // BLOCK: create a sentinel booking
  const { error } = await supabase.from('bookings').insert({
    user_id: req.user.id,
    turf_id: turfId,
    date,
    time_slots: [{ start: slot.start, end: slot.end }],
    player_count: 1,
    total_amount: 0,
    amount_paid: 0,
    payment_status: 'paid',
    status: 'confirmed',
    notes: 'Blocked by Admin',
  });

  if (error) throw error;
  res.json({ success: true, action: 'blocked', message: 'Slot blocked successfully' });
});

// @desc    Update turf pricing (base + peak) — turf owner
// @route   PUT /api/turf-owner/turf/:turfId/pricing
exports.updateTurfPricing = asyncHandler(async (req, res) => {
  const { turfId } = req.params;
  const { pricePerHour, peakHourStart, peakHourEnd, peakPricePerHour } = req.body;

  const { data: turf } = await supabase
    .from('turfs')
    .select('id, owner_id, owner_email')
    .eq('id', turfId)
    .single();

  if (!turf) return res.status(404).json({ success: false, message: 'Turf not found' });

  const isOwner =
    req.user.id === turf.owner_id ||
    req.user.email === turf.owner_email ||
    req.user.role === 'admin';

  if (!isOwner) return res.status(403).json({ success: false, message: 'Not authorized' });

  const updates = { updated_at: new Date().toISOString() };
  if (pricePerHour !== undefined) updates.price_per_hour = Number(pricePerHour);
  if (peakHourStart !== undefined) updates.peak_hour_start = peakHourStart;
  if (peakHourEnd !== undefined) updates.peak_hour_end = peakHourEnd;
  if (peakPricePerHour !== undefined) {
    updates.peak_price_per_hour = peakPricePerHour ? Number(peakPricePerHour) : null;
  }

  const { data: updated, error } = await supabase
    .from('turfs')
    .update(updates)
    .eq('id', turfId)
    .select()
    .single();

  if (error) throw error;
  res.json({ success: true, message: 'Pricing updated', turf: updated });
});

// @desc    Update turf details (turf owner)
// @route   PUT /api/turf-owner/turf/:turfId
exports.updateTurfDetails = asyncHandler(async (req, res) => {
  const { turfId } = req.params;

  const { data: turf } = await supabase
    .from('turfs')
    .select('id, owner_id, owner_email')
    .eq('id', turfId)
    .single();

  if (!turf) return res.status(404).json({ success: false, message: 'Turf not found' });

  const isOwner =
    req.user.id === turf.owner_id ||
    req.user.email === turf.owner_email ||
    req.user.role === 'admin';

  if (!isOwner) return res.status(403).json({ success: false, message: 'Not authorized' });

  const {
    name, description, sportTypes, surfaceType,
    amenities, operatingHours, images, pricePerHour,
    peakHourStart, peakHourEnd, peakPricePerHour,
    address, dimensions
  } = req.body;

  const updates = { updated_at: new Date().toISOString() };
  if (name !== undefined) updates.name = name;
  if (description !== undefined) updates.description = description;
  if (sportTypes !== undefined) updates.sport_types = sportTypes;
  if (surfaceType !== undefined) updates.surface_type = surfaceType;
  if (amenities !== undefined) updates.amenities = amenities;
  if (images !== undefined) updates.images = images;
  if (operatingHours?.open !== undefined) updates.operating_open = operatingHours.open;
  if (operatingHours?.close !== undefined) updates.operating_close = operatingHours.close;
  if (pricePerHour !== undefined) updates.price_per_hour = Number(pricePerHour);
  if (peakHourStart !== undefined) updates.peak_hour_start = peakHourStart;
  if (peakHourEnd !== undefined) updates.peak_hour_end = peakHourEnd;
  if (peakPricePerHour !== undefined) {
    updates.peak_price_per_hour = peakPricePerHour ? Number(peakPricePerHour) : null;
  }
  if (address?.street !== undefined) updates.street = address.street;
  if (address?.city !== undefined) updates.city = address.city;
  if (address?.state !== undefined) updates.state = address.state;
  if (address?.pincode !== undefined) updates.pincode = address.pincode;
  if (dimensions?.length !== undefined) updates.dim_length = dimensions.length;
  if (dimensions?.width !== undefined) updates.dim_width = dimensions.width;

  const { data: updated, error } = await supabase
    .from('turfs')
    .update(updates)
    .eq('id', turfId)
    .select()
    .single();

  if (error) throw error;
  res.json({ success: true, message: 'Turf updated successfully', turf: updated });
});
