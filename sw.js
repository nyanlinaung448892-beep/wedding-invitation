// =============================================================================
// sw.js — Service Worker for Digital Wedding Invitation
// Provides 100% Offline Caching for Shell, Data, and Couple Photos
// =============================================================================

const SHELL_CACHE_NAME = 'wedding-shell-v23';
const PHOTO_CACHE_NAME = 'wedding-invitation-photos-v2';

const SHELL_ASSETS = [
  './',
  './index.html',
  './404.html',
  './css/global.css?v=23',
  './js/engine.js?v=23',
  './js/supabase-config.js',
  './js/calendar.js',
  './templates/registry.json?v=23',
  './templates/floral-pink/layout.html?v=23',
  './templates/floral-pink/style.css?v=23',
  './templates/floral-pink/script.js?v=23',
  './templates/neon-birthday/layout.html?v=23',
  './templates/neon-birthday/style.css?v=23',
  './templates/neon-birthday/script.js?v=23',
  './templates/biz-card-gold/layout.html?v=23',
  './templates/biz-card-gold/style.css?v=23',
  './templates/biz-card-gold/script.js?v=23',
  './data/fallback-invitations.json?v=23',
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

  // Let Supabase REST API data requests pass directly to network without SW interference
  if (url.origin.includes('supabase.co') && !url.pathname.includes('/storage/v1/object/public/')) {
    return;
  }

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

  // 2. Navigation / Page Shell requests (Fast App Shell Navigation with Instant 0ms Cache)
  event.respondWith(
    (async () => {
      // For page navigation (e.g. index.html?id=... or root entry), serve precached index.html shell instantly
      if (request.mode === 'navigate') {
        const cachedShell = await caches.match('./index.html') || await caches.match('index.html');
        if (cachedShell) {
          if (navigator.onLine) {
            fetch(request).then((res) => {
              if (res && res.ok) {
                caches.open(SHELL_CACHE_NAME).then((c) => c.put('./index.html', res));
              }
            }).catch(() => {});
          }
          return cachedShell;
        }
      }

      const cached = await caches.match(request);

      // If returning visitor and cached asset exists for static shells (css, js, template html, data):
      // Return cached immediately and revalidate in background!
      const isStaticShell = url.pathname.includes('/css/') ||
                            url.pathname.includes('/js/') ||
                            url.pathname.includes('/templates/') ||
                            url.pathname.includes('/data/');

      if (cached && isStaticShell) {
        if (navigator.onLine) {
          fetch(request).then((res) => {
            if (res && res.ok) {
              caches.open(SHELL_CACHE_NAME).then((c) => c.put(request, res));
            }
          }).catch(() => {});
        }
        return cached;
      }

      // For Navigation or first-load shells: Race network with 2500ms timeout
      const networkPromise = fetch(request).then((networkResponse) => {
        if (networkResponse && networkResponse.ok) {
          const clone = networkResponse.clone();
          caches.open(SHELL_CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return networkResponse;
      });

      if (!cached) {
        // First-time visitor without cache: wait for network
        return networkPromise.catch(async () => {
          if (request.mode === 'navigate') {
            const fallback = await caches.match('./index.html');
            if (fallback) return fallback;
          }
          return new Response('Offline', { status: 503, statusText: 'Offline' });
        });
      }

      // If cached exists but not static shell: race 2500ms
      const timeoutPromise = new Promise((resolve) => {
        setTimeout(() => resolve(null), 2500);
      });

      const fastRes = await Promise.race([networkPromise, timeoutPromise]);
      if (fastRes) return fastRes;

      // Network didn't respond within 2.5s on slow mobile link — serve cached immediately!
      networkPromise.catch(() => {});
      return cached;
    })()
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
