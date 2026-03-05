import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: false, // Using public/manifest.json
      workbox: {
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
