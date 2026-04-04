import { Link } from 'react-router-dom';
import { formatPrice, getSportIcon } from '../../utils/formatters';
import styles from './TurfCard.module.css';

function TurfCard({ turf }) {
  const img = turf.images?.[0] || 'https://images.unsplash.com/photo-1529900748604-07564a03e7a6?w=600';

  return (
    <Link to={`/turf/${turf._id}`} className={styles.card} id={`turf-card-${turf._id}`}>
      <div className={styles.imageWrap}>
        <img src={img} alt={turf.name} className={styles.image} loading="lazy" />
        <div className={styles.badges}>
          {turf.sportTypes?.map((s) => (
            <span key={s} className={styles.sportBadge}>{getSportIcon(s)} {s}</span>
          ))}
        </div>
        {turf.rating?.average > 4 && <span className={styles.topRated}>⭐ Top Rated</span>}
      </div>
      <div className={styles.info}>
        <h3 className={styles.name}>{turf.name}</h3>
        <p className={styles.location}>📍 {turf.address?.city}, {turf.address?.state}</p>
        <div className={styles.meta}>
          <div className={styles.rating}>
            <span className={styles.ratingScore}>{turf.rating?.average?.toFixed(1) || '0.0'}</span>
            <span className={styles.ratingCount}>({turf.rating?.count || 0} reviews)</span>
          </div>
          <p className={styles.price}>{formatPrice(turf.pricePerHour)}<span>/hr</span></p>
        </div>
        <div className={styles.amenityList}>
          {turf.amenities?.slice(0, 4).map((a) => (
            <span key={a} className={styles.amenity}>{a.replace(/-/g, ' ')}</span>
          ))}
        </div>
      </div>
    </Link>
  );
}

export default TurfCard;
