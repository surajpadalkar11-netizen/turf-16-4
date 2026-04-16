-- Add peak hour pricing columns to turfs table
ALTER TABLE turfs
ADD COLUMN IF NOT EXISTS peak_hour_start TEXT DEFAULT '18:00',
ADD COLUMN IF NOT EXISTS peak_hour_end TEXT DEFAULT '23:00',
ADD COLUMN IF NOT EXISTS peak_price_per_hour NUMERIC;

-- Add comment for documentation
COMMENT ON COLUMN turfs.peak_hour_start IS 'Start time for peak hour pricing (e.g., 18:00 for 6 PM)';
COMMENT ON COLUMN turfs.peak_hour_end IS 'End time for peak hour pricing (e.g., 23:00 for 11 PM)';
COMMENT ON COLUMN turfs.peak_price_per_hour IS 'Price per hour during peak hours (if null, uses regular price)';
