/**
 * Smart TV Native Bridge & Service Worker Register
 * Enables 100% Offline Capability, Cache Management & TV Hardware Key Hooks
 */
(function() {
    'use strict';

    // Immediate Service Worker Registration for Offline Caching
    if ('serviceWorker' in navigator) {
        const swPath = window.location.pathname.includes('/pages/') ? '../sw.js' : './sw.js';
        navigator.serviceWorker.register(swPath).then(function(registration) {
            console.log('[TVBridge] ServiceWorker registered with scope:', registration.scope);
            if (registration.active) {
                registration.update();
            }
        }).catch(function(err) {
            console.warn('[TVBridge] ServiceWorker registration failed:', err);
        });
    }

    // Hardware Bridge Fallback Handler
    window.TVBridge = {
        getAppVersion: function() { return '1.0.0'; },
        isOffline: function() { return !navigator.onLine; }
    };
})();
