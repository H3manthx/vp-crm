import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // send anything starting with /api to your backend
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        secure: false,
        ws: false,
        // keep `/api` as-is
        rewrite: p => p,
      },
    },
  },
});