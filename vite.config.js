import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/lynch-screener/',  // ← GitHub 레포 이름과 맞춰주세요
  server: {
    port: 5173,
  },
});