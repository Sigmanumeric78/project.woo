// SocialSpaces Service Worker
// Cache-first strategy for static shell; network-first for API/Firebase.

const CACHE_NAME = 'socialspaces-v1';
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/styles.css',
    '/manifest.json',
    '/pages/login.html',
    '/pages/signup.html',
    '/pages/dashboard.html',
    '/pages/profile.html',
    '/pages/my-groups.html',
    '/pages/group-manager.html',
    '/pages/forgot-password.html',
    '/pages/privacy-policy.html',
    '/js/dark-mode.js',
    '/css/dashboard.css',
];

// ── Install: pre-cache static shell ──────────────────────────────────────────
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('📦 SW: Pre-caching static assets');
            // addAll fails if any single request fails — use individual adds for resilience
            return Promise.allSettled(
                STATIC_ASSETS.map(url => cache.add(url).catch(e => console.warn('SW: Could not cache', url, e)))
            );
        })
    );
    self.skipWaiting();
});

// ── Activate: clean up old caches ─────────────────────────────────────────────
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) =>
            Promise.all(
                cacheNames
                    .filter((name) => name !== CACHE_NAME)
                    .map((name) => {
                        console.log('🗑️ SW: Deleting old cache:', name);
                        return caches.delete(name);
                    })
            )
        )
    );
    self.clients.claim();
});

// ── Fetch: Smart routing ───────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Never intercept: Firebase, Google APIs, external CDNs
    if (
        url.hostname.includes('firebase') ||
        url.hostname.includes('googleapis') ||
        url.hostname.includes('gstatic') ||
        url.hostname.includes('firebaseio') ||
        url.hostname.includes('osrm') ||
        url.hostname.includes('nominatim') ||
        url.hostname.includes('emailjs') ||
        url.hostname.includes('recaptcha') ||
        url.hostname.includes('fonts.cdnfonts') ||
        url.hostname.includes('jsdelivr')
    ) {
        return; // Let browser handle external requests natively
    }

    // For navigation requests (HTML pages): network-first, fall back to cache
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request)
                .then((response) => {
                    // Cache the fresh page
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
                    return response;
                })
                .catch(() => caches.match(event.request) || caches.match('/pages/login.html'))
        );
        return;
    }

    // For static assets (CSS, JS, fonts, images): cache-first
    if (
        url.pathname.endsWith('.css') ||
        url.pathname.endsWith('.js') ||
        url.pathname.endsWith('.png') ||
        url.pathname.endsWith('.jpg') ||
        url.pathname.endsWith('.svg') ||
        url.pathname.endsWith('.ico') ||
        url.pathname.endsWith('.webp') ||
        url.pathname.endsWith('.json')
    ) {
        event.respondWith(
            caches.match(event.request).then((cached) => {
                if (cached) return cached;
                return fetch(event.request).then((response) => {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
                    return response;
                });
            })
        );
        return;
    }

    // Default: network-first
    event.respondWith(
        fetch(event.request).catch(() => caches.match(event.request))
    );
});

// ── Push Notifications (future) ───────────────────────────────────────────────
self.addEventListener('push', (event) => {
    if (!event.data) return;
    const data = event.data.json();
    event.waitUntil(
        self.registration.showNotification(data.title || 'SocialSpaces', {
            body: data.message || '',
            icon: '/icons/icon-192.png',
            badge: '/icons/icon-96.png',
            tag: data.tag || 'socialspaces',
            data: { url: data.url || '/pages/dashboard.html' }
        })
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        clients.openWindow(event.notification.data?.url || '/pages/dashboard.html')
    );
});
