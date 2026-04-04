#!/bin/bash

# ===================================================
# Email Review System - Quick Test Script
# ===================================================

echo "🧪 Testing Email Review System..."
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
API_URL="${API_URL:-http://localhost:5000}"

echo "📍 API URL: $API_URL"
echo ""

# Test 1: Check if review endpoints are accessible
echo "Test 1: Checking review endpoints..."
REVIEW_FORM_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/api/reviews/review-form?bookingId=test&userId=test&turfId=test")

if [ "$REVIEW_FORM_STATUS" == "200" ] || [ "$REVIEW_FORM_STATUS" == "400" ]; then
    echo -e "${GREEN}✅ Review form endpoint is accessible${NC}"
else
    echo -e "${RED}❌ Review form endpoint returned: $REVIEW_FORM_STATUS${NC}"
fi

# Test 2: Check if quick review endpoint is accessible
echo ""
echo "Test 2: Checking quick review endpoint..."
QUICK_REVIEW_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/api/reviews/quick?bookingId=test&userId=test&turfId=test&rating=5")

if [ "$QUICK_REVIEW_STATUS" == "200" ] || [ "$QUICK_REVIEW_STATUS" == "400" ]; then
    echo -e "${GREEN}✅ Quick review endpoint is accessible${NC}"
else
    echo -e "${RED}❌ Quick review endpoint returned: $QUICK_REVIEW_STATUS${NC}"
fi

# Test 3: Check backend logs
echo ""
echo "Test 3: Checking backend logs..."
echo -e "${YELLOW}ℹ️  Check your backend console for these log messages:${NC}"
echo "   - 📧 Quick Review Request: { ... }"
echo "   - ✅ Booking verified"
echo "   - ✅ Review created successfully"
echo ""

# Test 4: Manual testing instructions
echo "📋 Manual Testing Steps:"
echo ""
echo "1. Create a test booking:"
echo "   - Go to frontend and book a turf"
echo "   - Note the booking ID"
echo ""
echo "2. Mark booking as completed:"
echo "   - Go to admin panel → Bookings"
echo "   - Change status to 'completed'"
echo "   - Check user's email inbox"
echo ""
echo "3. Test email review:"
echo "   - Click a star in the email"
echo "   - Verify success page appears"
echo "   - Check turf detail page for the review"
echo ""
echo "4. Verify rating update:"
echo "   - Check turf rating box shows correct average"
echo "   - Check review count is updated"
echo ""

# Test 5: Database check
echo "🗄️  Database Verification:"
echo ""
echo "Run these SQL queries in Supabase:"
echo ""
echo "-- Check if migration is needed:"
echo "SELECT column_name, is_nullable, column_default"
echo "FROM information_schema.columns"
echo "WHERE table_name = 'reviews' AND column_name = 'comment';"
echo ""
echo "-- Check recent reviews:"
echo "SELECT r.*, u.name, u.email"
echo "FROM reviews r"
echo "JOIN users u ON r.user_id = u.id"
echo "ORDER BY r.created_at DESC"
echo "LIMIT 5;"
echo ""
echo "-- Check turf ratings:"
echo "SELECT id, name, rating_average, rating_count"
echo "FROM turfs"
echo "WHERE rating_count > 0"
echo "ORDER BY rating_average DESC"
echo "LIMIT 5;"
echo ""

echo "✨ Test script completed!"
echo ""
echo -e "${YELLOW}⚠️  Important:${NC}"
echo "1. Run database migration: backend/migration_update_reviews.sql"
echo "2. Configure Gmail credentials in .env"
echo "3. Set API_URL in .env to your domain"
echo ""
