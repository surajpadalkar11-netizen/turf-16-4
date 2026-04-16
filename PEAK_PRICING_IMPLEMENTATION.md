# Peak Hour Pricing Implementation

## Overview
Dynamic pricing feature that allows turfs to charge higher rates during peak hours (typically after 6 PM) to account for electricity costs for floodlights.

## Changes Made

### 1. Database Schema
**File:** `backend/schema.sql`
- Added `peak_hour_start` (TEXT, default '18:00')
- Added `peak_hour_end` (TEXT, default '23:00')
- Added `peak_price_per_hour` (NUMERIC, nullable)

**Migration File:** `backend/migrations/add_peak_pricing.sql`
- Run this SQL in Supabase to add columns to existing database

### 2. Backend Changes

#### `backend/controllers/turfController.js`
- Updated `mapTurf()` to include peak pricing fields
- Modified `createTurf()` to accept and save peak pricing data
- Modified `updateTurf()` to handle peak pricing updates

#### `backend/controllers/bookingController.js`
- Updated `createBooking()` to fetch peak pricing fields from turf
- Added logic to calculate slot prices based on time:
  - If slot falls within peak hours → use `peak_price_per_hour`
  - Otherwise → use regular `price_per_hour`

### 3. Admin Panel Changes

#### `admin/src/pages/Turfs/Turfs.jsx`
- Added peak pricing fields to form state:
  - `peakHourStart` (default: '18:00')
  - `peakHourEnd` (default: '23:00')
  - `peakPricePerHour` (optional)
- Added UI inputs for peak hour configuration
- Updated form submission to include peak pricing data

### 4. Frontend Client Changes

#### `frontend/src/pages/TurfDetail/TurfDetail.jsx`
- Display peak pricing information in turf details
- Show peak price per hour and half-hour rates
- Show peak hours time range
- Pass peak pricing props to SlotPicker component

#### `frontend/src/components/SlotPicker/SlotPicker.jsx`
- Added `isSlotInPeakHours()` function to check if slot is in peak time
- Display "⚡ Peak" badge on peak hour slots
- Calculate correct price for each slot (regular or peak)
- Pass correct price to booking context when slot is selected

#### `frontend/src/components/SlotPicker/SlotPicker.module.css`
- Added `.peakTag` styling (amber/orange color)
- Added `.peak` slot styling with amber border
- Added hover and selected states for peak slots

#### `frontend/src/context/BookingContext.jsx`
- Already correctly handles dynamic pricing
- `toggleSlot()` receives the correct price per slot from SlotPicker

## How It Works

1. **Admin creates/edits turf:**
   - Sets regular price (e.g., ₹1500/hr)
   - Sets peak hours (e.g., 18:00 - 23:00)
   - Sets peak price (e.g., ₹2000/hr)

2. **User views turf:**
   - Sees both regular and peak pricing displayed
   - Sees peak hours time range

3. **User selects slots:**
   - Slots within peak hours show "⚡ Peak" badge
   - Slots display correct price (regular or peak)
   - Slots have amber styling for peak hours

4. **Booking calculation:**
   - Each slot is priced individually based on its time
   - Total amount reflects mix of regular and peak slots
   - Backend validates and applies same pricing logic

## Database Migration

Run this in Supabase SQL Editor:

```sql
ALTER TABLE turfs
ADD COLUMN IF NOT EXISTS peak_hour_start TEXT DEFAULT '18:00',
ADD COLUMN IF NOT EXISTS peak_hour_end TEXT DEFAULT '23:00',
ADD COLUMN IF NOT EXISTS peak_price_per_hour NUMERIC;
```

## Testing Checklist

- [ ] Run database migration in Supabase
- [ ] Create/edit turf with peak pricing in admin panel
- [ ] View turf detail page - verify peak pricing is displayed
- [ ] Select slots during peak hours - verify "Peak" badge appears
- [ ] Select mix of regular and peak slots - verify correct total
- [ ] Complete booking - verify backend calculates correct amount
- [ ] Check booking confirmation shows correct pricing

## Notes

- If `peak_price_per_hour` is NULL, regular pricing is used for all hours
- Peak hours use 24-hour format (e.g., "18:00" for 6 PM)
- Pricing is calculated per slot, supporting both 30-min and 60-min slots
- Visual indicators (amber color, ⚡ icon) help users identify peak slots
