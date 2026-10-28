/************************************************************
 * دفتر سریال کاسپین — Service Worker v17
 * (با اصلاح کامل مشکلات کش و پشتیبانی از سرور محلی/تیل‌اسکیل)
 ************************************************************/

const CACHE_NAME = 'caspian-serial-v17';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-ios.png',
  './icon-android.png'
];

// نصب: کش کردن فایل‌های ثابت
self.addEventListener('install', event => {
  self.skipWaiting(); // اجبار به فعال‌سازی نسخه جدید
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return Promise.all(
        ASSETS.map(url => cache.add(url).catch(err => console.warn('Cache miss:', url, err)))
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
  self.clients.claim(); // کنترل فوری تمام تب‌های باز
});

// Fetch: استراتژی هوشمند
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = event.request.url;

  // ۱. درخواست‌های مربوط به سرور محلی (پایتون، لوکال‌هاست، تیل‌اسکیل) یا گوگل شیت
  // این درخواست‌ها هرگز کش نمی‌شن و مستقیم به شبکه میرن
  if (
    url.includes('/api') || 
    url.includes('script.google.com') || 
    url.includes('127.0.0.1') || 
    url.includes('localhost') || 
    /^http:\/\/(\d{1,3}\.){3}\d{1,3}:/.test(url) || // هر IP معتبری مثل 192.168.x.x یا 100.x.x.x
    url.includes('eitaayar.ir')
  ) {
    event.respondWith(
      fetch(event.request).catch(() => {
        return new Response(
          JSON.stringify({ ok: false, error: 'ارتباط با سرور برقرار نشد (آفلاین)' }),
          { status: 503, headers: { 'Content-Type': 'application/json' } }
        );
      })
    );
    return;
  }

  // ۲. فونت‌های گوگل: اول از کش، بعد از شبکه
  if (url.includes('fonts.googleapis.com') || url.includes('fonts.gstatic.com')) {
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

  // ۳. فایل اصلی HTML و درخواست‌های Document: استراتژی Network-First
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

  // ۴. سایر فایل‌های ثابت (آیکون‌ها): استراتژی Cache-First
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

// پیام از سمت کلاینت برای آپدیت دستی
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
