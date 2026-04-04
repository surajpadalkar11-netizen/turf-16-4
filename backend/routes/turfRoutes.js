const express = require('express');
const router = express.Router();
const {
  getTurfs, getTurf, getAvailableSlots, createTurf, updateTurf, deleteTurf, getFeaturedTurfs, getCities,
} = require('../controllers/turfController');
const { protect, adminOnly } = require('../middleware/auth');

router.get('/featured', getFeaturedTurfs);
router.get('/cities', getCities);
router.get('/', getTurfs);
router.get('/:id', getTurf);
router.get('/:id/slots', getAvailableSlots);

router.post('/', protect, adminOnly, createTurf);
router.put('/:id', protect, adminOnly, updateTurf);
router.delete('/:id', protect, adminOnly, deleteTurf);

module.exports = router;
