const CACHE_NAME = 'ondemand-cache-corrige-login-cliente-20260610';

const urlsToCache = [
    './',
    './index.html',
    './style.css',
    './style.css?v=corrige-login-cliente-20260610',
    './app.js?v=corrige-login-cliente-20260610',
    './manifest.json',
    './manual_up_agro_instrucoes.pdf'
  './logo-ondemand.png'
  './icon-192x192.png',
  './icon-512x512.png',
  './icon-maskable-192x192.png',
  './icon-maskable-512x512.png',
  './manifest.webmanifest',
];

self.addEventListener('install', (event) => {
    self.skipWaiting();

    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(urlsToCache).catch(() => Promise.resolve());
        })
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                    return Promise.resolve();
                })
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') {
        return;
    }

    event.respondWith(
        fetch(event.request)
            .then((networkResponse) => {
                const responseClone = networkResponse.clone();

                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, responseClone).catch(() => {});
                });

                return networkResponse;
            })
            .catch(() => {
                return caches.match(event.request).then((cachedResponse) => {
                    return cachedResponse || caches.match('./index.html');
                });
            })
    );
});
