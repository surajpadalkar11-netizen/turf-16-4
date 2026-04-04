import { formatTime } from '../../utils/formatters';
import styles from './SlotPicker.module.css';

function SlotPicker({ slots, selectedSlots, onToggle, pricePerHour }) {
  if (!slots || slots.length === 0) {
    return <p className={styles.empty}>No slots available for this date.</p>;
  }

  return (
    <div className={styles.grid}>
      {slots.map((slot) => {
        const isSelected = selectedSlots.some((s) => s.start === slot.start);
        const className = `${styles.slot} ${!slot.available ? styles.booked : isSelected ? styles.selected : styles.available}`;

        return (
          <button
            key={slot.start}
            className={className}
            onClick={() => slot.available && onToggle(slot, pricePerHour)}
            disabled={!slot.available}
            id={`slot-${slot.start}`}
          >
            <span className={styles.time}>{formatTime(slot.start)}</span>
            <span className={styles.dash}>–</span>
            <span className={styles.time}>{formatTime(slot.end)}</span>
            {!slot.available && <span className={styles.bookedTag}>Booked</span>}
          </button>
        );
      })}
    </div>
  );
}

export default SlotPicker;
