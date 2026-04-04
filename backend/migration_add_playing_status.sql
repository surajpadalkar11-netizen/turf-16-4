-- ===================================================
-- Migration: Add 'playing' status to bookings table
-- Run this in your Supabase SQL editor (Dashboard → SQL)
-- ===================================================

-- Drop the old check constraint and add one that includes 'playing'
ALTER TABLE bookings
  DROP CONSTRAINT IF EXISTS bookings_status_check;

ALTER TABLE bookings
  ADD CONSTRAINT bookings_status_check
  CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed', 'playing'));
