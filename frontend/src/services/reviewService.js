import api from './api';

export const getTurfReviews = (turfId, params) => api.get(`/reviews/turf/${turfId}`, { params });
export const getMyReviews = (params) => api.get('/reviews/my', { params });
export const createReview = (data) => api.post('/reviews', data);
export const deleteReview = (id) => api.delete(`/reviews/${id}`);
