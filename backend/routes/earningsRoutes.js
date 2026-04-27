const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  getEarningsSummary,
  getEarningsTransactions,
} = require('../controllers/earningsController');

router.use(protect);

// Check if user is turf owner
const turfOwnerOnly = (req, res, next) => {
  if (req.user && req.user.role === 'turf_owner') {
    next();
  } else {
    return res.status(403).json({ success: false, message: 'Turf owner access required' });
  }
};

router.use(turfOwnerOnly);

router.get('/summary', getEarningsSummary);
router.get('/transactions', getEarningsTransactions);

module.exports = router;
