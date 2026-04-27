-- ============================================================
-- PAYOUT TRACKING FIELDS
-- Run in Supabase SQL editor
-- ============================================================

-- Add payout tracking fields to bookings table
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
