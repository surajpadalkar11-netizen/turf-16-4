import { Link } from 'react-router-dom';

function NotFound() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      minHeight: 'calc(100vh - var(--navbar-height) - 200px)', textAlign: 'center', padding: '2rem',
    }}>
      <p style={{ fontSize: '5rem', marginBottom: '1rem' }}>🏟️</p>
      <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Page Not Found</h1>
      <p style={{ color: 'var(--color-text-secondary)', marginBottom: '1.5rem' }}>
        The page you're looking for doesn't exist or has been moved.
      </p>
      <Link to="/" style={{
        background: 'var(--color-primary)', color: 'var(--color-bg)',
        padding: '12px 28px', borderRadius: '10px', fontWeight: 600,
      }}>
        Go Home
      </Link>
    </div>
  );
}

export default NotFound;
