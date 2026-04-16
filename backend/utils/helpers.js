// Format price in INR
const formatPrice = (amount) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
  }).format(amount);
};

// Generate time slots between open and close hours
// intervalMinutes: any positive integer (30, 45, 60, 90, 120, etc.)
const generateTimeSlots = (openTime, closeTime, intervalMinutes = 60) => {
  // Clamp to sensible bounds
  intervalMinutes = Math.max(15, Math.min(480, intervalMinutes));
  const slots = [];
  const [openH, openM] = openTime.split(':').map(Number);
  const [closeH, closeM] = closeTime.split(':').map(Number);
  const closeTotalMin = closeH * 60 + closeM;
  let currentTotalMin = openH * 60 + openM;

  while (currentTotalMin + intervalMinutes <= closeTotalMin) {
    const startH = String(Math.floor(currentTotalMin / 60)).padStart(2, '0');
    const startM = String(currentTotalMin % 60).padStart(2, '0');
    const endTotalMin = currentTotalMin + intervalMinutes;
    const endH = String(Math.floor(endTotalMin / 60)).padStart(2, '0');
    const endM = String(endTotalMin % 60).padStart(2, '0');

    slots.push({
      start: `${startH}:${startM}`,
      end: `${endH}:${endM}`,
      durationMinutes: intervalMinutes,
    });

    currentTotalMin = endTotalMin;
  }

  return slots;
};

// Async handler wrapper
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = { formatPrice, generateTimeSlots, asyncHandler };
