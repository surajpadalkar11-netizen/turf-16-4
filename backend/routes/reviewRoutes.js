const express = require('express');
const router = express.Router();
const { getTurfReviews, createReview, deleteReview, quickReview, reviewForm, getMyReviews } = require('../controllers/reviewController');
const { protect } = require('../middleware/auth');

router.get('/review-form', reviewForm);
router.get('/quick', quickReview);
router.get('/my', protect, getMyReviews);
router.get('/turf/:turfId', getTurfReviews);
router.post('/', protect, createReview);
router.delete('/:id', protect, deleteReview);

module.exports = router;
