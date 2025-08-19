import axios from 'axios';

const baseURL =
  import.meta.env.VITE_API_URL ||             // provided at build time
  (import.meta.env.DEV ? '/api' : '');        // dev proxy only; no prod fallback

if (!baseURL && import.meta.env.PROD) {
  throw new Error('Missing VITE_API_URL in production build');
}

const api = axios.create({ baseURL });

api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('token');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

export default api;