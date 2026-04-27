const express = require('express');
const router = express.Router();
const {
  turfOwnerLogin,
  getOwnerTurfs,
  getTurfStats,
  getTurfSlots,
  verifyBookingCode,
  toggleTurfStatus,
  toggleSlotBlock,
  updateTurfPricing,
  updateTurfDetails,
} = require('../controllers/turfOwnerController');
const {
  getTurfBookings,
  updateBookingStatus,
  collectRemainingPayment,
} = require('../controllers/bookingController');
const {
  createSupervisor,
  getSupervisors,
  deleteSupervisor,
  toggleSupervisor,
  getSupervisorBookings,
  getSupervisorTurfInfo,
} = require('../controllers/supervisorController');
const { protect, ownerOnly, supervisorProtect } = require('../middleware/auth');

// ── Public ─────────────────────────────────────────────────────────────────
router.post('/login', turfOwnerLogin);

// ── Supervisor read-only routes (supervisor OR owner can access) ────────────
router.get('/supervisor/bookings', protect, getSupervisorBookings);
router.get('/supervisor/turf-info', protect, supervisorProtect, getSupervisorTurfInfo);

// ── Owner CRUD: Supervisors (owner-only — supervisors blocked) ──────────────
router.post('/supervisors', protect, ownerOnly, createSupervisor);
router.get('/supervisors/:turfId', protect, ownerOnly, getSupervisors);
router.delete('/supervisors/:supervisorId', protect, ownerOnly, deleteSupervisor);
router.put('/supervisors/:supervisorId/toggle', protect, ownerOnly, toggleSupervisor);

// ── Owner protected routes (supervisors blocked from write) ────────────────
router.get('/turfs', protect, getOwnerTurfs);
router.get('/stats/:turfId', protect, getTurfStats);
router.get('/slots/:turfId', protect, getTurfSlots);
router.post('/slots/:turfId/toggle-block', protect, ownerOnly, toggleSlotBlock);
router.put('/turf/:turfId/toggle-status', protect, ownerOnly, toggleTurfStatus);
router.put('/turf/:turfId/pricing', protect, ownerOnly, updateTurfPricing);
router.put('/turf/:turfId', protect, ownerOnly, updateTurfDetails);
router.post('/verify-booking', protect, verifyBookingCode);

// ── Bookings under turf ────────────────────────────────────────────────────
router.get('/bookings/:turfId', protect, getTurfBookings);
router.put('/booking/:id/status', protect, ownerOnly, updateBookingStatus);
router.put('/booking/:id/collect', protect, ownerOnly, collectRemainingPayment);

module.exports = router;
