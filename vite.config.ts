import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: './',
  build: { outDir: 'dist', sourcemap: true },
  test: { include: ['tests/**/*.test.ts'] },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png', 'budget-export.sample.json'],
      manifest: {
        name: 'Lifetime Financial Planner',
        short_name: 'Planner',
        description: 'Income, family, rentals, savings and estate projected year by year.',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'any',
        background_color: '#f4f4f2',
        theme_color: '#2a78d6',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,json,webmanifest}'],
        navigateFallback: 'index.html',
        runtimeCaching: [
          {
            // Budget exports fetched from GitHub or elsewhere: try the network, fall back to the last copy.
            urlPattern: ({ url }) => url.origin !== self.location.origin,
            handler: 'NetworkFirst',
            options: { cacheName: 'budget-exports', networkTimeoutSeconds: 8, expiration: { maxEntries: 10 } },
          },
        ],
      },
    }),
  ],
});
