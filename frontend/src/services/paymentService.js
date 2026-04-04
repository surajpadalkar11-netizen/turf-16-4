import api from './api';

export const createPaymentOrder = (bookingId, payAmount) =>
  api.post('/payments/create-order', { bookingId, payAmount });
export const verifyPayment = (data) => api.post('/payments/verify', data);
export const getPayment = (id) => api.get(`/payments/${id}`);

