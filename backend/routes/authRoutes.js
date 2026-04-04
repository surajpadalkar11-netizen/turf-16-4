const express = require('express');
const router = express.Router();
const { register, login, googleLogin, getMe, updateProfile, toggleFavorite, registerValidation, loginValidation } = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiter');
const validate = require('../middleware/validate');

router.post('/register', authLimiter, registerValidation, validate, register);
router.post('/login', authLimiter, loginValidation, validate, login);
router.post('/google', authLimiter, googleLogin);
router.get('/me', protect, getMe);
router.put('/profile', protect, updateProfile);
router.put('/favorites/:turfId', protect, toggleFavorite);

module.exports = router;
