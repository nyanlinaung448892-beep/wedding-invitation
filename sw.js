// =============================================================================
// sw.js — Service Worker for Digital Wedding Invitation
// Provides 100% Offline Caching for Shell, Data, and Couple Photos
// =============================================================================

const SHELL_CACHE_NAME = 'wedding-shell-v15';
const PHOTO_CACHE_NAME = 'wedding-invitation-photos-v2';

const SHELL_ASSETS = [
  './',
  './index.html',
  './404.html',
  './css/global.css?v=15',
  './js/engine.js?v=15',
  './js/supabase-config.js',
  './js/calendar.js',
  './templates/registry.json?v=15',
  './templates/floral-pink/layout.html?v=15',
  './templates/floral-pink/style.css?v=15',
  './templates/floral-pink/script.js?v=15',
  './templates/neon-birthday/layout.html?v=15',
  './templates/neon-birthday/style.css?v=15',
  './templates/neon-birthday/script.js?v=15',
  './templates/biz-card-minimal/layout.html?v=15',
  './templates/biz-card-minimal/style.css?v=15',
  './templates/biz-card-minimal/script.js?v=15',
  './data/fallback-invitations.json?v=15',
  './assets/images/couple-portrait-default.jpg',
  './assets/images/wedding-memory-default.jpg'
];

// Install: Pre-cache app shell assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE_NAME).then((cache) => {
      return cache.addAll(SHELL_ASSETS).catch((err) => {
        console.warn('[SW] Pre-cache partial warning:', err);
      });
    })
  );
  self.skipWaiting();
});

// Activate: Clean up older cache versions
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== SHELL_CACHE_NAME && key !== PHOTO_CACHE_NAME)
            .map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Fetch: Smart Caching Strategy
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Ignore non-GET requests
  if (request.method !== 'GET') return;

  // 1. Photo requests (Supabase storage or image assets)
  const isImage = request.destination === 'image' || url.pathname.match(/\.(jpg|jpeg|png|webp|gif|svg)$/i);
  if (isImage) {
    event.respondWith(
      caches.open(PHOTO_CACHE_NAME).then(async (photoCache) => {
        const cached = await photoCache.match(request);
        if (cached) {
          // Stale-while-revalidate in background if online
          if (navigator.onLine) {
            fetch(request).then((res) => {
              if (res && res.ok) photoCache.put(request, res.clone());
            }).catch(() => {});
          }
          return cached;
        }

        // Not in cache: fetch from network and store
        return fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.ok) {
            photoCache.put(request, networkResponse.clone());
          }
          return networkResponse;
        }).catch(async () => {
          // Offline fallback
          const defaultPortrait = await caches.match('./assets/images/couple-portrait-default.jpg');
          return defaultPortrait || new Response('', { status: 404, statusText: 'Offline Photo Not Found' });
        });
      })
    );
    return;
  }

  // 2. Navigation / Page Shell requests
  event.respondWith(
    fetch(request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.ok) {
          const clone = networkResponse.clone();
          caches.open(SHELL_CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return networkResponse;
      })
      .catch(async () => {
        // Offline: Serve cached match or fallback to index.html for navigation
        const cachedResponse = await caches.match(request);
        if (cachedResponse) return cachedResponse;
        if (request.mode === 'navigate') {
          return caches.match('./index.html');
        }
        return new Response('Offline', { status: 503, statusText: 'Offline' });
      })
  );
});

// ─── Message Handler: Schedule Wedding Reminder Notification ─────────────────
self.addEventListener('message', (event) => {
  if (!event.data || event.data.type !== 'SCHEDULE_WEDDING_REMINDER') return;
  const { reminderData } = event.data;
  if (!reminderData || reminderData.fired) return;

  const { groomName = '', brideName = '', weddingDate = '', reminderTime, venueName = '' } = reminderData;
  const msUntilReminder = reminderTime - Date.now();
  if (msUntilReminder <= 0) return;

  // Schedule in-SW notification (works while SW is alive)
  setTimeout(async () => {
    try {
      await self.registration.showNotification(
        `${groomName} & ${brideName} မင်္ဂလာပွဲ 💍`,
        {
          body   : `ယနေ့ မင်္ဂလာပွဲ ရှိသည်! ၀၉:၃၀ ကြွရောက်ပါ — ${venueName}`,
          icon   : './assets/images/wedding-memory-default.jpg',
          badge  : './assets/images/wedding-memory-default.jpg',
          tag    : `wedding-reminder-${weddingDate}`,
          vibrate: [200, 100, 200],
          data   : { weddingDate, url: self.registration.scope },
        }
      );
    } catch (err) {
      console.warn('[SW] Notification error:', err);
    }
  }, msUntilReminder);
});

// ─── Notification Click: Open/Focus the Invitation Page ──────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || self.registration.scope;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.startsWith(self.registration.scope) && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    })
  );
});
