import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';

// Lazy-loaded pages
const Layout = lazy(() => import('./layouts/Layout'));
const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Bookings = lazy(() => import('./pages/Bookings'));
const Slots = lazy(() => import('./pages/Slots'));
const Scanner = lazy(() => import('./pages/Scanner'));
const Supervisors = lazy(() => import('./pages/Supervisors'));
const SupervisorDashboard = lazy(() => import('./pages/SupervisorDashboard'));
const Earnings = lazy(() => import('./pages/Earnings'));

function PageLoader() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', flexDirection: 'column', gap: 12, background: 'var(--bg)',
    }}>
      <div style={{
        width: 36, height: 36, border: '3px solid var(--border)',
        borderTopColor: 'var(--primary)', borderRadius: '50%',
        animation: 'spin 0.7s linear infinite',
      }} />
      <span style={{ color: 'var(--text-muted)', fontSize: 13, fontWeight: 600 }}>Loading...</span>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function PrivateRoute({ children }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" replace />;
}

function PublicRoute({ children }) {
  const { user } = useAuth();
  return user ? <Navigate to="/" replace /> : children;
}

// Guard: only owner/admin can access — redirect supervisor to /
function OwnerOnlyRoute({ children }) {
  const { isSupervisor } = useAuth();
  return isSupervisor ? <Navigate to="/" replace /> : children;
}

function AppRoutes() {
  const { isSupervisor } = useAuth();

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
        <Route element={<PrivateRoute><Layout /></PrivateRoute>}>
          {/* ── Supervisor landing page ── */}
          <Route path="/" element={isSupervisor ? <SupervisorDashboard /> : <Dashboard />} />

          {/* ── Owner-only pages ── */}
          <Route path="/bookings" element={<OwnerOnlyRoute><Bookings /></OwnerOnlyRoute>} />
          <Route path="/slots" element={<OwnerOnlyRoute><Slots /></OwnerOnlyRoute>} />
          <Route path="/earnings" element={<OwnerOnlyRoute><Earnings /></OwnerOnlyRoute>} />
          <Route path="/scanner" element={<Scanner />} />
          <Route path="/supervisors" element={<OwnerOnlyRoute><Supervisors /></OwnerOnlyRoute>} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
