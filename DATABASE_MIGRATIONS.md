# Database Migration Instructions

Run these SQL migrations in your Supabase SQL editor in the following order:

## 1. Wallet System (add_wallet.sql)
```sql
-- Add wallet_balance column to users
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS wallet_balance NUMERIC NOT NULL DEFAULT 0;

-- Create wallet_transactions table
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        TEXT NOT NULL CHECK (type IN ('credit', 'debit')),
  amount      NUMERIC NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  reference   TEXT DEFAULT '',
  balance_after NUMERIC NOT NULL DEFAULT 0,
  status      TEXT DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed')),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wallet_user ON wallet_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_created ON wallet_transactions(user_id, created_at DESC);

-- Add payment_method column to bookings
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'online' 
    CHECK (payment_method IN ('online', 'wallet', 'cash', 'mixed'));

-- Add wallet_amount_used to bookings
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS wallet_amount_used NUMERIC NOT NULL DEFAULT 0;
```

## 2. Admin Settings (add_admin_settings.sql)
```sql
-- Create admin_settings table
CREATE TABLE IF NOT EXISTS admin_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  razorpay_key_id TEXT,
  razorpay_key_secret TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES users(id)
);

-- Insert default row
INSERT INTO admin_settings (id) VALUES ('00000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;
```

## 3. Payout Tracking (add_payout_tracking.sql)
```sql
-- Add payout tracking fields to bookings
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS payout_status TEXT DEFAULT 'pending'
    CHECK (payout_status IN ('pending', 'completed', 'failed'));

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS payout_amount NUMERIC DEFAULT 0;

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS payout_date TIMESTAMPTZ;

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS payout_processed_by UUID REFERENCES users(id);

-- Create index for faster payout queries
CREATE INDEX IF NOT EXISTS idx_bookings_payout ON bookings(payout_status, wallet_amount_used);
```

## After Running Migrations

1. **Configure Razorpay Keys**
   - Log in to turf-admin panel
   - Go to Settings page
   - Enter your Razorpay Key ID and Secret
   - Save settings

2. **Test Wallet Flow**
   - User adds money to wallet
   - User books turf using wallet
   - Admin views payout in Payouts page
   - Admin processes payout

## Environment Variables

Make sure these are set in your backend `.env`:
```
GMAIL_USER=your-email@gmail.com
GMAIL_PASS=your-16-char-app-password
```

## Notes
- Razorpay keys are stored in `admin_settings` table
- Email notifications are sent for all wallet transactions
- Payouts are tracked but processed manually (Razorpay Payouts API can be integrated later)
