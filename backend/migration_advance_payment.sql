-- ===================================================
-- Migration: Add Advance Payment Support
-- Run this in Supabase SQL Editor
-- ===================================================

-- Add advance payment columns to bookings
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS advance_amount NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS amount_paid    NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'unpaid'
    CHECK (payment_status IN ('unpaid', 'partially_paid', 'paid'));

-- Add turf_owner role to users
ALTER TABLE users 
  DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE users
  ADD CONSTRAINT users_role_check 
    CHECK (role IN ('user', 'admin', 'turf_owner'));

-- Index for payment_status filtering
CREATE INDEX IF NOT EXISTS idx_bookings_payment_status ON bookings(payment_status);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Update existing confirmed bookings to 'paid' payment_status
UPDATE bookings 
SET payment_status = 'paid', amount_paid = total_amount
WHERE status = 'confirmed' AND payment_status = 'unpaid';
