/************************************************************
 * دفتر سریال کاسپین — Service Worker
 * نسخه cache: caspian-serial-v16
 ************************************************************/

const CACHE_NAME = 'caspian-serial-v16';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-ios.png',
  './icon-android.png'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return Promise.all(
        ASSETS.map(url => cache.add(url).catch(err => console.warn('cache miss:', url, err)))
      );
    })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = event.request.url;

  // ⬇️ هر درخواستی که به API، لوکال‌هاست، تیل‌اسکیل یا گوگل بره، مستقیم به شبکه فرستاده میشه (نه کش) ⬇️
  if (url.indexOf('/api') !== -1 || 
      url.indexOf('script.google.com') !== -1 ||
      url.indexOf('127.0.0.1') !== -1 || 
      url.indexOf('localhost') !== -1 ||
      /^http:\/\/\d+\.\d+\.\d+\.\d+:/.test(url)) {
    event.respondWith(fetch(event.request));
    return;
  }

  // فونت‌های گوگل
  if (url.indexOf('fonts.googleapis.com') !== -1 || url.indexOf('fonts.gstatic.com') !== -1) {
    event.respondWith(
      caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return response;
      }).catch(() => new Response('', { status: 404 })))
    );
    return;
  }

  // فایل‌های HTML
  if (event.request.destination === 'document' || url.endsWith('/index.html') || url.endsWith('/')) {
    event.respondWith(
      fetch(event.request).then(response => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return response;
      }).catch(() => caches.match('./index.html'))
    );
    return;
  }

  // بقیه فایل‌ها (آیکن و ...)
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return response;
      }).catch(() => caches.match('./index.html'));
    })
  );
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});
