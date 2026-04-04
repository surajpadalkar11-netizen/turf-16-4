import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import SearchBar from '../../components/SearchBar/SearchBar';
import TurfCard from '../../components/TurfCard/TurfCard';
import { getFeaturedTurfs, getCities } from '../../services/turfService';
import { SPORT_TYPES } from '../../utils/constants';
import styles from './Home.module.css';

function Home() {
  const [featured, setFeatured] = useState([]);
  const [cities, setCities] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const load = async () => {
      try {
        const [turfRes, cityRes] = await Promise.all([getFeaturedTurfs(), getCities()]);
        setFeatured(turfRes.data.turfs || []);
        setCities(cityRes.data.cities || []);
      } catch (err) {
        console.error('Failed to load homepage data:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return (
    <div className={styles.home}>
      {/* Hero */}
      <section className={styles.hero}>
        <div className={styles.heroBg} />
        <div className={styles.heroContent}>
          <div className={styles.heroBadge}>
            🏟️ India's #1 Turf Booking Platform
          </div>
          <h1 className={styles.heroTitle}>
            Find & Book Your<br /><span className={styles.highlight}>Perfect Turf</span>
          </h1>
          <p className={styles.heroSub}>
            Discover and book premium sports venues near you — cricket, football, badminton, tennis & more.
          </p>
          <div className={styles.heroActions}>
            <SearchBar />
            <button className={styles.nearbyBtn} onClick={() => navigate('/search?nearby=true')}>
              📍 Use My Location
            </button>
          </div>
          <div className={styles.heroStats}>
            <div className={styles.stat}>
              <span className={styles.statNum}>{cities.length > 0 ? `${cities.reduce((a, c) => a + c.count, 0)}+` : '100+'}</span>
              <span className={styles.statLabel}>Turfs Listed</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statNum}>{cities.length > 0 ? cities.length : '20'}+</span>
              <span className={styles.statLabel}>Cities</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statNum}>8</span>
              <span className={styles.statLabel}>Sports</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statNum}>4.8⭐</span>
              <span className={styles.statLabel}>Avg Rating</span>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className={styles.howItWorks}>
        <div className="container">
          <div className={styles.sectionHeader} style={{ justifyContent: 'center' }}>
            <h2 className={styles.sectionTitle}>How It Works</h2>
          </div>
          <div className={styles.stepsGrid}>
            {[
              { num: '1', icon: '🔍', title: 'Search & Discover', desc: 'Browse turfs by city, sport type, or use your live location to find venues near you.' },
              { num: '2', icon: '📅', title: 'Pick a Slot & Book', desc: 'Choose your preferred date and time slot. See real-time availability and book instantly.' },
              { num: '3', icon: '⚡', title: 'Pay & Play', desc: 'Complete secure payment via Razorpay. Get instant confirmation and show up to play!' },
            ].map((step) => (
              <div key={step.num} className={styles.step}>
                <span className={styles.stepNumber}>{step.num}</span>
                <span className={styles.stepIcon}>{step.icon}</span>
                <h3>{step.title}</h3>
                <p>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Sports Categories */}
      <section className={styles.section}>
        <div className="container">
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Browse by Sport</h2>
            <Link to="/search" className={styles.viewAll}>View All →</Link>
          </div>
          <div className={styles.sportGrid}>
            {SPORT_TYPES.map((sport) => (
              <Link key={sport.value} to={`/search?sport=${sport.value}`} className={styles.sportCard}>
                <span className={styles.sportIcon}>{sport.icon}</span>
                <span className={styles.sportName}>{sport.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Turfs */}
      <section className={styles.section}>
        <div className="container">
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Top Rated Turfs</h2>
            <Link to="/search?sort=rating" className={styles.viewAll}>View All →</Link>
          </div>
          {loading ? (
            <div className={styles.turfGrid}>
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className={styles.skeletonCard} />
              ))}
            </div>
          ) : (
            <div className={styles.turfGrid}>
              {featured.map((turf) => (
                <TurfCard key={turf._id} turf={turf} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Cities */}
      {cities.length > 0 && (
        <section className={styles.section}>
          <div className="container">
            <h2 className={styles.sectionTitle}>Popular Cities</h2>
            <div className={styles.cityGrid} style={{ marginTop: '2rem' }}>
              {cities.map((city) => (
                <Link key={city.name} to={`/search?city=${city.name}`} className={styles.cityCard}>
                  <span className={styles.cityName}>📍 {city.name}</span>
                  <span className={styles.cityCount}>{city.count} turf{city.count !== 1 ? 's' : ''}</span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Why turf11 */}
      <section className={styles.section}>
        <div className="container">
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Why turf11?</h2>
          </div>
          <div className={styles.featureGrid}>
            {[
              { icon: '🔍', title: 'Smart Search', desc: 'Find turfs by city, sport, surface, price range and amenities instantly.' },
              { icon: '📅', title: 'Real-Time Slots', desc: 'See live slot availability and book your preferred time in seconds.' },
              { icon: '🔒', title: 'Secure Payment', desc: 'Pay safely with Razorpay. Bank-grade encryption protects every transaction.' },
              { icon: '⭐', title: 'Verified Reviews', desc: 'Honest reviews from players who actually booked and played at the venue.' },
              { icon: '📍', title: 'Nearby Search', desc: 'Find turfs within your radius using live GPS location detection.' },
              { icon: '📧', title: 'Instant Confirmation', desc: 'Get a booking code and email confirmation the moment your payment clears.' },
            ].map((feat) => (
              <div key={feat.title} className={styles.feature}>
                <span className={styles.featureIcon}>{feat.icon}</span>
                <h3>{feat.title}</h3>
                <p>{feat.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

export default Home;
