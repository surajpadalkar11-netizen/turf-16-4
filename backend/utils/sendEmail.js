const nodemailer = require('nodemailer');

const sendEmail = async ({ to, subject, text, html }) => {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_PASS) {
    console.error('❌ Email not sent: GMAIL_USER or GMAIL_PASS is missing in .env');
    return false;
  }
  if (process.env.GMAIL_PASS === 'REPLACE_WITH_YOUR_16_CHAR_APP_PASSWORD') {
    console.error('❌ Email not sent: Please replace GMAIL_PASS in .env with a real Gmail App Password.');
    return false;
  }

  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASS,
      },
    });

    const mailOptions = {
      from: `"turf11" <${process.env.GMAIL_USER}>`,
      to,
      subject,
      text,
      html,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Email sent to ${to}: ${info.response}`);
    return true;
  } catch (error) {
    console.error('❌ Error sending email:');
    console.error('   Code:', error.code);
    console.error('   Message:', error.message);
    if (error.code === 'EAUTH') {
      console.error('   👉 This is a Gmail authentication error.');
      console.error('   👉 Make sure GMAIL_PASS is a 16-char App Password (not your Gmail password).');
    }
    return false;
  }
};

/** ─── Refund Policy ───────────────────────────────────────────────────────
 *  > 48 hours before booking  → 100% refund
 *  24 – 48 hours before       →  50% refund
 *  < 24 hours before          →   0% refund
 */
const getRefundDetails = (bookingDate, slotStart) => {
  const now = new Date();
  // buildDate: combine booking date with first slot start time
  const bookingDateTime = new Date(`${bookingDate}T${slotStart}:00`);
  const hoursUntilBooking = (bookingDateTime - now) / (1000 * 60 * 60);

  if (hoursUntilBooking > 48) {
    return { percent: 100, label: 'Full Refund', hoursUntilBooking: Math.round(hoursUntilBooking) };
  } else if (hoursUntilBooking >= 24) {
    return { percent: 50, label: '50% Refund', hoursUntilBooking: Math.round(hoursUntilBooking) };
  } else {
    return { percent: 0, label: 'No Refund', hoursUntilBooking: Math.round(hoursUntilBooking) };
  }
};

const sendRefundEmail = async ({ booking, turf, user }) => {
  const ownerEmail = turf.owner_email || turf.ownerEmail;
  if (!ownerEmail) {
    console.warn('⚠️  No owner email found for turf, skipping refund email.');
    return false;
  }

  const slots = (booking.time_slots || []).map((s) => `${s.start} – ${s.end}`).join(', ');
  const firstSlotStart = booking.time_slots?.[0]?.start || '00:00';
  const { percent, label, hoursUntilBooking } = getRefundDetails(booking.date, firstSlotStart);
  const refundAmount = Math.round((booking.total_amount * percent) / 100);
  const currency = '₹';

  const badgeColor = percent === 100 ? '#10b981' : percent === 50 ? '#f59e0b' : '#ef4444';

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Booking Cancellation – Refund Notice</title>
</head>
<body style="margin:0;padding:0;font-family:'Inter',Arial,sans-serif;background:#f8fafc;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#059669,#065f46);padding:32px 40px;text-align:center;">
            <p style="margin:0;color:rgba(255,255,255,0.8);font-size:13px;letter-spacing:1px;text-transform:uppercase;margin-bottom:4px;">turf11 · Cancellation Notice</p>
            <h1 style="margin:0;color:#ffffff;font-size:26px;font-weight:700;">⚠️ Booking Cancelled</h1>
            <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">A customer has cancelled their booking at your turf.</p>
          </td>
        </tr>
        <!-- Refund Badge -->
        <tr>
          <td style="padding:24px 40px 0;text-align:center;">
            <div style="display:inline-block;background:${badgeColor}15;border:2px solid ${badgeColor};border-radius:12px;padding:14px 28px;">
              <p style="margin:0;font-size:13px;color:#475569;font-weight:500;">Applicable Refund</p>
              <p style="margin:4px 0;font-size:28px;font-weight:800;color:${badgeColor};">${percent}% — ${label}</p>
              <p style="margin:0;font-size:15px;color:#0f172a;font-weight:600;">${currency}${refundAmount.toLocaleString('en-IN')} of ${currency}${booking.total_amount.toLocaleString('en-IN')}</p>
            </div>
            <p style="margin:12px 0 0;font-size:12px;color:#94a3b8;">Cancellation made ${hoursUntilBooking} hours before the booking time</p>
          </td>
        </tr>
        <!-- Booking Details -->
        <tr>
          <td style="padding:24px 40px;">
            <h2 style="margin:0 0 16px;font-size:16px;font-weight:700;color:#0f172a;border-bottom:1px solid #e2e8f0;padding-bottom:10px;">📋 Booking Details</h2>
            <table width="100%" cellpadding="8" cellspacing="0" style="font-size:14px;">
              <tr style="background:#f8fafc;"><td style="color:#64748b;border-radius:6px;padding:8px 12px;font-weight:500;">Booking ID</td><td style="color:#0f172a;font-family:monospace;font-weight:600;padding:8px 12px;">#${booking.id?.toString().slice(-8).toUpperCase()}</td></tr>
              <tr><td style="color:#64748b;padding:8px 12px;font-weight:500;">Turf</td><td style="color:#0f172a;font-weight:600;padding:8px 12px;">${turf.name}</td></tr>
              <tr style="background:#f8fafc;"><td style="border-radius:6px;color:#64748b;padding:8px 12px;font-weight:500;">Date</td><td style="color:#0f172a;padding:8px 12px;">${new Date(booking.date).toLocaleDateString('en-IN', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}</td></tr>
              <tr><td style="color:#64748b;padding:8px 12px;font-weight:500;">Time Slots</td><td style="color:#0f172a;padding:8px 12px;">${slots}</td></tr>
              <tr style="background:#f8fafc;"><td style="border-radius:6px;color:#64748b;padding:8px 12px;font-weight:500;">Amount Paid</td><td style="color:#0f172a;font-weight:700;padding:8px 12px;font-size:16px;">${currency}${booking.total_amount.toLocaleString('en-IN')}</td></tr>
            </table>
          </td>
        </tr>
        <!-- Customer Info -->
        <tr>
          <td style="padding:0 40px 24px;">
            <h2 style="margin:0 0 16px;font-size:16px;font-weight:700;color:#0f172a;border-bottom:1px solid #e2e8f0;padding-bottom:10px;">👤 Customer Information</h2>
            <table width="100%" cellpadding="8" cellspacing="0" style="font-size:14px;">
              <tr style="background:#f8fafc;"><td style="color:#64748b;border-radius:6px;padding:8px 12px;font-weight:500;">Name</td><td style="color:#0f172a;padding:8px 12px;">${user.name}</td></tr>
              <tr><td style="color:#64748b;padding:8px 12px;font-weight:500;">Email</td><td style="color:#0f172a;padding:8px 12px;"><a href="mailto:${user.email}" style="color:#059669;">${user.email}</a></td></tr>
              ${user.phone ? `<tr style="background:#f8fafc;"><td style="border-radius:6px;color:#64748b;padding:8px 12px;font-weight:500;">Phone</td><td style="color:#0f172a;padding:8px 12px;">${user.phone}</td></tr>` : ''}
            </table>
          </td>
        </tr>
        <!-- Refund Policy -->
        <tr>
          <td style="padding:0 40px 24px;">
            <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:12px;padding:18px;">
              <h3 style="margin:0 0 10px;font-size:14px;color:#9a3412;font-weight:700;">📌 Refund Policy Reminder</h3>
              <p style="margin:0 0 6px;font-size:13px;color:#7c2d12;">• Cancelled <strong>&gt;48 hours</strong> before slot → <strong style="color:#059669;">100% refund</strong></p>
              <p style="margin:0 0 6px;font-size:13px;color:#7c2d12;">• Cancelled <strong>24–48 hours</strong> before slot → <strong style="color:#d97706;">50% refund</strong></p>
              <p style="margin:0;font-size:13px;color:#7c2d12;">• Cancelled <strong>&lt;24 hours</strong> before slot → <strong style="color:#dc2626;">No refund</strong></p>
            </div>
          </td>
        </tr>
        <!-- Action -->
        ${percent > 0 ? `
        <tr>
          <td style="padding:0 40px 32px;text-align:center;">
            <p style="margin:0 0 12px;font-size:14px;color:#475569;">Please process the refund of <strong style="color:${badgeColor};">${currency}${refundAmount.toLocaleString('en-IN')}</strong> to the customer at your earliest convenience.</p>
            <a href="mailto:${user.email}?subject=Refund for Booking %23${booking.id?.toString().slice(-8).toUpperCase()}&body=Hi ${encodeURIComponent(user.name || 'Customer')},%0A%0AYour refund of ${currency}${refundAmount} has been processed.%0A%0ARegards%0ATurf Owner" style="display:inline-block;background:linear-gradient(135deg,#059669,#065f46);color:#ffffff;font-weight:700;font-size:14px;padding:13px 28px;border-radius:10px;text-decoration:none;">
              📧 Email Customer About Refund
            </a>
          </td>
        </tr>` : `
        <tr>
          <td style="padding:0 40px 32px;text-align:center;">
            <p style="margin:0;font-size:14px;color:#475569;">This booking was cancelled within 24 hours of the slot — <strong>no refund applies</strong> as per our policy.</p>
          </td>
        </tr>`}
        <!-- Footer -->
        <tr>
          <td style="background:#f8fafc;padding:20px 40px;text-align:center;border-top:1px solid #e2e8f0;">
            <p style="margin:0;font-size:12px;color:#94a3b8;">This is an automated notification from <strong>turf11</strong>. Do not reply to this email.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const text = `
TURF11 — BOOKING CANCELLATION NOTICE
=====================================
A customer has cancelled their booking.

REFUND: ${percent}% (${label}) — ${currency}${refundAmount}

Booking ID : #${booking.id?.toString().slice(-8).toUpperCase()}
Turf       : ${turf.name}
Date       : ${booking.date}
Slots      : ${slots}
Amount Paid: ${currency}${booking.total_amount}

Customer   : ${user.name} (${user.email})

Cancellation was made ${hoursUntilBooking} hours before the booking.
${percent > 0 ? `Please process a refund of ${currency}${refundAmount} to the customer.` : 'No refund applies as cancellation was made less than 24 hours before the booking.'}

— turf11 Platform
`;

  return sendEmail({
    to: ownerEmail,
    subject: `⚠️ Booking Cancelled — ${percent}% Refund Required | ${turf.name}`,
    text,
    html,
  });
};

module.exports = sendEmail;
module.exports.sendRefundEmail = sendRefundEmail;
