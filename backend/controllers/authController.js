const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { body } = require('express-validator');
const { OAuth2Client } = require('google-auth-library');
const supabase = require('../config/supabase');
const { asyncHandler } = require('../utils/helpers');
const crypto = require('crypto');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE });

const formatUser = (u) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  phone: u.phone,
  role: u.role,
  avatar: u.avatar,
  walletBalance: Number(u.wallet_balance || 0),
});

// @desc    Register user
// @route   POST /api/auth/register
exports.register = asyncHandler(async (req, res) => {
  const { name, email, password, phone } = req.body;

  const { data: existing } = await supabase.from('users').select('id').eq('email', email.toLowerCase()).single();
  if (existing) {
    return res.status(400).json({ success: false, message: 'Email already registered' });
  }

  const salt = await bcrypt.genSalt(12);
  const hashedPassword = await bcrypt.hash(password, salt);

  const { data: user, error } = await supabase
    .from('users')
    .insert({ name: name.trim(), email: email.toLowerCase().trim(), password: hashedPassword, phone })
    .select('id, name, email, phone, role, avatar, wallet_balance')
    .single();

  if (error) throw error;

  const token = generateToken(user.id);
  res.status(201).json({ success: true, token, user: formatUser(user) });
});

// @desc    Login user
// @route   POST /api/auth/login
exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const { data: user, error } = await supabase
    .from('users')
    .select('id, name, email, phone, role, avatar, wallet_balance, password')
    .eq('email', email.toLowerCase())
    .single();

  if (error || !user) {
    return res.status(401).json({ success: false, message: 'Invalid credentials' });
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    return res.status(401).json({ success: false, message: 'Invalid credentials' });
  }

  const token = generateToken(user.id);
  res.json({ success: true, token, user: formatUser(user) });
});

// @desc    Google Sign-In / Sign-Up
// @route   POST /api/auth/google
exports.googleLogin = asyncHandler(async (req, res) => {
  const { credential } = req.body;
  if (!credential) {
    return res.status(400).json({ success: false, message: 'Google credential is required' });
  }

  // Verify Google token
  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    payload = ticket.getPayload();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid Google token' });
  }

  const { email, name, picture, sub: googleId } = payload;

  // Check if user exists
  const { data: existingUser } = await supabase
    .from('users')
    .select('id, name, email, phone, role, avatar, wallet_balance')
    .eq('email', email.toLowerCase())
    .single();

  if (existingUser) {
    // Update avatar from Google if not set
    if (!existingUser.avatar && picture) {
      await supabase.from('users').update({ avatar: picture, updated_at: new Date().toISOString() }).eq('id', existingUser.id);
      existingUser.avatar = picture;
    }
    const token = generateToken(existingUser.id);
    return res.json({ success: true, token, user: formatUser(existingUser) });
  }

  // Create new user (no password — Google-only account)
  const { data: newUser, error } = await supabase
    .from('users')
    .insert({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: crypto.randomBytes(16).toString('hex'), // Dummy password to satisfy NOT NULL constraint
      avatar: picture || null,
    })
    .select('id, name, email, phone, role, avatar, wallet_balance')
    .single();

  if (error) {
    console.error('Google signup error:', error);
    return res.status(500).json({ success: false, message: 'Failed to create account' });
  }

  const token = generateToken(newUser.id);
  res.status(201).json({ success: true, token, user: formatUser(newUser) });
});

// @desc    Get current user
// @route   GET /api/auth/me
exports.getMe = asyncHandler(async (req, res) => {
  const { data: user, error } = await supabase
    .from('users')
    .select('id, name, email, phone, role, avatar, favorites, wallet_balance')
    .eq('id', req.user.id)
    .single();

  if (error) throw error;

  // Populate favorites
  let favoritesTurfs = [];
  if (user.favorites && user.favorites.length > 0) {
    const { data: favs } = await supabase
      .from('turfs')
      .select('id, name, images, price_per_hour, city, state, street, rating_average, rating_count')
      .in('id', user.favorites);
    favoritesTurfs = favs || [];
  }

  res.json({ success: true, user: { ...user, _id: user.id, walletBalance: Number(user.wallet_balance || 0), favoriteTurfs: favoritesTurfs } });
});

// @desc    Update profile
// @route   PUT /api/auth/profile
exports.updateProfile = asyncHandler(async (req, res) => {
  const { name, phone, avatar } = req.body;
  const updates = { updated_at: new Date().toISOString() };
  if (name) updates.name = name;
  if (phone) updates.phone = phone;
  if (avatar !== undefined) updates.avatar = avatar;

  const { data: user, error } = await supabase
    .from('users')
    .update(updates)
    .eq('id', req.user.id)
    .select('id, name, email, phone, role, avatar, wallet_balance')
    .single();

  if (error) throw error;
  res.json({ success: true, user: formatUser(user) });
});

// @desc    Toggle favorite turf
// @route   PUT /api/auth/favorites/:turfId
exports.toggleFavorite = asyncHandler(async (req, res) => {
  const { turfId } = req.params;

  const { data: user } = await supabase.from('users').select('favorites').eq('id', req.user.id).single();
  let favorites = user.favorites || [];

  const index = favorites.indexOf(turfId);
  if (index > -1) {
    favorites.splice(index, 1);
  } else {
    favorites.push(turfId);
  }

  const { error } = await supabase.from('users').update({ favorites, updated_at: new Date().toISOString() }).eq('id', req.user.id);
  if (error) throw error;

  res.json({ success: true, favorites });
});

// Validation rules
exports.registerValidation = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
];

exports.loginValidation = [
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required'),
];
