import api from './api';

export const getStats = (range = 'all', startDate, endDate) => {
  let url = `/admin/stats?range=${range}`;
  if (range === 'custom' && startDate && endDate) {
    url += `&startDate=${startDate}&endDate=${endDate}`;
  }
  return api.get(url);
};
