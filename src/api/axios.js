import axios from 'axios';

const api = axios.create({
  // Produсtion (Render) uchun
  baseURL: 'https://taxta-crm-8.onrender.com/api',
  // baseURL: 'http://localhost:5000/api',
  headers: { 'Content-Type': 'application/json' },
});

// Har bir so'rovga token qo'shish
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  console.log(`🚀 Frontend so'rov yubormoqda: ${config.method.toUpperCase()} ${config.url}`);
  return config;
});

// Javoblarni tekshirish
api.interceptors.response.use(
  (response) => {
    console.log(`✅ Backenddan javob keldi:`, response.status);
    return response;
  },
  (error) => {
    console.error(`❌ Backendda xatolik:`, error.response?.status || error.message);
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
