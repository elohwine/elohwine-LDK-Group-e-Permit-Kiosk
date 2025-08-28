/* eslint-disable no-undef */
// Custom service worker for next-pwa (injectManifest mode)

import { clientsClaim } from 'workbox-core';
import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching';
import { registerRoute, setCatchHandler } from 'workbox-routing';
import { NetworkFirst, StaleWhileRevalidate, CacheFirst, NetworkOnly } from 'workbox-strategies';
import { BackgroundSyncPlugin } from 'workbox-background-sync';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

self.skipWaiting();
clientsClaim();

// Inject precache manifest
precacheAndRoute(self.__WB_MANIFEST || []);
cleanupOutdatedCaches();

// Offline fallback for navigation requests
const OFFLINE_URL = '/offline.html';
registerRoute(
  ({ request }) => request.mode === 'navigate',
  new NetworkFirst({
    cacheName: 'pages',
    plugins: [
      new CacheableResponsePlugin({ statuses: [200] }),
      new ExpirationPlugin({ maxEntries: 50, purgeOnQuotaError: true })
    ],
  })
);

setCatchHandler(async ({ event }) => {
  if (event.request.mode === 'navigate') {
    const cache = await caches.open('static-fallbacks');
    let cached = await cache.match(OFFLINE_URL);
    if (!cached) {
      try {
        const res = await fetch(OFFLINE_URL, { cache: 'reload' });
        if (res && res.ok) await cache.put(OFFLINE_URL, res.clone());
        cached = res;
      } catch {}
    }
    if (cached) return cached;
  }
  return Response.error();
});

// Share target endpoint: keep it available quickly
registerRoute(
  ({ url, request }) => request.method === 'GET' && url.pathname === '/share',
  new NetworkFirst({ cacheName: 'share-target' })
);

// File handlers endpoint: GET landing page and POST form-data routing
registerRoute(
  ({ url, request }) => request.method === 'GET' && url.pathname === '/open-file',
  new NetworkFirst({ cacheName: 'file-handler' })
);

// Static assets: images
registerRoute(
  ({ request }) => request.destination === 'image',
  new CacheFirst({
    cacheName: 'images',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 }) // 30 days
    ],
  })
);

// Static assets: scripts/styles/fonts
registerRoute(
  ({ request }) => ['style', 'script', 'worker', 'font'].includes(request.destination),
  new StaleWhileRevalidate({ cacheName: 'assets' })
);

// API GET caching
registerRoute(
  ({ url, request }) => request.method === 'GET' && url.pathname.startsWith('/api/'),
  new NetworkFirst({ cacheName: 'api-get', networkTimeoutSeconds: 5 })
);

// Background Sync for mutating API requests
const permitQueue = new BackgroundSyncPlugin('permit-queue', {
  maxRetentionTime: 24 * 60, // minutes
});

registerRoute(
  ({ url, request }) => ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method) && url.pathname.startsWith('/api/'),
  new NetworkOnly({ plugins: [permitQueue] }),
  'POST'
);

// Periodic background sync (requires user grant and support)
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'epermit-update') {
    event.waitUntil(fetch('/api/permits?health=1').catch(() => {}));
  }
});

// Push notifications
self.addEventListener('push', (event) => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch {}
  const title = payload.title || 'ePermit update';
  const options = {
    body: payload.body || 'There is a new update available.',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data: payload.data || {},
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification?.data?.url || '/';
  event.waitUntil(
    (async () => {
      const allClients = await clients.matchAll({ type: 'window', includeUncontrolled: true });
      const hadWindow = allClients.find((c) => c.url.includes(self.location.origin));
      if (hadWindow) {
        hadWindow.focus();
        if (url) hadWindow.navigate(url);
      } else {
        clients.openWindow(url);
      }
    })()
  );
});
