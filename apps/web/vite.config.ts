import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  base: process.env['GITHUB_ACTIONS'] ? '/portfolio-margin/' : '/',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@portfolio-margin/core': path.resolve(__dirname, '../../packages/core/src/index.ts'),
      '@portfolio-margin/market-data': path.resolve(
        __dirname,
        '../../packages/market-data/src/index.ts',
      ),
    },
  },
});
