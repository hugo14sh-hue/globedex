/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { APP_NAME, DEFAULT_THEME_COLOR, DEFAULT_BACKGROUND } from './src/config.ts';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'app-name-i-html',
      transformIndexHtml: (html) => html.replaceAll('%APP_NAME%', APP_NAME),
    },
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['logo/*.svg', 'favicon-16.png', 'favicon-32.png', 'apple-touch-icon.png'],
      manifest: {
        name: APP_NAME,
        short_name: APP_NAME,
        // Installationens språk är svenska (grunden). Appen byter själv språk efter valet i Anpassning.
        lang: 'sv',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: DEFAULT_THEME_COLOR,
        background_color: DEFAULT_BACKGROUND,
        icons: [
          { src: '/pwa-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/pwa-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: '/pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // Flaggorna (cirka 250 filer) läggs inte i installationen. De hämtas när de visas och sparas då.
        globIgnores: ['flags/**'],
        navigateFallback: '/index.html',
        // Offline: senast hämtade data går att läsa utan uppkoppling. Skrivningar cachas och köas aldrig
        // (bara GET matchas här, och appen stoppar skrivningar utan uppkoppling i src/lib/offline.ts).
        // Cachen supabase-data töms vid utloggning. Valvet ligger bara som chiffertext i den.
        runtimeCaching: [
          {
            urlPattern: ({ url, request }) => request.method === 'GET' && url.pathname.startsWith('/rest/v1/'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-data',
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 400, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            // Kartans stil, sprites och tile-index från OpenFreeMap.
            urlPattern: ({ url }) =>
              url.origin === 'https://tiles.openfreemap.org' && !url.pathname.endsWith('.pbf'),
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'karta-stil', expiration: { maxEntries: 40 }, cacheableResponse: { statuses: [200] } },
          },
          {
            // Kartrutor och typsnitt till kartan: högst 1500 filer (ungefär 50–100 MB) i 30 dagar.
            urlPattern: ({ url }) => url.origin === 'https://tiles.openfreemap.org' && url.pathname.endsWith('.pbf'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'karta-rutor',
              expiration: { maxEntries: 1500, maxAgeSeconds: 60 * 60 * 24 * 30, purgeOnQuotaError: true },
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            // Höjddata för Terräng 3D.
            urlPattern: ({ url }) => url.hostname === 's3.amazonaws.com' && url.pathname.startsWith('/elevation-tiles-prod/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'karta-hojd',
              expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 30, purgeOnQuotaError: true },
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            // Ländernas gränser (public/geo), för stor för att läggas i installationen.
            urlPattern: ({ url }) => url.pathname.startsWith('/geo/'),
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'geodata', expiration: { maxEntries: 5 } },
          },
          {
            // Landsflaggor (public/flags), bara de som har visats.
            urlPattern: ({ url }) => url.pathname.startsWith('/flags/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'flaggor',
              expiration: { maxEntries: 120, maxAgeSeconds: 60 * 60 * 24 * 90 },
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            urlPattern: ({ url }) => url.origin === 'https://fonts.googleapis.com',
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts-css' },
          },
          {
            urlPattern: ({ url }) => url.origin === 'https://fonts.gstatic.com',
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-filer',
              expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  build: {
    // Kartmotorn (MapLibre, cirka 1 MB) är den enda stora delen. Den laddas för sig, först när kartan visas.
    chunkSizeWarningLimit: 1100,
  },
  test: {
    environment: 'node',
    // Röktestet i e2e/ körs med Playwright (npm run test:e2e), inte med vitest.
    exclude: ['e2e/**', 'node_modules/**', 'dist/**'],
  },
});
