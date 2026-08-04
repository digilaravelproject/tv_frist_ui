/* Smart TV Progressive Web App Service Worker (IndexedDB + Cache Storage Dynamic Media Caching) */

const CACHE_NAME = 'tv-template-v1.0.0-cache';
const IMAGE_CACHE_NAME = 'tv-template-images-v1';

const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './index2.html',
    './data.json',
    './css/style.css',
    './css/tv-navigation.css',
    './css/components.css',
    './css/pages/home.css',
    './css/pages/weather.css',
    './js/bridge.js',
    './js/tv-navigation.js',
    './js/api.js',
    './js/app.js',
    './js/index2.js',
    './js/modules/home.js',
    './js/modules/weather.js',
    './images/logo.png',
    './images/main.jpg',
    './images/2main.jpg',
    './pages/weather.html'
];

self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return Promise.allSettled(
                ASSETS_TO_CACHE.map((url) => {
                    return cache.add(url).catch((err) => {
                        console.warn('[SW] Precache skipped for:', url, err);
                    });
                })
            );
        })
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((key) => {
                    if (key !== CACHE_NAME && key !== IMAGE_CACHE_NAME) {
                        return caches.delete(key);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;

    const requestUrl = new URL(event.request.url);

    // Dynamically cache remote images (e.g. https://tvapp.digiemperor.com/uploads/...) in Cache Storage
    if (requestUrl.pathname.match(/\.(png|jpg|jpeg|svg|webp|gif)$/i) || requestUrl.hostname.includes('digiemperor.com')) {
        event.respondWith(
            caches.open(IMAGE_CACHE_NAME).then((cache) => {
                return cache.match(event.request).then((cachedResponse) => {
                    if (cachedResponse) {
                        // Return cached image immediately, refresh in background if online
                        fetch(event.request).then((networkResponse) => {
                            if (networkResponse && networkResponse.status === 200) {
                                cache.put(event.request, networkResponse.clone());
                            }
                        }).catch(() => {});
                        return cachedResponse;
                    }

                    // Fetch from network and save to image cache
                    return fetch(event.request).then((networkResponse) => {
                        if (networkResponse && networkResponse.status === 200) {
                            cache.put(event.request, networkResponse.clone());
                        }
                        return networkResponse;
                    }).catch(() => {
                        // Return local fallback image if completely offline and uncached
                        return caches.match('./images/logo.png') || caches.match('./images/main.jpg');
                    });
                });
            })
        );
        return;
    }

    // Standard static assets & HTML navigation caching
    event.respondWith(
        caches.match(event.request, { ignoreSearch: true }).then((cachedResponse) => {
            if (cachedResponse) {
                fetch(event.request).then((networkResponse) => {
                    if (networkResponse && networkResponse.status === 200) {
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(event.request, networkResponse.clone());
                        });
                    }
                }).catch(() => {});
                return cachedResponse;
            }

            return fetch(event.request).then((networkResponse) => {
                if (networkResponse && networkResponse.status === 200) {
                    const responseClone = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseClone);
                    });
                }
                return networkResponse;
            }).catch(() => {
                return caches.match('./index.html') || caches.match('/index.html') || caches.match('index.html');
            });
        })
    );
});
