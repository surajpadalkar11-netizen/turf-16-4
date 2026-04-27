const supabase = require('../config/supabase');
const { asyncHandler } = require('../utils/helpers');
const { sendRefundEmail } = require('../utils/sendEmail');

const mapBooking = (b) => ({
  _id: b.id,
  id: b.id,
  user: b.user ? { _id: b.user.id || b.user_id, ...b.user } : b.user_id,
  turf: b.turf ? { _id: b.turf.id || b.turf_id, ...b.turf } : b.turf_id,
  date: b.date,
  timeSlots: b.time_slots,
  playerCount: b.player_count,
  totalAmount: b.total_amount,
  advanceAmount: b.advance_amount || 0,
  amountPaid: b.amount_paid || 0,
  remainingAmount: (b.total_amount || 0) - (b.amount_paid || 0),
  paymentStatus: b.payment_status || 'unpaid',
  paymentMethod: b.payment_method || 'online',
  walletAmountUsed: b.wallet_amount_used || 0,
  status: b.status,
  paymentId: b.payment_id,
  notes: b.notes,
  createdAt: b.created_at,
  updatedAt: b.updated_at,
});

// @desc    Create a booking
// @route   POST /api/bookings
exports.createBooking = asyncHandler(async (req, res) => {
  const { turfId, date, timeSlots, playerCount, notes, advanceAmount } = req.body;

  const { data: turf, error: turfErr } = await supabase
    .from('turfs')
    .select('id, price_per_hour, peak_hour_start, peak_hour_end, peak_price_per_hour, name, images, street, city, state, pincode, owner_email')
    .eq('id', turfId)
    .single();

  if (turfErr || !turf) {
    return res.status(404).json({ success: false, message: 'Turf not found' });
  }

  // ── Step 0: Purge stale pending+unpaid bookings (older than 15 min) ────────────
  // These are bookings where the user opened the payment page but never paid.
  const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const { data: stalePending } = await supabase
    .from('bookings')
    .select('id')
    .eq('turf_id', turfId)
    .eq('date', date)
    .eq('status', 'pending')
    .eq('payment_status', 'unpaid')
    .lt('created_at', fifteenMinAgo);

  if (stalePending && stalePending.length > 0) {
    const staleIds = stalePending.map((b) => b.id);
    await supabase
      .from('bookings')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .in('id', staleIds);
    console.log(`🧹 [createBooking] Purged ${staleIds.length} stale pending bookings for turf ${turfId} on ${date}`);
  }

  // ── Step 1: Check slot availability ───────────────────────────────────
  // Only block slots that are:
  //   a) confirmed (paid or partially paid), OR
  //   b) pending AND created within the last 15 minutes (active checkout window)
  const recentCutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString();

  const { data: existing } = await supabase
    .from('bookings')
    .select('time_slots, status, payment_status, created_at')
    .eq('turf_id', turfId)
    .eq('date', date)
    .in('status', ['confirmed', 'pending'])
    .neq('payment_status', 'unpaid') // confirmed/partially-paid ones always block
    // NOTE: We also want recent unpaid-pending ones. We handle that below.
    ;

  // Separately fetch recent unpaid-pending (within 15 min checkout window)
  const { data: recentPending } = await supabase
    .from('bookings')
    .select('time_slots, status, payment_status, created_at')
    .eq('turf_id', turfId)
    .eq('date', date)
    .eq('status', 'pending')
    .eq('payment_status', 'unpaid')
    .gte('created_at', recentCutoff);

  const allBlockingBookings = [...(existing || []), ...(recentPending || [])];

  const bookedSlots = new Set();
  allBlockingBookings.forEach((b) => (b.time_slots || []).forEach((s) => bookedSlots.add(s.start)));

  const formatTime = (timeStr) => {
    if (!timeStr) return '';
    const [h, m] = timeStr.split(':');
    const hour = parseInt(h);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hr = hour % 12 || 12;
    return `${hr}:${m} ${ampm}`;
  };

  const conflictSlot = timeSlots.find((s) => bookedSlots.has(s.start));
  if (conflictSlot) {
    return res.status(400).json({
      success: false,
      message: `Slot ${formatTime(conflictSlot.start)} - ${formatTime(conflictSlot.end)} is already booked`,
    });
  }

  // Calculate total: each slot's cost = (durationMinutes / 60) * pricePerHour
  // Supports both 30-min (half) and 60-min (full hour) slots
  // Apply peak pricing if slot falls within peak hours
  const totalAmount = timeSlots.reduce((sum, slot) => {
    const durationHours = (slot.durationMinutes || 60) / 60;

    // Check if slot is in peak hours
    let priceToUse = turf.price_per_hour;
    if (turf.peak_price_per_hour && turf.peak_hour_start && turf.peak_hour_end) {
      const slotStart = slot.start; // e.g., "18:00"
      const peakStart = turf.peak_hour_start; // e.g., "18:00"
      const peakEnd = turf.peak_hour_end; // e.g., "23:00"

      // Time comparison supporting overnight spans (e.g. 18:00 to 07:00)
      if (peakStart > peakEnd) {
        if (slotStart >= peakStart || slotStart < peakEnd) {
          priceToUse = turf.peak_price_per_hour;
        }
      } else {
        if (slotStart >= peakStart && slotStart < peakEnd) {
          priceToUse = turf.peak_price_per_hour;
        }
      }
    }

    return sum + durationHours * priceToUse;
  }, 0);

  // Validate advance amount
  const parsedAdvance = Number(advanceAmount) || 0;
  const validAdvance = Math.max(0, Math.min(parsedAdvance, totalAmount));

  const { data: booking, error } = await supabase
    .from('bookings')
    .insert({
      user_id: req.user.id,
      turf_id: turfId,
      date,
      time_slots: timeSlots,
      player_count: playerCount || 1,
      total_amount: totalAmount,
      advance_amount: validAdvance,
      amount_paid: 0, // Will be updated after payment verification
      payment_status: 'unpaid', // Will be updated after payment
      status: 'pending',
      notes,
    })
    .select()
    .single();

  if (error) throw error;

  const mappedBooking = mapBooking({ ...booking, turf });
  res.status(201).json({ success: true, booking: mappedBooking });
});

// @desc    Abort a pending booking (user dismissed payment)
// @route   DELETE /api/bookings/:id/abort
exports.abortBooking = asyncHandler(async (req, res) => {
  const { data: booking } = await supabase
    .from('bookings')
    .select('id, user_id, status, payment_status')
    .eq('id', req.params.id)
    .single();

  if (!booking) {
    // Already gone — that's fine
    return res.json({ success: true, message: 'Booking not found (already removed)' });
  }

  // Only the owner of this booking can abort it, and only if still pending + unpaid
  if (booking.user_id !== req.user.id) {
    return res.status(403).json({ success: false, message: 'Not authorized' });
  }

  if (booking.status !== 'pending' || booking.payment_status !== 'unpaid') {
    // Already paid / confirmed — do not cancel
    return res.json({ success: true, message: 'Booking already processed, not aborted' });
  }

  await supabase
    .from('bookings')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', req.params.id);

  res.json({ success: true, message: 'Booking aborted' });
});


// @desc    Get user's bookings
// @route   GET /api/bookings/my
exports.getMyBookings = asyncHandler(async (req, res) => {
  const { status, paymentStatus, page = 1, limit = 10 } = req.query;
  let query = supabase
    .from('bookings')
    .select('*, turf:turf_id(id, name, images, price_per_hour, street, city, state)', { count: 'exact' })
    .eq('user_id', req.user.id)
    .order('created_at', { ascending: false });

  if (status) query = query.eq('status', status);
  if (paymentStatus) query = query.eq('payment_status', paymentStatus);

  const skip = (Number(page) - 1) * Number(limit);
  query = query.range(skip, skip + Number(limit) - 1);

  const { data, error, count } = await query;
  if (error) throw error;

  res.json({
    success: true,
    bookings: (data || []).map(mapBooking),
    total: count || 0,
    totalPages: Math.ceil((count || 0) / Number(limit)),
  });
});

// @desc    Get single booking
// @route   GET /api/bookings/:id
exports.getBooking = asyncHandler(async (req, res) => {
  const { data: booking, error } = await supabase
    .from('bookings')
    .select('*, turf:turf_id(id, name, images, price_per_hour, street, city, state, amenities), user:user_id(id, name, email, phone)')
    .eq('id', req.params.id)
    .single();

  if (error || !booking) {
    return res.status(404).json({ success: false, message: 'Booking not found' });
  }

  const userId = booking.user?.id || booking.user_id;
  if (userId !== req.user.id && req.user.role !== 'admin' && req.user.role !== 'turf_owner') {
    return res.status(403).json({ success: false, message: 'Not authorized' });
  }

  res.json({ success: true, booking: mapBooking(booking) });
});

// @desc    Cancel booking (sends refund email to turf owner)
// @route   PUT /api/bookings/:id/cancel
exports.cancelBooking = asyncHandler(async (req, res) => {
  // Fetch full booking + turf + user for email
  const { data: booking, error } = await supabase
    .from('bookings')
    .select('*, turf:turf_id(id, name, owner_email, owner_phone, street, city, state), user:user_id(id, name, email, phone)')
    .eq('id', req.params.id)
    .single();

  if (error || !booking) {
    return res.status(404).json({ success: false, message: 'Booking not found' });
  }

  const userId = booking.user?.id || booking.user_id;
  if (userId !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Not authorized' });
  }

  if (booking.status === 'cancelled') {
    return res.status(400).json({ success: false, message: 'Booking already cancelled' });
  }

  const { data: updated, error: upErr } = await supabase
    .from('bookings')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', req.params.id)
    .select()
    .single();

  if (upErr) throw upErr;

  // Send refund notification email to turf owner (non-blocking)
  sendRefundEmail({ booking, turf: booking.turf, user: booking.user }).catch((err) =>
    console.error('Refund email send error:', err)
  );

  res.json({ success: true, booking: mapBooking(updated) });
});

// @desc    Get all bookings (admin)
// @route   GET /api/bookings/admin/all
exports.getAllBookings = asyncHandler(async (req, res) => {
  const { status, paymentStatus, page = 1, limit = 20 } = req.query;

  let query = supabase
    .from('bookings')
    .select('*, turf:turf_id(id, name, street, city), user:user_id(id, name, email, phone)', { count: 'exact' })
    .order('created_at', { ascending: false });

  if (status) query = query.eq('status', status);
  if (paymentStatus) query = query.eq('payment_status', paymentStatus);

  const skip = (Number(page) - 1) * Number(limit);
  query = query.range(skip, skip + Number(limit) - 1);

  const { data, error, count } = await query;
  if (error) throw error;

  res.json({
    success: true,
    bookings: (data || []).map(mapBooking),
    total: count || 0,
    totalPages: Math.ceil((count || 0) / Number(limit)),
  });
});

// @desc    Get bookings for a specific turf (turf owner)
// @route   GET /api/bookings/turf/:turfId
exports.getTurfBookings = asyncHandler(async (req, res) => {
  const { turfId } = req.params;
  const { status, paymentStatus, date, month, page = 1, limit = 50 } = req.query;

  // Verify ownership
  const { data: turf } = await supabase
    .from('turfs')
    .select('id, owner_id, owner_email')
    .eq('id', turfId)
    .single();

  if (!turf) return res.status(404).json({ success: false, message: 'Turf not found' });

  const isOwner =
    (req.user.role === 'turf_owner' && req.user.email === turf.owner_email) ||
    req.user.id === turf.owner_id ||
    req.user.role === 'admin' ||
    (req.user.role === 'supervisor' && req.supervisor && req.supervisor.turf_id === turfId);

  if (!isOwner) return res.status(403).json({ success: false, message: 'Not authorized' });

  let query = supabase
    .from('bookings')
    .select('*, user:user_id(id, name, email, phone)', { count: 'exact' })
    .eq('turf_id', turfId)
    .order('created_at', { ascending: false });

  if (status) query = query.eq('status', status);
  if (paymentStatus) query = query.eq('payment_status', paymentStatus);
  if (date) query = query.eq('date', date);
  if (month) {
    const [year, mon] = month.split('-');
    const startDate = `${year}-${mon}-01`;
    const endDate = new Date(Number(year), Number(mon), 0).toISOString().split('T')[0];
    query = query.gte('date', startDate).lte('date', endDate);
  }

  const skip = (Number(page) - 1) * Number(limit);
  query = query.range(skip, skip + Number(limit) - 1);

  const { data, error, count } = await query;
  if (error) throw error;

  res.json({
    success: true,
    bookings: (data || []).map(mapBooking),
    total: count || 0,
    totalPages: Math.ceil((count || 0) / Number(limit)),
  });
});

// @desc    Update booking status (turf owner — mark playing, complete)
// @route   PUT /api/bookings/:id/status
exports.updateBookingStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const allowed = ['confirmed', 'completed', 'cancelled'];

  if (!allowed.includes(status)) {
    return res.status(400).json({ success: false, message: 'Invalid status' });
  }

  const { data: booking, error } = await supabase
    .from('bookings')
    .select('*, turf:turf_id(id, owner_id, owner_email)')
    .eq('id', req.params.id)
    .single();

  if (error || !booking) return res.status(404).json({ success: false, message: 'Booking not found' });

  const isOwner =
    (req.user.role === 'turf_owner' && req.user.email === booking.turf?.owner_email) ||
    req.user.id === booking.turf?.owner_id ||
    req.user.role === 'admin';

  if (!isOwner) return res.status(403).json({ success: false, message: 'Not authorized' });

  const { data: updated, error: upErr } = await supabase
    .from('bookings')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', req.params.id)
    .select()
    .single();

  if (upErr) throw upErr;
  res.json({ success: true, booking: mapBooking(updated) });
});

// @desc    Record remaining payment collected offline
// @route   PUT /api/bookings/:id/collect-payment
exports.collectRemainingPayment = asyncHandler(async (req, res) => {
  const { amountCollected } = req.body;

  const { data: booking, error } = await supabase
    .from('bookings')
    .select('*, turf:turf_id(id, owner_id, owner_email)')
    .eq('id', req.params.id)
    .single();

  if (error || !booking) return res.status(404).json({ success: false, message: 'Booking not found' });

  const isOwner =
    (req.user.role === 'turf_owner' && req.user.email === booking.turf?.owner_email) ||
    req.user.id === booking.turf?.owner_id ||
    req.user.role === 'admin';

  if (!isOwner) return res.status(403).json({ success: false, message: 'Not authorized' });

  const newAmountPaid = Math.min(
    Number(booking.amount_paid || 0) + Number(amountCollected || 0),
    Number(booking.total_amount)
  );
  const newPaymentStatus = newAmountPaid >= booking.total_amount ? 'paid' : 'partially_paid';

  const { data: updated, error: upErr } = await supabase
    .from('bookings')
    .update({
      amount_paid: newAmountPaid,
      payment_status: newPaymentStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('id', req.params.id)
    .select()
    .single();

  if (upErr) throw upErr;
  res.json({ success: true, booking: mapBooking(updated) });
});
