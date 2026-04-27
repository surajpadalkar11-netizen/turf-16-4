-- ============================================================
-- ADMIN SETTINGS TABLE
-- Run in Supabase SQL editor
-- ============================================================

-- Create admin_settings table (single row for global settings)
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

-- Add status field to wallet_transactions for pending payments
ALTER TABLE wallet_transactions
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'completed'
    CHECK (status IN ('pending', 'completed', 'failed'));
