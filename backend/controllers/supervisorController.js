const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const supabase = require('../config/supabase');
const { asyncHandler } = require('../utils/helpers');

const generateToken = (id, role) =>
  jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE });

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Supervisor login
// @route   POST /api/turf-owner/login  (handled in turfOwnerController, see below)
// ─────────────────────────────────────────────────────────────────────────────

// @desc    Create a supervisor for a turf (owner only)
// @route   POST /api/turf-owner/supervisors
exports.createSupervisor = asyncHandler(async (req, res) => {
  const { turfId, name, email, password } = req.body;

  if (!turfId || !name || !email || !password) {
    return res.status(400).json({ success: false, message: 'turfId, name, email and password are required' });
  }

  // Verify the requesting user owns the turf
  const { data: turf } = await supabase
    .from('turfs')
    .select('id, name, owner_id, owner_email')
    .eq('id', turfId)
    .single();

  if (!turf) return res.status(404).json({ success: false, message: 'Turf not found' });

  const isOwner =
    req.user.id === turf.owner_id ||
    req.user.email === turf.owner_email ||
    req.user.role === 'admin';

  if (!isOwner) return res.status(403).json({ success: false, message: 'Not authorized' });

  // Check if email already in use (in supervisors or users)
  const { data: existingSup } = await supabase
    .from('supervisors')
    .select('id')
    .eq('email', email.trim().toLowerCase())
    .single();

  if (existingSup) {
    return res.status(400).json({ success: false, message: 'A supervisor with this email already exists' });
  }

  const salt = await bcrypt.genSalt(12);
  const hashedPassword = await bcrypt.hash(password, salt);

  const { data: supervisor, error } = await supabase
    .from('supervisors')
    .insert({
      turf_id: turfId,
      created_by: req.user.id,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password: hashedPassword,
      is_active: true,
    })
    .select('id, turf_id, name, email, is_active, created_at')
    .single();

  if (error) throw error;

  res.status(201).json({ success: true, supervisor });
});

// @desc    List supervisors for a turf (owner only)
// @route   GET /api/turf-owner/supervisors/:turfId
exports.getSupervisors = asyncHandler(async (req, res) => {
  const { turfId } = req.params;

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

  const { data: supervisors, error } = await supabase
    .from('supervisors')
    .select('id, turf_id, name, email, is_active, created_at')
    .eq('turf_id', turfId)
    .order('created_at', { ascending: false });

  if (error) throw error;

  res.json({ success: true, supervisors: supervisors || [] });
});

// @desc    Delete (or deactivate) a supervisor (owner only)
// @route   DELETE /api/turf-owner/supervisors/:supervisorId
exports.deleteSupervisor = asyncHandler(async (req, res) => {
  const { supervisorId } = req.params;

  const { data: supervisor } = await supabase
    .from('supervisors')
    .select('id, turf_id, turf:turf_id(owner_id, owner_email)')
    .eq('id', supervisorId)
    .single();

  if (!supervisor) return res.status(404).json({ success: false, message: 'Supervisor not found' });

  const isOwner =
    req.user.id === supervisor.turf?.owner_id ||
    req.user.email === supervisor.turf?.owner_email ||
    req.user.role === 'admin';

  if (!isOwner) return res.status(403).json({ success: false, message: 'Not authorized' });

  const { error } = await supabase.from('supervisors').delete().eq('id', supervisorId);
  if (error) throw error;

  res.json({ success: true, message: 'Supervisor removed' });
});

// @desc    Toggle supervisor active status (owner only)
// @route   PUT /api/turf-owner/supervisors/:supervisorId/toggle
exports.toggleSupervisor = asyncHandler(async (req, res) => {
  const { supervisorId } = req.params;

  const { data: supervisor } = await supabase
    .from('supervisors')
    .select('id, is_active, turf_id, turf:turf_id(owner_id, owner_email)')
    .eq('id', supervisorId)
    .single();

  if (!supervisor) return res.status(404).json({ success: false, message: 'Supervisor not found' });

  const isOwner =
    req.user.id === supervisor.turf?.owner_id ||
    req.user.email === supervisor.turf?.owner_email ||
    req.user.role === 'admin';

  if (!isOwner) return res.status(403).json({ success: false, message: 'Not authorized' });

  const { data: updated, error } = await supabase
    .from('supervisors')
    .update({ is_active: !supervisor.is_active, updated_at: new Date().toISOString() })
    .eq('id', supervisorId)
    .select('id, is_active')
    .single();

  if (error) throw error;

  res.json({ success: true, is_active: updated.is_active });
});

// @desc    Get supervisor's today bookings (read-only)
// @route   GET /api/turf-owner/supervisor/bookings?date=YYYY-MM-DD
exports.getSupervisorBookings = asyncHandler(async (req, res) => {
  // req.supervisor is set by supervisorProtect middleware
  const { turfId, date } = req.query;
  const targetTurfId = turfId || req.supervisor.turf_id;
  const targetDate = date || new Date().toISOString().split('T')[0];

  // Make sure supervisor only sees their assigned turf
  if (targetTurfId !== req.supervisor.turf_id) {
    return res.status(403).json({ success: false, message: 'Not authorized for this turf' });
  }

  const { data: bookingsData, error } = await supabase
    .from('bookings')
    .select('*, user:user_id(id, name, email, phone)')
    .eq('turf_id', targetTurfId)
    .eq('date', targetDate)
    .neq('status', 'cancelled')
    .order('created_at', { ascending: false });

  if (error) throw error;

  const bookings = (bookingsData || [])
    .filter((b) => b.notes !== 'Blocked by Admin')
    .map((b) => ({
      id: b.id,
      bookingCode: `TRF-${b.id.substring(0, 5).toUpperCase()}`,
      date: b.date,
      timeSlots: b.time_slots,
      status: b.status,
      paymentStatus: b.payment_status,
      totalAmount: b.total_amount,
      amountPaid: b.amount_paid || 0,
      remainingAmount: (b.total_amount || 0) - (b.amount_paid || 0),
      user: b.user,
      playerCount: b.player_count,
    }));

  res.json({ success: true, bookings, date: targetDate });
});

// @desc    Get turf info for supervisor
// @route   GET /api/turf-owner/supervisor/turf-info
exports.getSupervisorTurfInfo = asyncHandler(async (req, res) => {
  const { data: turf, error } = await supabase
    .from('turfs')
    .select('id, name, city, state, street, is_active, operating_open, operating_close, price_per_hour, images')
    .eq('id', req.supervisor.turf_id)
    .single();

  if (error || !turf) return res.status(404).json({ success: false, message: 'Turf not found' });

  res.json({ success: true, turf });
});
