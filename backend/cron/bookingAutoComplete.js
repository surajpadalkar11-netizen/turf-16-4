const cron = require('node-cron');
const supabase = require('../config/supabase');
const sendEmail = require('../utils/sendEmail');

/**
 * Automatically updates booking statuses based on slot timings:
 *   - confirmed → playing   (when current time is within the slot window)
 *   - confirmed/playing → completed (when the slot end time has passed)
 *
 * Also sends a review-request email to the user once a booking is completed.
 *
 * Runs every minute.
 */

function startBookingCron() {
  // Runs every minute
  cron.schedule('* * * * *', async () => {
    try {
      // Current time in IST
      const now = new Date();
      const istOffset = 5.5 * 60 * 60 * 1000; // IST is UTC+5:30
      const istNow = new Date(now.getTime() + istOffset + now.getTimezoneOffset() * 60 * 1000);

      const todayStr = istNow.toISOString().split('T')[0]; // "YYYY-MM-DD"
      const currentHours = istNow.getHours();
      const currentMinutes = istNow.getMinutes();
      const currentTimeStr = `${String(currentHours).padStart(2, '0')}:${String(currentMinutes).padStart(2, '0')}`; // "HH:MM"

      // ─── 1. Fetch all confirmed & playing bookings for today ───
      const { data: bookings, error } = await supabase
        .from('bookings')
        .select('*, turf:turf_id(id, name, street, city), user:user_id(id, name, email, phone)')
        .in('status', ['confirmed', 'playing'])
        .eq('date', todayStr);

      if (error) {
        console.error('❌ [BookingCron] Error fetching bookings:', error.message);
        return;
      }

      if (!bookings || bookings.length === 0) return;

      for (const booking of bookings) {
        const timeSlots = booking.time_slots || [];
        if (timeSlots.length === 0) continue;

        // Find the earliest start and latest end across all slots
        const slotStarts = timeSlots.map((s) => s.start).sort();
        const slotEnds = timeSlots.map((s) => s.end).sort();
        const earliestStart = slotStarts[0]; // e.g. "14:00"
        const latestEnd = slotEnds[slotEnds.length - 1]; // e.g. "15:00"

        // ─── 2. Auto-complete: slot time is over ───
        if (currentTimeStr >= latestEnd) {
          if (booking.status === 'confirmed' || booking.status === 'playing') {
            await markCompleted(booking);
          }
        }
        // ─── 3. Auto-playing: currently within slot time ───
        else if (currentTimeStr >= earliestStart && currentTimeStr < latestEnd) {
          if (booking.status === 'confirmed') {
            await markPlaying(booking);
          }
        }
      }

      // ─── 4. Auto-complete past-date bookings that are still confirmed/playing ───
      const { data: pastBookings, error: pastErr } = await supabase
        .from('bookings')
        .select('*, turf:turf_id(id, name, street, city), user:user_id(id, name, email, phone)')
        .in('status', ['confirmed', 'playing'])
        .lt('date', todayStr);

      if (pastErr) {
        console.error('❌ [BookingCron] Error fetching past bookings:', pastErr.message);
        return;
      }

      if (pastBookings && pastBookings.length > 0) {
        for (const booking of pastBookings) {
          await markCompleted(booking);
        }
      }
      // ─── 5. Cancel stale pending+unpaid bookings (payment abandoned) ───────────
      // Any booking that stayed pending + unpaid for more than 15 minutes
      // means the user opened the payment modal but never completed payment.
      const staleCutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString();
      const { data: staleBookings, error: staleErr } = await supabase
        .from('bookings')
        .select('id')
        .eq('status', 'pending')
        .eq('payment_status', 'unpaid')
        .lt('created_at', staleCutoff);

      if (!staleErr && staleBookings && staleBookings.length > 0) {
        const staleIds = staleBookings.map((b) => b.id);
        await supabase
          .from('bookings')
          .update({ status: 'cancelled', updated_at: new Date().toISOString() })
          .in('id', staleIds);
        console.log(`🧹 [BookingCron] Cancelled ${staleIds.length} stale pending+unpaid booking(s)`);
      }
    } catch (err) {
      console.error('❌ [BookingCron] Unexpected error:', err.message);
    }
  });

  console.log('⏰ Booking auto-status cron job started (runs every minute)');
}


// ─── Helpers ────────────────────────────────────────────────────────────

async function markPlaying(booking) {
  try {
    await supabase
      .from('bookings')
      .update({ status: 'playing', updated_at: new Date().toISOString() })
      .eq('id', booking.id);

    console.log(`🏃 [BookingCron] Booking ${booking.id} → playing`);
  } catch (err) {
    console.error(`❌ [BookingCron] Failed to set playing for ${booking.id}:`, err.message);
  }
}

async function markCompleted(booking) {
  try {
    await supabase
      .from('bookings')
      .update({ status: 'completed', updated_at: new Date().toISOString() })
      .eq('id', booking.id);

    console.log(`✅ [BookingCron] Booking ${booking.id} → completed`);

    // Send review email to user
    if (booking.user?.email) {
      sendReviewEmail(booking).catch((err) =>
        console.error(`❌ [BookingCron] Email failed for ${booking.id}:`, err.message)
      );
    }
  } catch (err) {
    console.error(`❌ [BookingCron] Failed to complete ${booking.id}:`, err.message);
  }
}

async function sendReviewEmail(booking) {
  const apiUrl = process.env.API_URL || `http://localhost:${process.env.PORT || 5000}`;
  const reviewLink = `${apiUrl}/api/reviews/review-form?bookingId=${booking.id}&userId=${booking.user.id}&turfId=${booking.turf.id}`;

  const quickRatingUrl = (stars) =>
    `${apiUrl}/api/reviews/quick?bookingId=${booking.id}&userId=${booking.user.id}&turfId=${booking.turf.id}&rating=${stars}&comment=`;

  const emailHtml = `
    <div style="font-family: 'Segoe UI', Roboto, -apple-system, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff;">
      <!-- Header -->
      <div style="background: linear-gradient(135deg, #059669, #065f46); padding: 32px 24px; text-align: center; border-radius: 12px 12px 0 0;">
        <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">turf11 ⚽</h1>
        <p style="color: rgba(255,255,255,0.85); margin: 8px 0 0; font-size: 14px;">Your session is complete!</p>
      </div>

      <!-- Body -->
      <div style="padding: 32px 24px; background: #ffffff;">
        <h2 style="color: #0f172a; margin: 0 0 8px; font-size: 22px;">Thank you for playing! 🏆</h2>
        <p style="color: #475569; font-size: 15px; line-height: 1.6; margin-bottom: 24px;">
          Hi <strong>${booking.user?.name || 'Player'}</strong>, we hope you had an amazing time at
          <strong>${booking.turf?.name || 'our turf'}</strong> on <strong>${new Date(booking.date).toDateString()}</strong>.
        </p>

        <!-- Quick Star Rating -->
        <div style="margin: 28px 0; padding: 28px 24px; background: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0; text-align: center;">
          <p style="color: #0f172a; font-size: 18px; font-weight: 700; margin: 0 0 8px;">How was your experience?</p>
          <p style="color: #64748b; font-size: 14px; margin: 0 0 20px; line-height: 1.5;">
            Click a star to rate instantly — no forms, no hassle!
          </p>

          <!-- Clickable Stars -->
          <div style="margin: 20px 0; display: flex; justify-content: center; gap: 8px;">
            <a href="${quickRatingUrl(5)}" style="text-decoration: none; font-size: 48px; line-height: 1;" title="Excellent - 5 stars">⭐</a>
            <a href="${quickRatingUrl(4)}" style="text-decoration: none; font-size: 48px; line-height: 1;" title="Good - 4 stars">⭐</a>
            <a href="${quickRatingUrl(3)}" style="text-decoration: none; font-size: 48px; line-height: 1;" title="Average - 3 stars">⭐</a>
            <a href="${quickRatingUrl(2)}" style="text-decoration: none; font-size: 48px; line-height: 1;" title="Poor - 2 stars">⭐</a>
            <a href="${quickRatingUrl(1)}" style="text-decoration: none; font-size: 48px; line-height: 1;" title="Terrible - 1 star">⭐</a>
          </div>

          <p style="color: #64748b; font-size: 12px; margin: 16px 0 0; line-height: 1.4;">
            5 = Excellent &nbsp;•&nbsp; 4 = Good &nbsp;•&nbsp; 3 = Average &nbsp;•&nbsp; 2 = Poor &nbsp;•&nbsp; 1 = Terrible
          </p>

          <!-- Optional: Add detailed review -->
          <div style="margin-top: 24px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
            <p style="color: #64748b; font-size: 13px; margin-bottom: 12px;">Want to add more details?</p>
            <a href="${reviewLink}"
               style="display: inline-block; background: #ffffff; color: #059669; padding: 10px 24px; border-radius: 8px; font-size: 14px; font-weight: 600; text-decoration: none; border: 1.5px solid #059669;"
               target="_blank">
              Write a Review
            </a>
          </div>
        </div>

        <p style="text-align: center; color: #94a3b8; font-size: 13px; margin: 24px 0 0; border-top: 1px solid #e2e8f0; padding-top: 20px;">
          Thank you for choosing turf11! 🏟️<br/>
          <strong style="color: #475569;">The turf11 Team</strong>
        </p>
      </div>
    </div>
  `;

  await sendEmail({
    to: booking.user.email,
    subject: `⭐ How was your session at ${booking.turf?.name || 'turf11'}? Leave a quick review!`,
    html: emailHtml,
  });

  console.log(`📧 [BookingCron] Review email sent to ${booking.user.email} for booking ${booking.id}`);
}

module.exports = startBookingCron;
