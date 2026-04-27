-- ============================================================
-- WALLET SYSTEM MIGRATION
-- Run in Supabase SQL editor
-- ============================================================

-- 1. Add wallet_balance column to users
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS wallet_balance NUMERIC NOT NULL DEFAULT 0;

-- 2. Create wallet_transactions table
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        TEXT NOT NULL CHECK (type IN ('credit', 'debit')),
  amount      NUMERIC NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  reference   TEXT DEFAULT '',   -- booking_id or payment_id for traceability
  balance_after NUMERIC NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wallet_user ON wallet_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_created ON wallet_transactions(user_id, created_at DESC);

-- 3. Add payment_method column to bookings to know if wallet was used
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'online' 
    CHECK (payment_method IN ('online', 'wallet', 'cash', 'mixed'));

-- 4. Add wallet_amount_used to bookings to track how much wallet was used
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS wallet_amount_used NUMERIC NOT NULL DEFAULT 0;
