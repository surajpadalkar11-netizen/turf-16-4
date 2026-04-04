// Format price in INR
const formatPrice = (amount) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
  }).format(amount);
};

// Generate time slots between open and close hours
const generateTimeSlots = (openTime, closeTime, intervalMinutes = 60) => {
  const slots = [];
  const [openH, openM] = openTime.split(':').map(Number);
  const [closeH, closeM] = closeTime.split(':').map(Number);
  let currentH = openH;
  let currentM = openM;

  while (currentH < closeH || (currentH === closeH && currentM < closeM)) {
    const startH = String(currentH).padStart(2, '0');
    const startM = String(currentM).padStart(2, '0');
    let endMinutes = currentM + intervalMinutes;
    let endH = currentH + Math.floor(endMinutes / 60);
    let endM = endMinutes % 60;

    if (endH > closeH || (endH === closeH && endM > closeM)) break;

    const endHStr = String(endH).padStart(2, '0');
    const endMStr = String(endM).padStart(2, '0');

    slots.push({ start: `${startH}:${startM}`, end: `${endHStr}:${endMStr}` });

    currentH = endH;
    currentM = endM;
  }

  return slots;
};

// Async handler wrapper
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = { formatPrice, generateTimeSlots, asyncHandler };
