import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './SearchBar.module.css';

const todayStr = () => new Date().toISOString().split('T')[0];

// Generate time options in 30-min increments for the whole day
const TIME_OPTIONS = [];
for (let h = 0; h < 24; h++) {
  for (let m of [0, 30]) {
    const hh = String(h).padStart(2, '0');
    const mm = String(m).padStart(2, '0');
    const val = `${hh}:${mm}`;
    const period = h >= 12 ? 'PM' : 'AM';
    const displayH = h % 12 || 12;
    TIME_OPTIONS.push({ value: val, label: `${displayH}:${mm} ${period}` });
  }
}

function SearchBar({ initialCity = '', initialSport = '', initialDate = '', initialTime = '', compact = false }) {
  const [city, setCity] = useState(initialCity);
  const [sport, setSport] = useState(initialSport);
  const [date, setDate] = useState(initialDate || todayStr());
  const [time, setTime] = useState(initialTime || '');
  const navigate = useNavigate();

  const handleSearch = (e) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (city) params.set('city', city);
    if (sport) params.set('sport', sport);
    if (date) params.set('date', date);
    if (time) params.set('time', time);
    navigate(`/search?${params.toString()}`);
  };

  return (
    <form
      className={`${styles.searchBar} ${compact ? styles.compact : ''}`}
      onSubmit={handleSearch}
      id="search-bar"
    >
      {/* City */}
      <div className={styles.field}>
        <label className={styles.label}>📍 City</label>
        <input
          type="text"
          placeholder="Enter city..."
          value={city}
          onChange={(e) => setCity(e.target.value)}
          className={styles.input}
          id="search-city"
        />
      </div>

      <div className={styles.divider} />

      {/* Date */}
      <div className={styles.field}>
        <label className={styles.label}>📅 Date</label>
        <input
          type="date"
          value={date}
          min={todayStr()}
          onChange={(e) => setDate(e.target.value)}
          className={styles.input}
          id="search-date"
        />
      </div>

      <div className={styles.divider} />

      {/* Time */}
      <div className={styles.field}>
        <label className={styles.label}>⏰ Start Time</label>
        <select
          value={time}
          onChange={(e) => setTime(e.target.value)}
          className={styles.input}
          id="search-time"
        >
          <option value="">Any Time</option>
          {TIME_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      <div className={styles.divider} />

      {/* Sport */}
      <div className={styles.field}>
        <label className={styles.label}>🏆 Sport</label>
        <select
          value={sport}
          onChange={(e) => setSport(e.target.value)}
          className={styles.input}
          id="search-sport"
        >
          <option value="">All Sports</option>
          <option value="cricket">Cricket</option>
          <option value="football">Football</option>
          <option value="badminton">Badminton</option>
          <option value="tennis">Tennis</option>
          <option value="basketball">Basketball</option>
          <option value="volleyball">Volleyball</option>
          <option value="hockey">Hockey</option>
        </select>
      </div>

      <button type="submit" className={styles.searchBtn} id="search-submit">
        {compact ? '🔍' : 'Find Available Turfs'}
      </button>
    </form>
  );
}

export default SearchBar;
