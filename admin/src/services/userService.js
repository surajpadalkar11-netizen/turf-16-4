import api from './api';

export const getUsers = (params) => api.get('/admin/users', { params });
export const updateUserRole = (id, role) => api.put(`/admin/users/${id}/role`, { role });
export const deleteUser = (id) => api.delete(`/admin/users/${id}`);
