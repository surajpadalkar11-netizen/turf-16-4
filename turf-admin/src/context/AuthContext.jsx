import { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('turfowner_user')); } catch { return null; }
  });
  const [turfs, setTurfs] = useState(() => {
    try { return JSON.parse(localStorage.getItem('turfowner_turfs')) || []; } catch { return []; }
  });
  const [selectedTurf, setSelectedTurf] = useState(() => {
    try { return JSON.parse(localStorage.getItem('turfowner_selected_turf')); } catch { return null; }
  });

  const login = async (email, password) => {
    const { data } = await api.post('/turf-owner/login', { email, password });
    localStorage.setItem('turfowner_token', data.token);
    localStorage.setItem('turfowner_user', JSON.stringify(data.user));
    localStorage.setItem('turfowner_turfs', JSON.stringify(data.turfs));
    const firstTurf = data.turfs?.[0] || null;
    localStorage.setItem('turfowner_selected_turf', JSON.stringify(firstTurf));
    setUser(data.user);
    setTurfs(data.turfs || []);
    setSelectedTurf(firstTurf);
    return data;
  };

  const logout = () => {
    ['turfowner_token','turfowner_user','turfowner_turfs','turfowner_selected_turf'].forEach(k =>
      localStorage.removeItem(k)
    );
    setUser(null);
    setTurfs([]);
    setSelectedTurf(null);
  };

  const switchTurf = (turf) => {
    setSelectedTurf(turf);
    localStorage.setItem('turfowner_selected_turf', JSON.stringify(turf));
  };

  return (
    <AuthContext.Provider value={{ user, turfs, selectedTurf, login, logout, switchTurf }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
