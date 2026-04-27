const express = require('express');
const router = express.Router();
const {
  getWallet,
  createWalletOrder,
  verifyWalletPayment,
  adminCreditWallet,
  payBookingWithWallet,
  getAdminUserWallet,
} = require('../controllers/walletController');
const { protect, adminOnly } = require('../middleware/auth');

// User routes (authenticated)
router.get('/', protect, getWallet);
router.post('/create-order', protect, createWalletOrder);
router.post('/verify-payment', protect, verifyWalletPayment);
router.post('/pay-booking', protect, payBookingWithWallet);

// Admin routes
router.post('/admin-credit', protect, adminOnly, adminCreditWallet);
router.get('/admin/user/:userId', protect, adminOnly, getAdminUserWallet);

module.exports = router;
