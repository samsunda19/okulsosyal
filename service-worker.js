const CACHE_NAME = 'zupii-v6';

// Sadece degismeyen statik dosyalar cache'lenir — index.html ASLA!
const STATIC_ASSETS = [
  '/manifest.json',
  '/logo192.png',
  '/logo512.png',
  '/favicon.ico',
];

// Kurulum: statik dosyalari onbellege al
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Aktivasyon: eski cache'leri temizle
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Firebase, R2, Cloudflare istekleri her zaman agdan (kullanici verisi)
  if (
    url.hostname.includes('firebaseio.com') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('firebaseapp.com') ||
    url.hostname.includes('cloudflarestorage.com') ||
    url.hostname.includes('workers.dev') ||
    url.hostname.includes('cloudflarestream.com')
  ) {
    return; // cache'e dokunma
  }

  // HTML / navigasyon istekleri: HER ZAMAN once agdan al (network-first)
  // Boylece yeni deploy aninda gelir, beyaz ekran olmaz
  if (event.request.mode === 'navigate' || event.request.destination === 'document') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('/index.html'))
    );
    return;
  }

  // JS/CSS gibi build dosyalari: once agdan dene, olmazsa cache (network-first)
  // CRA build dosyalari hash'li oldugu icin guvenli
  if (url.pathname.startsWith('/static/')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const kopya = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, kopya));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Diger statik dosyalar: once cache, yoksa agdan
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});