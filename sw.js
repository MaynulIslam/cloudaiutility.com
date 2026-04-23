const CACHE_NAME = 'toolzzhub-v1';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/pdf-tools.html',
  '/image-tools.html',
  '/file-conversion.html',
  '/qr-code.html',
  '/text-writing.html',
  '/css/style.css',
  '/js/main.js',
  '/pdf/merge.html',
  '/pdf/convert.html',
  '/ocr/scan.html',
  '/esign/request.html',
  '/image/background-remover.html',
  '/image/convert.html',
  '/quick-image-edit/quick_image_edit.html',
  '/qr-code/basic/basic-qr.html',
  '/qr-code/payment/payment-business.html',
  '/qr-code/customization/custom-qr.html',
  '/document-conversion/document_conversion.html',
  '/image-conversion/image_conversion.html',
  '/audio-conversion/audio_conversion.html',
  '/assets/cloudaiutility.png'
];

// Install: cache static shell
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate: purge old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: cache-first for static assets, network-first for API calls
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Always go to network for API calls and cross-origin requests
  if (url.pathname.startsWith('/api/') || url.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;

      return fetch(request).then(response => {
        // Only cache successful same-origin GET responses
        if (!response || response.status !== 200 || request.method !== 'GET') {
          return response;
        }
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        return response;
      }).catch(() => {
        // Offline fallback for navigation requests
        if (request.mode === 'navigate') {
          return caches.match('/index.html');
        }
      });
    })
  );
});
