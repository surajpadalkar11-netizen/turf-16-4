import api from './api';

export const getTurfs = (params) => api.get('/turfs', { params });
export const getTurf = (id) => api.get(`/turfs/${id}`);
export const createTurf = (data) => api.post('/turfs', data);
export const updateTurf = (id, data) => api.put(`/turfs/${id}`, data);
export const deleteTurf = (id) => api.delete(`/turfs/${id}`);
export const uploadImage = (formData) => api.post('/upload', formData, {
  headers: { 'Content-Type': 'multipart/form-data' },
});
