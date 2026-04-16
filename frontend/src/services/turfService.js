import api from './api';

export const getTurfs = (params) => api.get('/turfs', { params });
export const getTurf = (id) => api.get(`/turfs/${id}`);
export const getFeaturedTurfs = () => api.get('/turfs/featured');
export const getCities = () => api.get('/turfs/cities');
export const getAvailableSlots = (id, date, interval = 60) => api.get(`/turfs/${id}/slots`, { params: { date, interval } });
export const createTurf = (data) => api.post('/turfs', data);
export const updateTurf = (id, data) => api.put(`/turfs/${id}`, data);
export const deleteTurf = (id) => api.delete(`/turfs/${id}`);
