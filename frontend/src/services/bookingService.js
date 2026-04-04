import api from './api';

export const createBooking = (data) => api.post('/bookings', data);
export const getMyBookings = (params) => api.get('/bookings/my', { params });
export const getBooking = (id) => api.get(`/bookings/${id}`);
export const cancelBooking = (id) => api.put(`/bookings/${id}/cancel`);
export const getAllBookings = (params) => api.get('/bookings/admin/all', { params });
