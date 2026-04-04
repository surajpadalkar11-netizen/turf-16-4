import { createContext, useState, useEffect, useContext } from 'react';
import * as authService from '../services/authService';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('turfbook_token');
    const savedUser = localStorage.getItem('turfbook_user');
    if (token && savedUser) {
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    const { data } = await authService.login({ email, password });
    localStorage.setItem('turfbook_token', data.token);
    localStorage.setItem('turfbook_user', JSON.stringify(data.user));
    setUser(data.user);
    return data;
  };

  const register = async (name, email, password, phone) => {
    const { data } = await authService.register({ name, email, password, phone });
    localStorage.setItem('turfbook_token', data.token);
    localStorage.setItem('turfbook_user', JSON.stringify(data.user));
    setUser(data.user);
    return data;
  };

  const googleLogin = async (credential) => {
    const { data } = await authService.googleAuth(credential);
    localStorage.setItem('turfbook_token', data.token);
    localStorage.setItem('turfbook_user', JSON.stringify(data.user));
    setUser(data.user);
    return data;
  };

  const logout = () => {
    localStorage.removeItem('turfbook_token');
    localStorage.removeItem('turfbook_user');
    setUser(null);
  };

  const updateUser = (userData) => {
    setUser(userData);
    localStorage.setItem('turfbook_user', JSON.stringify(userData));
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, googleLogin, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}

export default AuthContext;
