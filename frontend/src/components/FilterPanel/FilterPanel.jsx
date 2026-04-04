import styles from './FilterPanel.module.css';
import { SPORT_TYPES, SURFACE_TYPES, AMENITIES } from '../../utils/constants';

function FilterPanel({ filters, onChange }) {
  const update = (key, value) => onChange({ ...filters, [key]: value });

  return (
    <aside className={styles.panel} id="filter-panel">
      <h3 className={styles.title}>Filters</h3>

      <div className={styles.section}>
        <h4>Sport Type</h4>
        <div className={styles.chips}>
          {SPORT_TYPES.map((s) => (
            <button
              key={s.value}
              className={`${styles.chip} ${filters.sport === s.value ? styles.active : ''}`}
              onClick={() => update('sport', filters.sport === s.value ? '' : s.value)}
            >
              {s.icon} {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.section}>
        <h4>Surface</h4>
        <div className={styles.chips}>
          {SURFACE_TYPES.map((s) => (
            <button
              key={s.value}
              className={`${styles.chip} ${filters.surface === s.value ? styles.active : ''}`}
              onClick={() => update('surface', filters.surface === s.value ? '' : s.value)}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.section}>
        <h4>Price Range (per hour)</h4>
        <div className={styles.priceRow}>
          <input
            type="number"
            placeholder="Min"
            value={filters.minPrice || ''}
            onChange={(e) => update('minPrice', e.target.value)}
            className={styles.priceInput}
          />
          <span>–</span>
          <input
            type="number"
            placeholder="Max"
            value={filters.maxPrice || ''}
            onChange={(e) => update('maxPrice', e.target.value)}
            className={styles.priceInput}
          />
        </div>
      </div>

      <div className={styles.section}>
        <h4>Min Rating</h4>
        <div className={styles.ratingBtns}>
          {[3, 3.5, 4, 4.5].map((r) => (
            <button
              key={r}
              className={`${styles.ratingBtn} ${filters.rating == r ? styles.active : ''}`}
              onClick={() => update('rating', filters.rating == r ? '' : r)}
            >
              {r}+⭐
            </button>
          ))}
        </div>
      </div>

      <div className={styles.section}>
        <h4>Amenities</h4>
        <div className={styles.chips}>
          {AMENITIES.slice(0, 8).map((a) => {
            const selected = filters.amenities?.includes(a.value);
            return (
              <button
                key={a.value}
                className={`${styles.chip} ${selected ? styles.active : ''}`}
                onClick={() => {
                  const current = filters.amenities || [];
                  const newAmenities = selected
                    ? current.filter((v) => v !== a.value)
                    : [...current, a.value];
                  update('amenities', newAmenities);
                }}
              >
                {a.icon} {a.label}
              </button>
            );
          })}
        </div>
      </div>

      <button className={styles.clearBtn} onClick={() => onChange({})}>
        Clear All Filters
      </button>
    </aside>
  );
}

export default FilterPanel;
