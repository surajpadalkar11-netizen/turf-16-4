import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
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
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [searchContext, setSearchContext] = useState(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [isNearbySearch, setIsNearbySearch] = useState(false);

  const [filters, setFilters] = useState({
    sport: searchParams.get('sport') || '',
    surface: '',
    minPrice: '',
    maxPrice: '',
    rating: '',
    amenities: [],
  });

  const loadTurfs = useCallback(async (overrides = {}) => {
    if (!overrides.locationParams) setIsNearbySearch(false);
    setLoading(true);

    const date = overrides.date ?? searchParams.get('date') ?? '';
    const time = overrides.time ?? searchParams.get('time') ?? '';

    try {
      const params = {
        sport: filters.sport || searchParams.get('sport') || '',
        surface: filters.surface || '',
        minPrice: filters.minPrice || '',
        maxPrice: filters.maxPrice || '',
        rating: filters.rating || '',
        amenities: filters.amenities?.join(',') || '',
        sort,
        page,
        limit: 12,
        ...(overrides.locationParams || {}),
      };

      if (!overrides.locationParams) {
        params.city = searchParams.get('city') || '';
      }
      if (date) params.date = date;
      if (time) params.time = time;

      Object.keys(params).forEach((k) => { if (!params[k]) delete params[k]; });

      const { data } = await getTurfs(params);
      setTurfs(data.turfs || []);
      setTotalPages(data.totalPages || 1);
      setTotalCount(data.total || 0);
      setSearchContext(data.searchContext || null);
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setLoading(false);
    }
  }, [searchParams, filters, sort, page]);

  useEffect(() => { loadTurfs(); }, [loadTurfs]);

  // Sync sport from URL
  useEffect(() => {
    const sport = searchParams.get('sport') || '';
    if (sport && sport !== filters.sport) {
      setFilters((p) => ({ ...p, sport }));
    }
  }, [searchParams]);

  const handleNearbySearch = () => {
    if (!navigator.geolocation) { alert('Geolocation not supported'); return; }
    setLocationLoading(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords: { latitude, longitude } }) => {
        setIsNearbySearch(true);
        loadTurfs({ locationParams: { lat: latitude, lng: longitude, radius: 50000 } });
        setLocationLoading(false);
      },
      () => {
        alert('Unable to get location. Enable location services.');
        setLocationLoading(false);
      }
    );
  };

  const date = searchParams.get('date') || '';
  const time = searchParams.get('time') || '';

  // Format time for display
  const formatDisplayTime = (t) => {
    if (!t) return '';
    const [h, m] = t.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    const displayH = h % 12 || 12;
    return `${displayH}:${String(m).padStart(2, '0')} ${period}`;
  };

  const formatDisplayDate = (d) => {
    if (!d) return '';
    return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', {
      weekday: 'short', day: 'numeric', month: 'long',
    });
  };

  return (
    <div className={`container ${styles.page}`}>
      {/* Top bar with SearchBar */}
      <div className={styles.topBar}>
        <SearchBar
          initialCity={searchParams.get('city') || ''}
          initialSport={filters.sport}
          initialDate={date}
          initialTime={time}
          compact
        />
        <button
          className={styles.nearbyBtn}
          onClick={handleNearbySearch}
          disabled={locationLoading}
        >
          {locationLoading ? '📍 Getting location…' : '📍 Near Me'}
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

      {/* Availability context banner */}
      {searchContext?.availabilityFiltered && (
        <div className={styles.availabilityBanner}>
          <span className={styles.availabilityIcon}>✅</span>
          <div>
            <strong>Showing {totalCount} available turf{totalCount !== 1 ? 's' : ''}</strong>
            {' '}for{' '}
            <strong>{formatDisplayDate(searchContext.date)}</strong>
            {searchContext.time && <> at <strong>{formatDisplayTime(searchContext.time)}</strong></>}
            {' '}— all slots confirmed available
          </div>
          <button
            className={styles.clearAvailability}
            onClick={() => {
              const p = new URLSearchParams(searchParams);
              p.delete('date'); p.delete('time');
              setSearchParams(p);
            }}
          >
            ✕ Clear
          </button>
        </div>
      )}

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
              <p className={styles.emptyIcon}>{searchContext?.availabilityFiltered ? '🕐' : '🔍'}</p>
              <h3>
                {searchContext?.availabilityFiltered
                  ? `No turfs available at ${formatDisplayTime(searchContext.time)} on ${formatDisplayDate(searchContext.date)}`
                  : isNearbySearch ? 'No turf found nearby' : 'No turfs found'}
              </h3>
              <p>
                {searchContext?.availabilityFiltered
                  ? 'Try a different time slot, date, or city.'
                  : isNearbySearch
                  ? 'Try a different city or expand the search radius.'
                  : 'Try adjusting your filters or search in a different city.'}
              </p>
            </div>
          ) : (
            <>
              <div className={styles.grid}>
                {turfs.map((t) => (
                  <TurfCard
                    key={t._id}
                    turf={t}
                    searchDate={date}
                    searchTime={time}
                  />
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
    </div>
  );
}

export default Search;
