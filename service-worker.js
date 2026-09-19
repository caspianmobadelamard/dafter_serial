/* ============================================================
   دفتر سریال کاسپین — Service Worker
   استراتژی: Cache-First برای assets، Network-Only برای API
============================================================ */

const CACHE_NAME = 'caspian-v2.0.0';
const RUNTIME_CACHE = 'caspian-runtime-v2';

// فایل‌های اصلی که باید کش شوند
const PRECACHE_ASSETS = [
  './',
  './order_log.html',
  './manifest.json',
  './icon-android.png',
  './icon-ios.png'
];

/* ============================================================
   Install — پیش‌کش کردن assets
============================================================ */
self.addEventListener('install', (event) => {
  console.log('[SW] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return Promise.allSettled(
          PRECACHE_ASSETS.map(url =>
            cache.add(url).catch(err => console.warn('[SW] Skip cache:', url, err))
          )
        );
      })
      .then(() => self.skipWaiting())
  );
});

/* ============================================================
   Activate — پاک کردن کش‌های قدیمی
============================================================ */
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...');
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter(name => name !== CACHE_NAME && name !== RUNTIME_CACHE)
            .map(name => {
              console.log('[SW] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => self.clients.claim())
  );
});

/* ============================================================
   Fetch — استراتژی هوشمند
============================================================ */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // ۱. درخواست‌های Google Apps Script — همیشه از شبکه (Network-Only)
  if (url.hostname === 'script.google.com' ||
      url.hostname === 'script.googleusercontent.com' ||
      url.hostname.includes('googleusercontent')) {
    event.respondWith(
      fetch(request).catch(() => {
        // اگر آفلاین بود، پیام خطا برگردون
        return new Response(
          JSON.stringify({ error: 'offline', offline: true }),
          { status: 503, headers: { 'Content-Type': 'application/json' } }
        );
      })
    );
    return;
  }

  // ۲. درخواست‌های POST — همیشه از شبکه (نمی‌تونیم کش کنیم)
  if (request.method !== 'GET') {
    event.respondWith(fetch(request));
    return;
  }

  // ۳. درخواست‌های CDN (فونت، کتابخانه) — Stale-While-Revalidate
  if (url.hostname.includes('cdn.') || url.hostname.includes('fonts.')) {
    event.respondWith(
      caches.open(RUNTIME_CACHE).then((cache) => {
        return cache.match(request).then((cached) => {
          const fetchPromise = fetch(request).then((response) => {
            if (response && response.status === 200) {
              cache.put(request, response.clone());
            }
            return response;
          }).catch(() => cached);
          return cached || fetchPromise;
        });
      })
    );
    return;
  }

  // ۴. بقیه درخواست‌ها (HTML، آیکون، ...) — Cache-First با fallback
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request).then((response) => {
        // فقط پاسخ‌های موفق را کش کن
        if (!response || response.status !== 200 || response.type === 'opaque') {
          return response;
        }
        const copy = response.clone();
        caches.open(RUNTIME_CACHE).then((cache) => {
          cache.put(request, copy).catch(() => {});
        });
        return response;
      }).catch(() => {
        // اگر درخواست HTML بود و آفلاین، صفحه اصلی را برگردان
        if (request.mode === 'navigate' || request.destination === 'document') {
          return caches.match('./order_log.html');
        }
        return new Response('Offline', { status: 503 });
      });
    })
  );
});

/* ============================================================
   Message — ارتباط با صفحه اصلی
============================================================ */
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    caches.keys().then(names => Promise.all(names.map(n => caches.delete(n))));
  }
});
