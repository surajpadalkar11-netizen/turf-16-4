const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const errorHandler = require('./middleware/errorHandler');
const { apiLimiter } = require('./middleware/rateLimiter');

// Route imports
const authRoutes = require('./routes/authRoutes');
const turfRoutes = require('./routes/turfRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const adminRoutes = require('./routes/adminRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const turfOwnerRoutes = require('./routes/turfOwnerRoutes');

const app = express();

// Compression — reduces API response sizes by 60-80%
app.use(compression({
  level: 6, // balanced speed vs compression ratio
  threshold: 1024, // only compress responses > 1KB
}));

// Security middleware
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({
  origin: [
    process.env.CLIENT_URL || 'http://localhost:5173',
    process.env.ADMIN_URL || 'http://localhost:5174',
    'http://localhost:5175'
  ],
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Only log in development
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

// Rate limiting on API routes
app.use('/api', apiLimiter);

// Cache control helper for read-only endpoints (30s cache)
const cacheShort = (req, res, next) => {
  res.set('Cache-Control', 'public, max-age=30, stale-while-revalidate=60');
  next();
};

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/turfs', cacheShort, turfRoutes); // turfs list can be cached briefly
app.use('/api/bookings', bookingRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/turf-owner', turfOwnerRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'TurfBook API is running',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
  });
});

// 404 handler for unknown API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({ success: false, message: 'API route not found' });
});

// Global error handler
app.use(errorHandler);

const startBookingCron = require('./cron/bookingAutoComplete');

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 TurfBook server running on port ${PORT}`);
  startBookingCron();
});
