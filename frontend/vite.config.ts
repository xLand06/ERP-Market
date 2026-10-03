import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'favicon.webp', 'favicon-32x32.png', 'favicon-16x16.png', 'logo-allmarket.webp', 'apple-touch-icon.png'],
      manifest: {
        name: 'ALL MARKET — ERP para Bodegas',
        short_name: 'ALL MARKET',
        description: 'Sistema de punto de venta e inventario para bodegas venezolanas',
        theme_color: '#059669',
        background_color: '#f8fafc',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          {
            src: 'favicon-32x32.png',
            sizes: '32x32',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'favicon.webp',
            sizes: '96x96',
            type: 'image/webp',
            purpose: 'any',
          },
          {
            src: 'logo-allmarket.webp',
            sizes: '512x512',
            type: 'image/webp',
            purpose: 'any maskable',
          },
          {
            src: 'apple-touch-icon.png',
            sizes: '180x180',
            type: 'image/png',
            purpose: 'any',
          },
        ],
      },
      workbox: {
        // Cache the SPA shell and all static assets
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff2}'],
        // Don't cache API calls — those go through the backend
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api/],
        // Runtime caching for API calls when online
        runtimeCaching: [
          {
            // Cache GET API responses for offline fallback
            urlPattern: /^\/api\/(products|inventory|branches|settings|customers|groups|suppliers)/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60, // 1 hour
              },
              networkTimeoutSeconds: 5,
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            // Cache product images
            urlPattern: /\.(png|jpg|jpeg|svg|gif|webp)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'image-cache',
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
              },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Split third-party code out of the entry chunk so the app shell stays
        // small and vendor code is cached independently between deploys.
        // Function form (instead of the object form) because bare specifier
        // matching is unreliable with pnpm's nested `node_modules/.pnpm/...` paths.
        manualChunks(id: string) {
          const posix = id.replace(/\\/g, '/');
          if (!posix.includes('/node_modules/')) return undefined;

          const matches = posix.match(/\/node_modules\/((?:@[^/]+\/)?[^/]+)/g);
          const pkg = matches?.[matches.length - 1]?.replace('/node_modules/', '');

          switch (pkg) {
            // React core (+ its scheduler and store shim)
            case 'react':
            case 'react-dom':
            case 'scheduler':
            case 'use-sync-external-store':
              return 'vendor-react';
            // Data fetching
            case '@tanstack/react-query':
            case '@tanstack/query-core':
              return 'vendor-query';
            // Client state
            case 'zustand':
              return 'vendor-store';
            // Icon set (lucide-react icons are individually tree-shaken)
            case 'lucide-react':
              return 'vendor-icons';
            // Routing
            case 'react-router':
            case 'react-router-dom':
            case '@remix-run/router':
              return 'vendor-router';
            // Internationalization
            case 'i18next':
            case 'i18next-browser-languagedetector':
            case 'i18next-http-backend':
            case 'react-i18next':
              return 'vendor-i18n';
            // HTTP client
            case 'axios':
              return 'vendor-http';
            default:
              return undefined;
          }
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
  server: {
    host: true,
    port: 5175,
    strictPort: true,
    open: false,
    proxy: {
      "/api": {
        target: `${process.env.BACKEND_URL}`,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
});
