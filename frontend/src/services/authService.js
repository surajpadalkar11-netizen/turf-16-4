import api from './api';

export const login = (data) => api.post('/auth/login', data);
export const register = (data) => api.post('/auth/register', data);
export const googleAuth = (credential) => api.post('/auth/google', { credential });
export const getMe = () => api.get('/auth/me');
export const updateProfile = (data) => api.put('/auth/profile', data);
export const toggleFavorite = (turfId) => api.put(`/auth/favorites/${turfId}`);
