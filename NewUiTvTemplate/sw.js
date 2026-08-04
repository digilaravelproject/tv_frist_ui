/* Smart TV PWA Service Worker — v1.2.0
 * Strategy:
 *   - HTML page navigations: Network-first, NO index.html fallback (prevents unwanted redirect)
 *   - Static assets (JS/CSS): Cache-first, network fallback
 *   - Remote images: Cache-first, network update in background
 */

const CACHE_NAME        = 'tv-template-v1.2.0-cache';
const IMAGE_CACHE_NAME  = 'tv-template-images-v1.2';

const STATIC_ASSETS = [
    './index.html',
    './index2.html',
    './data.json',
    './css/style.css',
    './css/tv-navigation.css',
    './css/components.css',
    './css/pages/home.css',
    './css/pages/weather.css',
    './css/pages/hotel_info.css',
    './js/bridge.js',
    './js/tv-navigation.js',
    './js/api.js',
    './js/app.js',
    './js/index2.js',
    './js/modules/home.js',
    './js/modules/weather.js',
    './js/modules/hotel_info.js',
    './images/logo.png',
    './images/main.jpg',
    './images/2main.jpg',
    './pages/weather.html',
    './pages/hotel_info.html',
    './pages/amenities.html',
    './pages/flights.html',
    './pages/settings.html',
    './pages/languages.html',
    './pages/city.html',
    './pages/travel.html',
    './pages/home.html',
    './pages/advanced.html'
];

/* ── Install: pre-cache static assets ─────────────────────────────── */
self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) =>
            Promise.allSettled(
                STATIC_ASSETS.map((url) =>
                    cache.add(url).catch((err) =>
                        console.warn('[SW] Precache skipped:', url, err)
                    )
                )
            )
        )
    );
});

/* ── Activate: delete old caches ───────────────────────────────────── */
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(
                keys
                    .filter((k) => k !== CACHE_NAME && k !== IMAGE_CACHE_NAME)
                    .map((k) => {
                        console.log('[SW] Deleting old cache:', k);
                        return caches.delete(k);
                    })
            )
        ).then(() => self.clients.claim())
    );
});

/* ── Fetch: smart routing ──────────────────────────────────────────── */
self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;

    const url = new URL(event.request.url);

    /* ── 1. Remote images (digiemperor.com or image extensions) ─── */
    const isImage = /\.(png|jpg|jpeg|svg|webp|gif|ico)$/i.test(url.pathname);
    const isRemoteMedia = url.hostname.includes('digiemperor.com') ||
                          url.hostname.includes('open-meteo.com') ||
                          url.hostname.includes('geocoding-api');

    if (isImage || isRemoteMedia) {
        event.respondWith(
            caches.open(IMAGE_CACHE_NAME).then((cache) =>
                cache.match(event.request).then((cached) => {
                    // Stale-while-revalidate for images
                    const networkFetch = fetch(event.request)
                        .then((res) => {
                            if (res && res.status === 200) {
                                cache.put(event.request, res.clone());
                            }
                            return res;
                        })
                        .catch(() => null);

                    return cached || networkFetch;
                })
            )
        );
        return;
    }

    /* ── 2. HTML page navigation requests: NETWORK-FIRST, no index fallback ─ */
    if (event.request.mode === 'navigate' ||
        event.request.headers.get('accept').includes('text/html')) {

        event.respondWith(
            fetch(event.request)
                .then((networkRes) => {
                    // Cache a fresh copy of the navigated page
                    if (networkRes && networkRes.status === 200) {
                        const clone = networkRes.clone();
                        caches.open(CACHE_NAME).then((cache) =>
                            cache.put(event.request, clone)
                        );
                    }
                    return networkRes;
                })
                .catch(() => {
                    // Offline: serve the exact cached page — NEVER redirect to index.html
                    return caches.match(event.request, { ignoreSearch: true });
                })
        );
        return;
    }

    /* ── 3. Static assets (JS / CSS): Cache-first, network fallback ─ */
    event.respondWith(
        caches.match(event.request, { ignoreSearch: true }).then((cached) => {
            if (cached) {
                // Background refresh
                fetch(event.request)
                    .then((res) => {
                        if (res && res.status === 200) {
                            caches.open(CACHE_NAME).then((cache) =>
                                cache.put(event.request, res.clone())
                            );
                        }
                    })
                    .catch(() => {});
                return cached;
            }

            return fetch(event.request)
                .then((res) => {
                    if (res && res.status === 200) {
                        const clone = res.clone();
                        caches.open(CACHE_NAME).then((cache) =>
                            cache.put(event.request, clone)
                        );
                    }
                    return res;
                })
                .catch(() => null);  // Return null — never redirect anywhere
        })
    );
});
