const express = require('express');
const router = express.Router();
const {
  turfOwnerLogin,
  getOwnerTurfs,
  getTurfStats,
  getTurfSlots,
  verifyBookingCode,
} = require('../controllers/turfOwnerController');
const {
  getTurfBookings,
  updateBookingStatus,
  collectRemainingPayment,
} = require('../controllers/bookingController');
const { protect } = require('../middleware/auth');

// Public: Turf owner login
router.post('/login', turfOwnerLogin);

// Protected: all require auth
router.get('/turfs', protect, getOwnerTurfs);
router.get('/stats/:turfId', protect, getTurfStats);
router.get('/slots/:turfId', protect, getTurfSlots);
router.post('/verify-booking', protect, verifyBookingCode);

// Bookings under turf
router.get('/bookings/:turfId', protect, getTurfBookings);
router.put('/booking/:id/status', protect, updateBookingStatus);
router.put('/booking/:id/collect', protect, collectRemainingPayment);

module.exports = router;
