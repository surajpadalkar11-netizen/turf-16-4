-- ============================================================
-- TURF OWNER BANK DETAILS FOR DIRECT PAYOUTS
-- Run in Supabase SQL editor
-- ============================================================

-- Add bank account details to turfs table for direct payouts
ALTER TABLE turfs
  ADD COLUMN IF NOT EXISTS bank_account_name TEXT;

ALTER TABLE turfs
  ADD COLUMN IF NOT EXISTS bank_account_number TEXT;

ALTER TABLE turfs
  ADD COLUMN IF NOT EXISTS bank_ifsc_code TEXT;

ALTER TABLE turfs
  ADD COLUMN IF NOT EXISTS bank_account_type TEXT DEFAULT 'savings'
    CHECK (bank_account_type IN ('savings', 'current'));

-- Add fund_account_id for Razorpay X integration
ALTER TABLE turfs
  ADD COLUMN IF NOT EXISTS razorpay_fund_account_id TEXT;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_turfs_fund_account ON turfs(razorpay_fund_account_id);
