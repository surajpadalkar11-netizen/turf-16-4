import api from './api';

export const getAllBookings = (params) => api.get('/bookings/admin/all', { params });
export const getBooking = (id) => api.get(`/bookings/${id}`);
export const updateBookingStatus = (id, status) => api.put(`/admin/bookings/${id}/status`, { status });
export const processRefund = (id, amount) => api.put(`/admin/bookings/${id}/refund`, { amount });
export const cancelBooking = (id) => api.put(`/bookings/${id}/cancel`);
