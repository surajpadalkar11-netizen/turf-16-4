import api from './api';

export const getWallet = () => api.get('/wallet');

export const createWalletOrder = (amount) =>
  api.post('/wallet/create-order', { amount });

export const verifyWalletPayment = (paymentData) =>
  api.post('/wallet/verify-payment', paymentData);

export const payBookingWithWallet = (bookingId, amount) =>
  api.post('/wallet/pay-booking', { bookingId, amount });
