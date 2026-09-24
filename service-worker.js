/************************************************************
 * دفتر سریال کاسپین — Service Worker
 * نسخه cache: caspian-serial-v15
 ************************************************************/

const CACHE_NAME = 'caspian-serial-v15';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-ios.png',
  './icon-android.png'
];

// نصب: کش کردن فایل‌ها
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return Promise.all(
        ASSETS.map(url => {
          return cache.add(url).catch(err => {
            console.warn('cache miss:', url, err);
          });
        })
      );
    })
  );
});

// فعال‌سازی: پاک کردن کش‌های قدیمی
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Fetch: استراتژی متفاوت برای هر نوع درخواست
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = event.request.url;

  // Google Apps Script → مستقیم از شبکه
  if (url.indexOf('script.google.com') !== -1) {
    event.respondWith(fetch(event.request));
    return;
  }

  // فایل‌های Google Fonts → cache-first (چون تغییر نمی‌کنن)
  if (url.indexOf('fonts.googleapis.com') !== -1 || url.indexOf('fonts.gstatic.com') !== -1) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        return cached || fetch(event.request).then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        }).catch(() => new Response('', { status: 404 }));
      })
    );
    return;
  }

  // HTML و درخواست‌های document → network-first (همیشه جدیدترین رو بگیر)
  if (event.request.destination === 'document' || url.endsWith('/index.html') || url.endsWith('/')) {
    event.respondWith(
      fetch(event.request).then(response => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return response;
      }).catch(() => {
        return caches.match('./index.html');
      })
    );
    return;
  }

  // بقیه (تصاویر، manifest، CSS، JS) → cache-first با به‌روزرسانی
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return response;
      }).catch(() => {
        return caches.match('./index.html');
      });
    })
  );
});

// پیام از سمت کلاینت (اختیاری برای skipWaiting دستی)
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
