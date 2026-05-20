const CACHE_NAME = 'zupii-v2';

// Sadece statik dosyalar cache'lenir — kullanıcı verisi asla!
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/logo192.png',
  '/logo512.png',
  '/favicon.ico',
];

// Kurulum: statik dosyaları önbelleğe al
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

// Fetch: statik dosyalar cache'den, API/Firebase istekleri her zaman ağdan
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Firebase, R2, Cloudflare isteklerini her zaman ağdan al (kullanıcı verisi)
  if (
    url.hostname.includes('firebaseio.com') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('firebaseapp.com') ||
    url.hostname.includes('cloudflarestorage.com') ||
    url.hostname.includes('workers.dev') ||
    url.hostname.includes('cloudflarestream.com')
  ) {
    return; // cache'e dokunma, ağdan al
  }

  // Statik dosyalar: önce cache, yoksa ağdan al
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
