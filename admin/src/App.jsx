import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import AdminLayout from './layouts/AdminLayout';
import Login from './pages/Login/Login';
import Dashboard from './pages/Dashboard/Dashboard';
import Turfs from './pages/Turfs/Turfs';
import Bookings from './pages/Bookings/Bookings';
import Users from './pages/Users/Users';
import Reviews from './pages/Reviews/Reviews';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="page-loader">Loading…</div>;
  if (!user || user.role !== 'admin') return <Navigate to="/login" replace />;
  return children;
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <ProtectedRoute>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route path="/turfs" element={<Turfs />} />
        <Route path="/bookings" element={<Bookings />} />
        <Route path="/users" element={<Users />} />
        <Route path="/reviews" element={<Reviews />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
