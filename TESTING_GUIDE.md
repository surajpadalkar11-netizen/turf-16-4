# Wallet System Testing Guide

## Prerequisites
1. Run all database migrations (see DATABASE_MIGRATIONS.md)
2. Configure Razorpay keys in admin settings
3. Set up Gmail credentials in backend .env

## Testing Checklist

### 1. User Wallet Top-up (Razorpay Payment)
- [ ] Navigate to `/wallet` page
- [ ] Click quick amount button (e.g., ₹500)
- [ ] Click "Add to Wallet"
- [ ] Razorpay checkout modal opens
- [ ] Complete test payment (use Razorpay test cards)
- [ ] Success message appears
- [ ] Balance updates immediately
- [ ] Transaction appears in history
- [ ] Email received with payment confirmation

**Test Cards (Razorpay Test Mode):**
- Success: 4111 1111 1111 1111
- CVV: Any 3 digits
- Expiry: Any future date

### 2. Admin Free Points Credit
- [ ] Login as admin
- [ ] Get a user ID from database
- [ ] Use API endpoint: `POST /api/wallet/admin-credit`
```json
{
  "userId": "user-uuid-here",
  "amount": 100,
  "description": "Welcome bonus"
}
```
- [ ] User receives email notification
- [ ] User's wallet balance increases
- [ ] Transaction shows "Free points by admin"

### 3. Booking Payment via Wallet
- [ ] User has wallet balance
- [ ] Create a booking
- [ ] Select "Pay with Wallet" option
- [ ] Wallet balance deducted
- [ ] Booking status changes to "confirmed"
- [ ] User receives email with remaining balance
- [ ] Turf owner receives email about wallet booking

### 4. Admin Settings Page
- [ ] Login to turf-admin panel
- [ ] Navigate to `/settings`
- [ ] Enter Razorpay Key ID (starts with rzp_)
- [ ] Enter Razorpay Key Secret
- [ ] Click "Save Settings"
- [ ] Success message appears
- [ ] Settings persisted in database

### 5. Admin Payout Management
- [ ] Navigate to `/payouts` in admin panel
- [ ] View statistics dashboard
  - Total bookings count
  - Pending payouts amount
  - Completed payouts amount
- [ ] Filter by status (All/Pending/Completed)
- [ ] Click "Pay Now" on pending booking
- [ ] Confirm payout
- [ ] Status changes to "Completed"
- [ ] Payout date recorded

### 6. Email Notifications
Check that emails are sent for:
- [ ] Wallet credited (Razorpay payment)
- [ ] Wallet credited (free points)
- [ ] Booking paid via wallet (to user)
- [ ] Booking paid via wallet (to turf owner)

### 7. UI/UX Testing
- [ ] Wallet page has white theme (not dark)
- [ ] Balance card displays correctly
- [ ] Quick amount buttons work
- [ ] Custom amount input works
- [ ] Transaction history filters work
- [ ] Responsive on mobile devices
- [ ] Loading states show properly
- [ ] Error messages display correctly

### 8. Edge Cases
- [ ] Try adding ₹0 (should fail)
- [ ] Try adding ₹100001 (should fail - max is ₹100000)
- [ ] Try paying booking with insufficient balance
- [ ] Cancel Razorpay payment modal
- [ ] Process payout twice (should prevent duplicate)
- [ ] View wallet with no transactions

## API Endpoints Reference

### User Endpoints
- `GET /api/wallet` - Get wallet balance and transactions
- `POST /api/wallet/create-order` - Create Razorpay order
- `POST /api/wallet/verify-payment` - Verify payment
- `POST /api/wallet/pay-booking` - Pay booking with wallet

### Admin Endpoints
- `POST /api/wallet/admin-credit` - Credit free points
- `GET /api/wallet/admin/user/:userId` - Get user wallet
- `GET /api/admin/settings` - Get admin settings
- `PUT /api/admin/settings` - Update admin settings
- `GET /api/admin/payouts` - Get wallet bookings
- `GET /api/admin/payouts/stats` - Get payout statistics
- `POST /api/admin/payouts/:bookingId` - Process payout

## Common Issues & Solutions

### Issue: Razorpay checkout not opening
- Check if Razorpay script loaded (check browser console)
- Verify Razorpay keys are configured in admin settings
- Check browser popup blocker

### Issue: Email not sending
- Verify GMAIL_USER and GMAIL_PASS in .env
- Use Gmail App Password (not regular password)
- Check backend logs for email errors

### Issue: Payment verification fails
- Check Razorpay signature verification
- Ensure correct Razorpay secret is used
- Check backend logs for detailed error

### Issue: Wallet balance not updating
- Check database transaction logs
- Verify wallet_transactions table has entries
- Check for database constraint violations

## Success Criteria
✅ All checklist items pass
✅ No console errors
✅ Emails received for all transactions
✅ UI is responsive and matches white theme
✅ Database records are accurate
✅ Payout tracking works correctly
