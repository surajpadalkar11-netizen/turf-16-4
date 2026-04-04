import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import TurfCard from '../../components/TurfCard/TurfCard';
import FilterPanel from '../../components/FilterPanel/FilterPanel';
import SearchBar from '../../components/SearchBar/SearchBar';
import { getTurfs } from '../../services/turfService';
import { SORT_OPTIONS } from '../../utils/constants';
import styles from './Search.module.css';

function Search() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [turfs, setTurfs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    sport: searchParams.get('sport') || '',
    surface: '',
    minPrice: '',
    maxPrice: '',
    rating: '',
    amenities: [],
  });
  const [showDateModal, setShowDateModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');
  const [locationLoading, setLocationLoading] = useState(false);
  const [isNearbySearch, setIsNearbySearch] = useState(false);

  useEffect(() => {
    const city = searchParams.get('city') || '';
    const sport = searchParams.get('sport') || '';
    if (sport && sport !== filters.sport) {
      setFilters((prev) => ({ ...prev, sport }));
    }
    loadTurfs(city, sport);
  }, [searchParams]);

  useEffect(() => {
    loadTurfs();
  }, [filters, sort, page]);

  useEffect(() => {
    if (searchParams.get('nearby') === 'true') {
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('nearby');
      setSearchParams(newParams, { replace: true });
      setShowDateModal(true);
    }
  }, [searchParams, setSearchParams]);

  const loadTurfs = async (cityOverride, sportOverride, locationParams) => {
    if (!locationParams) setIsNearbySearch(false);
    setLoading(true);
    try {
      const params = {
        sport: sportOverride || filters.sport || '',
        surface: filters.surface || '',
        minPrice: filters.minPrice || '',
        maxPrice: filters.maxPrice || '',
        rating: filters.rating || '',
        amenities: filters.amenities?.join(',') || '',
        sort,
        page,
        limit: 12,
        ...locationParams,
      };

      // Only add city if not doing nearby search
      if (!locationParams) {
        params.city = cityOverride || searchParams.get('city') || '';
      }

      // Remove empty params
      Object.keys(params).forEach((k) => { if (!params[k]) delete params[k]; });
      const { data } = await getTurfs(params);
      setTurfs(data.turfs || []);
      setTotalPages(data.totalPages || 1);
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleNearbySearch = () => {
    setShowDateModal(true);
  };

  const confirmNearbySearch = () => {
    if (!selectedDate) {
      alert('Please select a date');
      return;
    }
    setShowDateModal(false);
    setLocationLoading(true);

    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser');
      setLocationLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setIsNearbySearch(true);
        loadTurfs(null, null, {
          lat: latitude,
          lng: longitude,
          radius: 50000, // 50km radius
          date: selectedDate,
        });
        setLocationLoading(false);
      },
      (error) => {
        console.error('Location error:', error);
        alert('Unable to get your location. Please enable location services.');
        setLocationLoading(false);
      }
    );
  };

  return (
    <div className={`container ${styles.page}`}>
      <div className={styles.topBar}>
        <SearchBar initialCity={searchParams.get('city') || ''} initialSport={filters.sport} compact />
        <button
          className={styles.nearbyBtn}
          onClick={handleNearbySearch}
          disabled={locationLoading}
        >
          {locationLoading ? '📍 Getting location...' : '📍 Search Nearby Turfs'}
        </button>
        <div className={styles.controls}>
          <button className={styles.filterToggle} onClick={() => setShowFilters(!showFilters)}>
            {showFilters ? 'Hide Filters' : 'Filters'} ⚙️
          </button>
          <select value={sort} onChange={(e) => setSort(e.target.value)} className={styles.sortSelect}>
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className={styles.layout}>
        {showFilters && (
          <div className={styles.sidebar}>
            <FilterPanel filters={filters} onChange={setFilters} />
          </div>
        )}
        <div className={styles.results}>
          {loading ? (
            <div className={styles.grid}>
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="skeleton" style={{ height: 320, borderRadius: 16 }} />
              ))}
            </div>
          ) : turfs.length === 0 ? (
            <div className={styles.empty}>
              <p className={styles.emptyIcon}>🔍</p>
              <h3>{isNearbySearch ? 'No turf found nearby' : 'No turfs found'}</h3>
              <p>
                {isNearbySearch
                  ? 'Please go with the search location or try a different city.'
                  : 'Try adjusting your filters or search in a different city.'}
              </p>
            </div>
          ) : (
            <>
              <div className={styles.grid}>
                {turfs.map((t) => (
                  <TurfCard key={t._id} turf={t} />
                ))}
              </div>
              {totalPages > 1 && (
                <div className={styles.pagination}>
                  {Array.from({ length: totalPages }, (_, i) => (
                    <button
                      key={i + 1}
                      className={`${styles.pageBtn} ${page === i + 1 ? styles.activePage : ''}`}
                      onClick={() => setPage(i + 1)}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {showDateModal && (
        <div className={styles.modalOverlay} onClick={() => setShowDateModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3>Select Date for Nearby Search</h3>
            <p>Choose a date to check turf availability near you</p>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className={styles.dateInput}
            />
            <div className={styles.modalActions}>
              <button onClick={() => setShowDateModal(false)} className={styles.cancelBtn}>
                Cancel
              </button>
              <button onClick={confirmNearbySearch} className={styles.confirmBtn}>
                Confirm & Search
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Search;
