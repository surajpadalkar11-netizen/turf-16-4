const express = require('express');
const router = express.Router();
const {
  createBooking,
  getMyBookings,
  getBooking,
  cancelBooking,
  getAllBookings,
  getTurfBookings,
  updateBookingStatus,
  collectRemainingPayment,
  abortBooking,
} = require('../controllers/bookingController');
const { protect, adminOnly } = require('../middleware/auth');

router.post('/', protect, createBooking);
router.get('/my', protect, getMyBookings);
router.get('/admin/all', protect, adminOnly, getAllBookings);
router.get('/turf/:turfId', protect, getTurfBookings);
router.get('/:id', protect, getBooking);
router.put('/:id/cancel', protect, cancelBooking);
router.delete('/:id/abort', protect, abortBooking);
router.put('/:id/status', protect, updateBookingStatus);
router.put('/:id/collect', protect, collectRemainingPayment);

module.exports = router;
