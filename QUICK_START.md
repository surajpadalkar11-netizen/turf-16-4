# Wallet System - Quick Start Guide

## 🚀 Quick Setup (5 minutes)

### Step 1: Run Database Migrations
Open Supabase SQL Editor and run these files in order:
1. `backend/migrations/add_wallet.sql`
2. `backend/migrations/add_admin_settings.sql`
3. `backend/migrations/add_payout_tracking.sql`

### Step 2: Configure Razorpay
1. Get Razorpay keys from https://dashboard.razorpay.com/
2. Login to turf-admin panel
3. Go to Settings page
4. Enter Key ID and Secret
5. Save

### Step 3: Test It Out
1. User: Go to `/wallet` and add money
2. User: Book a turf using wallet
3. Admin: View payouts in `/payouts`
4. Admin: Process payout

## 📋 What's Included

### Backend (Node.js/Express)
- ✅ Razorpay payment integration
- ✅ Wallet balance management
- ✅ Transaction history tracking
- ✅ Free points system (admin)
- ✅ Email notifications (all transactions)
- ✅ Payout management system
- ✅ Admin settings for Razorpay keys

### Frontend (React)
- ✅ User wallet page (white UI theme)
- ✅ Razorpay checkout integration
- ✅ Transaction history with filters
- ✅ Admin settings page
- ✅ Admin payouts dashboard
- ✅ Fully responsive design

### Database
- ✅ `wallet_transactions` table
- ✅ `admin_settings` table
- ✅ Payout tracking fields in bookings
- ✅ Proper indexes for performance

## 🎯 Key Features

1. **Razorpay Payment Gateway**
   - Secure payment processing
   - Test and live mode support
   - Automatic verification

2. **Free Points System**
   - Admin can credit free points
   - Email notification to users
   - Tracked separately in transactions

3. **Email Notifications**
   - Wallet credited (payment)
   - Wallet credited (free points)
   - Booking paid via wallet (user)
   - Booking paid via wallet (turf owner)

4. **Admin Payout Management**
   - View all wallet-paid bookings
   - Track pending/completed payouts
   - Statistics dashboard
   - Process payouts to turf owners

5. **Clean White UI**
   - Modern, professional design
   - Gradient balance card
   - Transaction history
   - Fully responsive

## 📁 New Files Created

### Backend
- `backend/controllers/walletController.js` - Wallet operations
- `backend/controllers/adminSettingsController.js` - Admin settings
- `backend/controllers/payoutController.js` - Payout management
- `backend/routes/walletRoutes.js` - Wallet routes
- `backend/migrations/add_wallet.sql` - Wallet tables
- `backend/migrations/add_admin_settings.sql` - Settings table
- `backend/migrations/add_payout_tracking.sql` - Payout fields

### Frontend
- `frontend/src/pages/Wallet/Wallet.jsx` - User wallet page
- `frontend/src/pages/Wallet/Wallet.module.css` - Wallet styles
- `frontend/src/services/walletService.js` - Wallet API calls

### Admin Panel
- `turf-admin/src/pages/Settings.jsx` - Admin settings
- `turf-admin/src/pages/Settings.module.css` - Settings styles
- `turf-admin/src/pages/Payouts.jsx` - Payout management
- `turf-admin/src/pages/Payouts.module.css` - Payout styles

## 🔧 Configuration Required

### Backend .env
```env
RAZORPAY_KEY_ID=rzp_test_xxxxx  # Optional fallback
RAZORPAY_KEY_SECRET=xxxxx       # Optional fallback
GMAIL_USER=your-email@gmail.com
GMAIL_PASS=your-16-char-app-password
```

### Admin Settings (via UI)
- Razorpay Key ID (required)
- Razorpay Key Secret (required)

## 📞 Support

For issues or questions:
1. Check `TESTING_GUIDE.md` for common issues
2. Review `DATABASE_MIGRATIONS.md` for setup
3. See `WALLET_IMPLEMENTATION.md` for technical details

## ✨ Next Steps

1. Run database migrations
2. Configure Razorpay keys
3. Test wallet top-up
4. Test booking payment
5. Test admin payout flow
6. Deploy to production

---

**Note:** Use Razorpay test mode for development and live mode for production.
