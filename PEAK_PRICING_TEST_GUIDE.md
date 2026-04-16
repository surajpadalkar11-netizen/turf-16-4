# Peak Pricing Test Guide

## Testing the Peak Pricing Feature

### Prerequisites
1. Run the SQL migration in Supabase:
```sql
ALTER TABLE turfs
ADD COLUMN IF NOT EXISTS peak_hour_start TEXT DEFAULT '18:00',
ADD COLUMN IF NOT EXISTS peak_hour_end TEXT DEFAULT '23:00',
ADD COLUMN IF NOT EXISTS peak_price_per_hour NUMERIC;
```

2. Restart your backend server to pick up the schema changes

### Test Steps

#### 1. Create a Turf with Peak Pricing (Admin Panel)
- Login to admin panel
- Create/Edit a turf with:
  - Regular Price: ₹1500/hour
  - Peak Hour Start: 18:00
  - Peak Hour End: 23:00
  - Peak Price: ₹2000/hour
- Save the turf

#### 2. View Turf Details (Client Side)
- Navigate to the turf detail page
- Verify you see:
  - "Price/Hour: ₹1,500/hr"
  - "Peak Price/Hour: ₹2,000/hr" (in amber/orange color)
  - "Peak Hours: 18:00 – 23:00" (in amber/orange color)

#### 3. Select Slots and Check Pricing
- Select a date
- Choose slot duration (1 hour or 30 min)
- Observe the slots:
  - Slots before 18:00 should show regular price (₹1500 or ₹750 for 30min)
  - Slots from 18:00 onwards should have "⚡ Peak" badge and show peak price (₹2000 or ₹1000 for 30min)
  - Peak slots should have amber/orange styling

#### 4. Test Mixed Booking
Select a mix of regular and peak slots:
- Example: 17:00-18:00 (regular ₹1500) + 18:00-19:00 (peak ₹2000)
- Expected total: ₹3,500

Check the booking summary at bottom shows correct total.

#### 5. Proceed to Booking Page
- Click "Proceed to Book"
- On booking page, verify:
  - Peak slots show "⚡" badge with amber background
  - Total amount matches the calculation from previous step

#### 6. Complete Booking
- Complete the payment
- Backend should calculate the same total amount
- Booking should be created successfully

### Expected Results

**Slot Display:**
- Regular slots: Green border, no badge
- Peak slots: Amber border, "⚡ Peak" badge

**Pricing Calculation:**
- 1 hour regular slot = ₹1,500
- 1 hour peak slot = ₹2,000
- 30 min regular slot = ₹750
- 30 min peak slot = ₹1,000

**Total Calculation:**
- Should sum up individual slot prices correctly
- Mix of regular and peak slots should calculate properly

### Debugging

If pricing is not working:

1. **Check browser console** for any errors
2. **Verify turf data** has peak pricing fields:
   ```javascript
   console.log(turf.peakPricePerHour); // Should show 2000
   console.log(turf.peakHourStart); // Should show "18:00"
   console.log(turf.peakHourEnd); // Should show "23:00"
   ```
3. **Check selected slots** have priceUsed stored:
   ```javascript
   console.log(bookingData.selectedSlots);
   // Each slot should have: { start, end, durationMinutes, priceUsed }
   ```
4. **Verify backend** is returning peak pricing fields in turf API response

### Common Issues

**Issue:** Peak slots not showing badge
- **Fix:** Make sure turf has `peakPricePerHour` set (not null)

**Issue:** Total amount is wrong
- **Fix:** Clear browser cache and reload. The BookingContext now stores price with each slot.

**Issue:** Backend calculates different amount
- **Fix:** Ensure backend migration was run and server was restarted
