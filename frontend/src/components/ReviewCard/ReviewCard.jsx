import styles from './ReviewCard.module.css';
import { formatDate, getInitials } from '../../utils/formatters';

function ReviewCard({ review }) {
  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div className={styles.avatar}>{getInitials(review.user?.name || 'U')}</div>
        <div>
          <p className={styles.name}>{review.user?.name}</p>
          <p className={styles.date}>{formatDate(review.createdAt)}</p>
        </div>
        <span className={styles.rating}>{'⭐'.repeat(review.rating)}</span>
      </div>
      <p className={styles.comment}>{review.comment}</p>
    </div>
  );
}

export default ReviewCard;
