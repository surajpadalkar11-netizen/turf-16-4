-- ===================================================
-- TurfBook – Supabase Schema
-- Run this in your Supabase SQL editor (Dashboard → SQL)
-- ===================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- USERS
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name         TEXT NOT NULL,
  email        TEXT NOT NULL UNIQUE,
  password     TEXT NOT NULL,
  phone        TEXT,
  role         TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin')),
  avatar       TEXT DEFAULT '',
  favorites    UUID[] DEFAULT '{}',
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TURFS
-- ============================================================
CREATE TABLE IF NOT EXISTS turfs (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                TEXT NOT NULL,
  description         TEXT NOT NULL,
  sport_types         TEXT[] NOT NULL DEFAULT '{}',
  surface_type        TEXT NOT NULL,
  lat                 FLOAT8 DEFAULT 0,
  lng                 FLOAT8 DEFAULT 0,
  street              TEXT NOT NULL,
  city                TEXT NOT NULL,
  state               TEXT NOT NULL,
  pincode             TEXT NOT NULL,
  images              TEXT[] DEFAULT '{}',
  price_per_hour      NUMERIC NOT NULL,
  amenities           TEXT[] DEFAULT '{}',
  dim_length          FLOAT8,
  dim_width           FLOAT8,
  operating_open      TEXT DEFAULT '06:00',
  operating_close     TEXT DEFAULT '23:00',
  rating_average      FLOAT8 DEFAULT 0,
  rating_count        INTEGER DEFAULT 0,
  owner_id            UUID REFERENCES users(id) ON DELETE SET NULL,
  owner_phone         TEXT,
  owner_email         TEXT,
  razorpay_key_id     TEXT,
  razorpay_key_secret TEXT,
  is_active           BOOLEAN DEFAULT TRUE,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Index for city search
CREATE INDEX IF NOT EXISTS idx_turfs_city ON turfs(city);
CREATE INDEX IF NOT EXISTS idx_turfs_active ON turfs(is_active);
CREATE INDEX IF NOT EXISTS idx_turfs_rating ON turfs(rating_average DESC);

-- ============================================================
-- BOOKINGS
-- ============================================================
CREATE TABLE IF NOT EXISTS bookings (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  turf_id       UUID NOT NULL REFERENCES turfs(id) ON DELETE CASCADE,
  date          DATE NOT NULL,
  time_slots    JSONB NOT NULL DEFAULT '[]',
  player_count  INTEGER DEFAULT 1,
  total_amount  NUMERIC NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','cancelled','completed')),
  payment_id    UUID,
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bookings_user ON bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_turf ON bookings(turf_id);
CREATE INDEX IF NOT EXISTS idx_bookings_date ON bookings(turf_id, date);

-- ============================================================
-- REVIEWS
-- ============================================================
CREATE TABLE IF NOT EXISTS reviews (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  turf_id    UUID NOT NULL REFERENCES turfs(id) ON DELETE CASCADE,
  rating     INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment    TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, turf_id)
);

CREATE INDEX IF NOT EXISTS idx_reviews_turf ON reviews(turf_id);

-- ============================================================
-- PAYMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS payments (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id          UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  razorpay_order_id   TEXT NOT NULL,
  razorpay_payment_id TEXT DEFAULT '',
  razorpay_signature  TEXT DEFAULT '',
  amount              NUMERIC NOT NULL,
  currency            TEXT DEFAULT 'INR',
  status              TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created','paid','failed','refunded')),
  method              TEXT DEFAULT '',
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- FUNCTION: recalculate turf rating after review changes
-- ============================================================
CREATE OR REPLACE FUNCTION recalculate_turf_rating(p_turf_id UUID)
RETURNS VOID AS $$
DECLARE
  v_avg   FLOAT8;
  v_count INTEGER;
BEGIN
  SELECT AVG(rating), COUNT(*) INTO v_avg, v_count
  FROM reviews WHERE turf_id = p_turf_id;

  UPDATE turfs
  SET rating_average = COALESCE(ROUND(v_avg::NUMERIC, 1), 0),
      rating_count   = COALESCE(v_count, 0),
      updated_at     = NOW()
  WHERE id = p_turf_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- FUNCTION: nearby turfs (lat/lng radius search)
-- ============================================================
CREATE OR REPLACE FUNCTION nearby_turfs(
  user_lat   FLOAT8,
  user_lng   FLOAT8,
  radius_m   FLOAT8
)
RETURNS SETOF turfs AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM turfs
  WHERE is_active = TRUE
    AND (
      6371000 * acos(
        cos(radians(user_lat)) * cos(radians(lat)) *
        cos(radians(lng) - radians(user_lng)) +
        sin(radians(user_lat)) * sin(radians(lat))
      )
    ) <= radius_m
  ORDER BY (
    6371000 * acos(
      cos(radians(user_lat)) * cos(radians(lat)) *
      cos(radians(lng) - radians(user_lng)) +
      sin(radians(user_lat)) * sin(radians(lat))
    )
  ) ASC;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- Supabase Storage: create 'turf-images' bucket
-- (run separately in Dashboard → Storage, or via this SQL)
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('turf-images', 'turf-images', TRUE)
ON CONFLICT DO NOTHING;

-- Allow public read
CREATE POLICY IF NOT EXISTS "Public read turf-images"
ON storage.objects FOR SELECT
USING (bucket_id = 'turf-images');

-- Allow authenticated upload
CREATE POLICY IF NOT EXISTS "Auth upload turf-images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'turf-images');
