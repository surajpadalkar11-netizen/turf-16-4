import { formatTime, formatPrice } from '../../utils/formatters';
import styles from './SlotPicker.module.css';

function SlotPicker({
  slots,
  selectedSlots,
  onToggle,
  pricePerHour,
  peakPricePerHour,
  peakHourStart,
  peakHourEnd,
  slotDurationMinutes,
}) {
  if (!slots || slots.length === 0) {
    return <p className={styles.empty}>No slots available for this date.</p>;
  }

  // Check if a slot falls within peak hours
  const isSlotInPeakHours = (slotStart) => {
    if (!peakPricePerHour || !peakHourStart || !peakHourEnd) return false;
    if (peakHourStart > peakHourEnd) {
      return slotStart >= peakHourStart || slotStart < peakHourEnd;
    }
    return slotStart >= peakHourStart && slotStart < peakHourEnd;
  };

  // Group slots by Morning / Afternoon / Evening
  const groupSlot = (slot) => {
    const hour = parseInt(slot.start.split(':')[0], 10);
    if (hour < 12) return 'Morning';
    if (hour < 17) return 'Afternoon';
    return 'Evening';
  };

  const groups = { Morning: [], Afternoon: [], Evening: [] };
  slots.forEach((slot) => groups[groupSlot(slot)].push(slot));

  const groupIcons = { Morning: '🌅', Afternoon: '☀️', Evening: '🌙' };

  // Count available, blocked, booked
  const totalSlots = slots.length;
  const availableCount = slots.filter(s => s.available && !s.blocked).length;
  const blockedCount = slots.filter(s => s.blocked).length;
  const bookedCount = slots.filter(s => !s.available && !s.blocked).length;

  return (
    <div className={styles.container}>
      {/* Legend */}
      <div className={styles.legend}>
        <span className={styles.legendItem}>
          <span className={`${styles.dot} ${styles.dotAvailable}`} />{availableCount} Available
        </span>
        <span className={styles.legendItem}>
          <span className={`${styles.dot} ${styles.dotBooked}`} />{bookedCount} Booked
        </span>
        {blockedCount > 0 && (
          <span className={styles.legendItem}>
            <span className={`${styles.dot} ${styles.dotBlocked}`} />{blockedCount} Blocked
          </span>
        )}
      </div>

      {Object.entries(groups).map(([group, groupSlots]) => {
        if (groupSlots.length === 0) return null;
        return (
          <div key={group} className={styles.group}>
            <div className={styles.groupLabel}>
              {groupIcons[group] && <span>{groupIcons[group]}</span>}
              <span>{group}</span>
            </div>
            <div className={styles.grid}>
              {groupSlots.map((slot) => {
                const isSelected = selectedSlots.some((s) => s.start === slot.start);
                const isPeak = isSlotInPeakHours(slot.start);
                const priceToUse = isPeak ? peakPricePerHour : pricePerHour;
                const duration = slot.durationMinutes || slotDurationMinutes || 60;
                const slotPrice = Math.round((duration / 60) * priceToUse);
                const isBlocked = slot.blocked;
                const isBooked = !slot.available && !isBlocked;

                let slotClass = styles.available;
                if (isBlocked) slotClass = styles.blocked;
                else if (isBooked) slotClass = styles.booked;
                else if (isSelected) slotClass = styles.selected;

                return (
                  <button
                    key={slot.start}
                    className={`${styles.slot} ${slotClass} ${isPeak && !isBlocked && !isBooked ? styles.peak : ''}`}
                    onClick={() => slot.available && !isBlocked && onToggle(slot, priceToUse)}
                    disabled={!slot.available || isBlocked}
                    id={`slot-${slot.start.replace(':', '-')}`}
                    title={
                      isBlocked
                        ? 'This slot is blocked by the admin'
                        : isBooked
                        ? 'Already booked'
                        : `${formatTime(slot.start)} – ${formatTime(slot.end)} · ₹${slotPrice}${isPeak ? ' (Night)' : ''}`
                    }
                  >
                    <span className={styles.time}>{formatTime(slot.start)}</span>
                    <span className={styles.dash}>–</span>
                    <span className={styles.time}>{formatTime(slot.end)}</span>
                    {duration !== 60 && <span className={styles.halfTag}>{duration} min</span>}
                    {isPeak && !isBlocked && !isBooked && <span className={styles.peakTag}>🌙 Night</span>}
                    {isBlocked && <span className={styles.blockedTag}>🔒 Blocked</span>}
                    {isBooked && <span className={styles.bookedTag}>Booked</span>}
                    {!isBlocked && !isBooked && <span className={styles.price}>₹{slotPrice}</span>}
                    {isSelected && <span className={styles.checkMark}>✓</span>}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      {selectedSlots.length > 0 && (
        <div className={styles.selectionSummary}>
          <span>
            <strong>{selectedSlots.length}</strong> slot{selectedSlots.length > 1 ? 's' : ''} selected
            {' · '}
            <strong>
              {selectedSlots.reduce((sum, s) => sum + (s.durationMinutes || slotDurationMinutes || 60), 0)} min total
            </strong>
          </span>
        </div>
      )}
    </div>
  );
}

export default SlotPicker;
