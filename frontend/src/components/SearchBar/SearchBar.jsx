import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './SearchBar.module.css';

function SearchBar({ initialCity = '', initialSport = '', compact = false }) {
  const [city, setCity] = useState(initialCity);
  const [sport, setSport] = useState(initialSport);
  const navigate = useNavigate();

  const handleSearch = (e) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (city) params.set('city', city);
    if (sport) params.set('sport', sport);
    navigate(`/search?${params.toString()}`);
  };

  return (
    <form className={`${styles.searchBar} ${compact ? styles.compact : ''}`} onSubmit={handleSearch} id="search-bar">
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
      <div className={styles.field}>
        <label className={styles.label}>🏆 Sport</label>
        <select value={sport} onChange={(e) => setSport(e.target.value)} className={styles.input} id="search-sport">
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
        Search
      </button>
    </form>
  );
}

export default SearchBar;
