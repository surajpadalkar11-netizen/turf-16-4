import { createContext, useState, useContext } from 'react';

const BookingContext = createContext(null);

export function BookingProvider({ children }) {
  const [bookingData, setBookingData] = useState({
    turf: null,
    date: '',
    selectedSlots: [],
    playerCount: 1,
    totalAmount: 0,
  });

  const setTurf = (turf) => setBookingData((prev) => ({ ...prev, turf }));
  const setDate = (date) => setBookingData((prev) => ({ ...prev, date, selectedSlots: [] }));
  const setPlayerCount = (count) => setBookingData((prev) => ({ ...prev, playerCount: count }));

  const toggleSlot = (slot, pricePerHour) => {
    setBookingData((prev) => {
      const exists = prev.selectedSlots.find((s) => s.start === slot.start);
      let newSlots;
      if (exists) {
        newSlots = prev.selectedSlots.filter((s) => s.start !== slot.start);
      } else {
        // Store the price with the slot so we can calculate correctly
        newSlots = [...prev.selectedSlots, { ...slot, priceUsed: pricePerHour }];
      }
      // Calculate total based on each slot's stored price
      const totalAmount = newSlots.reduce((sum, s) => {
        const durationHours = (s.durationMinutes || 60) / 60;
        const price = s.priceUsed || pricePerHour; // Use stored price or fallback
        return sum + durationHours * price;
      }, 0);
      return { ...prev, selectedSlots: newSlots, totalAmount };
    });
  };

  const clearBooking = () => {
    setBookingData({ turf: null, date: '', selectedSlots: [], playerCount: 1, totalAmount: 0 });
  };

  return (
    <BookingContext.Provider value={{ bookingData, setTurf, setDate, toggleSlot, setPlayerCount, clearBooking }}>
      {children}
    </BookingContext.Provider>
  );
}

export function useBooking() {
  const context = useContext(BookingContext);
  if (!context) throw new Error('useBooking must be used within BookingProvider');
  return context;
}

export default BookingContext;
