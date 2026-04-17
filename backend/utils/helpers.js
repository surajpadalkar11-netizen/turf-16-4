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
  let closeTotalMin = closeH * 60 + closeM;
  let currentTotalMin = openH * 60 + openM;

  if (closeTotalMin <= currentTotalMin) {
    closeTotalMin += 1440;
  }

  while (currentTotalMin + intervalMinutes <= closeTotalMin) {
    const currentMinMod = currentTotalMin % 1440;
    const startH = String(Math.floor(currentMinMod / 60)).padStart(2, '0');
    const startM = String(currentMinMod % 60).padStart(2, '0');
    
    const endTotalMin = currentTotalMin + intervalMinutes;
    const endMinMod = endTotalMin % 1440;
    const endH = String(Math.floor(endMinMod / 60)).padStart(2, '0');
    const endM = String(endMinMod % 60).padStart(2, '0');

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
