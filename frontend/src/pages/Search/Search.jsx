import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import TurfCard from '../../components/TurfCard/TurfCard';
import FilterPanel from '../../components/FilterPanel/FilterPanel';
import { getTurfs } from '../../services/turfService';
import { SORT_OPTIONS } from '../../utils/constants';
import styles from './Search.module.css';

const todayStr = () => new Date().toISOString().split('T')[0];

// 30-min increment time options
const TIME_OPTIONS = [];
for (let h = 0; h < 24; h++) {
  for (const m of [0, 30]) {
    const hh = String(h).padStart(2, '0');
    const mm = String(m).padStart(2, '0');
    const period = h >= 12 ? 'PM' : 'AM';
    const displayH = h % 12 || 12;
    TIME_OPTIONS.push({ value: `${hh}:${mm}`, label: `${displayH}:${mm} ${period}` });
  }
}

const fmt12 = (t) => {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
};

const fmtDate = (d) => {
  if (!d) return '';
  return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', {
    weekday: 'short', day: 'numeric', month: 'short',
  });
};

const SPORT_ICONS = {
  cricket: '🏏', football: '⚽', badminton: '🏸', tennis: '🎾',
  basketball: '🏀', volleyball: '🏐', hockey: '🏑',
};

function Search() {
  const [searchParams, setSearchParams] = useSearchParams();

  // ── Live filter state (drives instant re-fetch) ──────────────────
  const [city,    setCity]    = useState(searchParams.get('city')  || '');
  const [sport,   setSport]   = useState(searchParams.get('sport') || '');
  const [date,    setDate]    = useState(searchParams.get('date')  || todayStr());
  const [time,    setTime]    = useState(searchParams.get('time')  || '');

  const [turfs,       setTurfs]       = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [totalPages,  setTotalPages]  = useState(1);
  const [totalCount,  setTotalCount]  = useState(0);
  const [page,        setPage]        = useState(1);
  const [sort,        setSort]        = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [searchCtx,   setSearchCtx]   = useState(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [isNearbySearch,  setIsNearbySearch]  = useState(false);
  const [filters, setFilters] = useState({
    surface: '', minPrice: '', maxPrice: '', rating: '', amenities: [],
  });

  // debounce timer for city input
  const cityTimer = useRef(null);

  // ── Core fetch ───────────────────────────────────────────────────
  const loadTurfs = useCallback(async (overrides = {}) => {
    if (!overrides.locationParams) setIsNearbySearch(false);
    setLoading(true);

    const q = {
      city:       overrides.city  ?? city,
      sport:      overrides.sport ?? sport,
      date:       overrides.date  ?? date,
      time:       overrides.time  ?? time,
      surface:    filters.surface,
      minPrice:   filters.minPrice,
      maxPrice:   filters.maxPrice,
      rating:     filters.rating,
      amenities:  filters.amenities?.join(',') || '',
      sort,
      page,
      limit: 12,
      ...(overrides.locationParams || {}),
    };

    // Strip empty values
    Object.keys(q).forEach((k) => { if (q[k] === '' || q[k] == null) delete q[k]; });

    try {
      const { data } = await getTurfs(q);
      setTurfs(data.turfs || []);
      setTotalPages(data.totalPages || 1);
      setTotalCount(data.total || 0);
      setSearchCtx(data.searchContext || null);
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setLoading(false);
    }
  }, [city, sport, date, time, filters, sort, page]);

  // Re-fetch whenever any filter changes
  useEffect(() => { loadTurfs(); }, [loadTurfs]);

  // Sync URL params on mount only (don't re-trigger)
  useEffect(() => {
    const p = new URLSearchParams();
    if (city)  p.set('city',  city);
    if (sport) p.set('sport', sport);
    if (date)  p.set('date',  date);
    if (time)  p.set('time',  time);
    setSearchParams(p, { replace: true });
  }, [city, sport, date, time]);

  const handleNearbySearch = () => {
    if (!navigator.geolocation) { alert('Geolocation not supported'); return; }
    setLocationLoading(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords: { latitude, longitude } }) => {
        setIsNearbySearch(true);
        loadTurfs({ locationParams: { lat: latitude, lng: longitude, radius: 50000 } });
        setLocationLoading(false);
      },
      () => { alert('Enable location access to use this feature.'); setLocationLoading(false); }
    );
  };

  const clearTime = () => setTime('');
  const clearDate = () => { setDate(todayStr()); setTime(''); };

  const hasActiveFilter = date !== todayStr() || time || city || sport;

  return (
    <div className={`container ${styles.page}`}>

      {/* ── Availability Filter Bar ──────────────────────────────── */}
      <div className={styles.filterBar}>
        {/* Date */}
        <div className={styles.filterField}>
          <label className={styles.filterLabel}>📅 Date</label>
          <input
            type="date"
            value={date}
            min={todayStr()}
            onChange={(e) => { setDate(e.target.value); setPage(1); }}
            className={styles.filterInput}
            id="filter-date"
          />
        </div>

        {/* Time */}
        <div className={styles.filterField}>
          <label className={styles.filterLabel}>⏰ Start Time</label>
          <div className={styles.filterSelectWrap}>
            <select
              value={time}
              onChange={(e) => { setTime(e.target.value); setPage(1); }}
              className={styles.filterInput}
              id="filter-time"
            >
              <option value="">Any Time</option>
              {TIME_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            {time && (
              <button className={styles.clearBtn} onClick={clearTime} title="Clear time">✕</button>
            )}
          </div>
        </div>

        {/* City */}
        <div className={styles.filterField}>
          <label className={styles.filterLabel}>📍 City</label>
          <input
            type="text"
            placeholder="Enter city..."
            value={city}
            onChange={(e) => {
              const v = e.target.value;
              setCity(v);
              clearTimeout(cityTimer.current);
              cityTimer.current = setTimeout(() => setPage(1), 400);
            }}
            className={styles.filterInput}
            id="filter-city"
          />
        </div>

        {/* Sport */}
        <div className={styles.filterField}>
          <label className={styles.filterLabel}>🏆 Sport</label>
          <select
            value={sport}
            onChange={(e) => { setSport(e.target.value); setPage(1); }}
            className={styles.filterInput}
            id="filter-sport"
          >
            <option value="">All Sports</option>
            <option value="cricket">🏏 Cricket</option>
            <option value="football">⚽ Football</option>
            <option value="badminton">🏸 Badminton</option>
            <option value="tennis">🎾 Tennis</option>
            <option value="basketball">🏀 Basketball</option>
            <option value="volleyball">🏐 Volleyball</option>
            <option value="hockey">🏑 Hockey</option>
          </select>
        </div>

        {/* Actions */}
        <div className={styles.filterActions}>
          <button
            className={styles.nearbyBtn}
            onClick={handleNearbySearch}
            disabled={locationLoading}
            id="nearby-btn"
          >
            {locationLoading ? '📍…' : '📍 Near Me'}
          </button>
          <button
            className={`${styles.filterToggle} ${showFilters ? styles.filterToggleActive : ''}`}
            onClick={() => setShowFilters((s) => !s)}
          >
            ⚙️ Filters
          </button>
        </div>
      </div>

      {/* ── Active filter chips + sort ─────────────────────────────── */}
      <div className={styles.resultsBar}>
        <div className={styles.chips}>
          {date && (
            <span className={styles.chip}>
              📅 {fmtDate(date)}
            </span>
          )}
          {time && (
            <span className={`${styles.chip} ${styles.chipHighlight}`}>
              ⏰ {fmt12(time)}
              <button className={styles.chipRemove} onClick={clearTime}>✕</button>
            </span>
          )}
          {city && (
            <span className={styles.chip}>
              📍 {city}
              <button className={styles.chipRemove} onClick={() => setCity('')}>✕</button>
            </span>
          )}
          {sport && (
            <span className={styles.chip}>
              {SPORT_ICONS[sport] || '🏆'} {sport}
              <button className={styles.chipRemove} onClick={() => setSport('')}>✕</button>
            </span>
          )}
          {searchCtx?.availabilityFiltered && !loading && (
            <span className={styles.chipAvailable}>
              ✅ {totalCount} available turf{totalCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <select
          value={sort}
          onChange={(e) => { setSort(e.target.value); setPage(1); }}
          className={styles.sortSelect}
          id="sort-select"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* ── Sidebar filters + results ─────────────────────────────── */}
      <div className={styles.layout}>
        {showFilters && (
          <div className={styles.sidebar}>
            <FilterPanel filters={filters} onChange={(f) => { setFilters(f); setPage(1); }} />
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
              <p className={styles.emptyIcon}>{searchCtx?.availabilityFiltered ? '🕐' : '🔍'}</p>
              <h3>
                {searchCtx?.availabilityFiltered
                  ? `No turfs available${time ? ` at ${fmt12(time)}` : ''} on ${fmtDate(date)}`
                  : isNearbySearch ? 'No turf found nearby' : 'No turfs found'}
              </h3>
              <p>
                {searchCtx?.availabilityFiltered
                  ? 'Try a different time, date, or city.'
                  : isNearbySearch
                  ? 'Try a different city or expand the search radius.'
                  : 'Try adjusting your filters or search in a different city.'}
              </p>
              {searchCtx?.availabilityFiltered && (
                <button className={styles.clearFilterBtn} onClick={clearDate}>
                  ↩ Reset Date & Time
                </button>
              )}
            </div>
          ) : (
            <>
              <div className={styles.grid}>
                {turfs.map((t) => (
                  <TurfCard key={t._id} turf={t} searchDate={date} searchTime={time} />
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
