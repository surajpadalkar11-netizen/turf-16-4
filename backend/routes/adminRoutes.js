const express = require('express');
const router = express.Router();
const {
  getStats,
  getUsers,
  updateUserRole,
  deleteUser,
  updateBookingStatus,
  getReviews,
  deleteReview,
  processRefund,
} = require('../controllers/adminController');
const { protect, adminOnly } = require('../middleware/auth');

// All admin routes require authentication + admin role
router.use(protect, adminOnly);

router.get('/stats', getStats);
router.get('/users', getUsers);
router.put('/users/:id/role', updateUserRole);
router.delete('/users/:id', deleteUser);
router.put('/bookings/:id/status', updateBookingStatus);
router.put('/bookings/:id/refund', processRefund);
router.get('/reviews', getReviews);
router.delete('/reviews/:id', deleteReview);

module.exports = router;
