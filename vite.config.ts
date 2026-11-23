import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // Ask before switching to a new version, so an open form is never reloaded mid-edit.
      registerType: 'prompt',
      injectRegister: false,
      manifest: {
        name: 'Ear Punch Tracker',
        short_name: 'Ear Punch',
        description: 'Record and look up mouse ear punch patterns. Works offline; data stays on this device.',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'any',
        background_color: '#f6f5f1',
        theme_color: '#185FA5',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Precache the whole app shell so it opens with no network at all.
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  // Relative paths: the build works from any folder or sub-path of a static host.
  base: './',
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
