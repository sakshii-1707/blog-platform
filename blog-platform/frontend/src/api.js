import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

// --- Simple API helper for all microservice calls through the gateway
const api = axios.create({
  baseURL: '/api/v1', // Use relative path for React dev server proxy
  headers: { 'X-Correlation-ID': uuidv4() }
});

export function setAuthToken(token) {
  if (token) api.defaults.headers.common['Authorization'] = 'Bearer ' + token;
  else delete api.defaults.headers.common['Authorization'];
}

export default api;
