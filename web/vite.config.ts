import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';
import { readFileSync } from 'fs';

// Truthful build version (s258, closes the S254 "reports 1.0.0" finding).
// npm sets npm_package_version under `npm run`, but `vite build` invoked
// directly does not — so fall back to reading package.json. Exposed to the app
// as the __APP_VERSION__ compile-time constant.
const appVersion = process.env.npm_package_version
  || JSON.parse(readFileSync(path.resolve(__dirname, 'package.json'), 'utf-8')).version;

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: false, // Using public/manifest.json
      workbox: {
        // Force new SW to activate immediately, don't wait for old tabs to close
        skipWaiting: true,
        clientsClaim: true,
        // Purge old caches from previous builds
        cleanupOutdatedCaches: true,
        // S243 slice 2: pull the hand-written push/notificationclick handlers into
        // the generated SW. generateSW stays — do NOT switch to injectManifest.
        importScripts: ['push-sw.js'],
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            // Cache Supabase REST API GET requests (gigs, profiles, away_dates)
            urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/v1\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-api',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24, // 24 hours
              },
              networkTimeoutSeconds: 10,
            },
          },
          {
            // Cache Google Fonts
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, '../shared'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'public-site': ['./src/components/PublicSite.tsx'],
          'media': ['./src/components/MediaManager.tsx', './src/components/Enquiries.tsx'],
          'invoicing': [
            './src/components/Dashboard.tsx',
            './src/components/InvoiceList.tsx',
            './src/components/InvoiceForm.tsx',
            './src/components/InvoiceDetail.tsx',
            './src/components/InvoicePreview.tsx',
            './src/components/QuoteList.tsx',
            './src/components/QuoteForm.tsx',
            './src/components/QuoteDetail.tsx',
            './src/components/QuotePreview.tsx',
            './src/components/Settings.tsx',
            './src/components/ClientList.tsx',
            './src/components/VenueList.tsx',
            './src/components/VenueDetail.tsx',
          ],
        },
      },
    },
  },
});
