/**
 * Modern High-Performance Smart TV Flutter & Android Native Bridge Interface
 * 
 * Provides JavaScript ↔ Dart/Android Native Bridge communication for Hotel TV UI.
 * Exposes methods via 'FlutterBridge' JavaScriptChannel and backwards-compatible interfaces.
 * 
 * Protocol:
 * - JS calls: FlutterBridge.postMessage(JSON.stringify({ method: 'methodName', args: [...], id: <unique_id> }))
 * - Dart responds: window.flutterBridge._resolve(id, result) or window.flutterBridge._reject(id, error)
 */

(function () {
    'use strict';

    const PENDING_CALLS = new Map();
    let CALL_ID = 0;

    function generateId() {
        return ++CALL_ID;
    }

    function callNative(method, args) {
        return new Promise((resolve, reject) => {
            const id = generateId();
            PENDING_CALLS.set(id, { resolve, reject });

            if (window.FlutterBridge && typeof window.FlutterBridge.postMessage === 'function') {
                window.FlutterBridge.postMessage(JSON.stringify({ method, args: args || [], id }));
            } else {
                PENDING_CALLS.delete(id);
                console.warn(`[FlutterBridge] Call '${method}' fallback mode. Native bridge unavailable.`);
                reject(new Error(`FlutterBridge unavailable for '${method}'`));
            }

            // Timeout after 10 seconds to avoid hanging promises
            setTimeout(() => {
                if (PENDING_CALLS.has(id)) {
                    PENDING_CALLS.delete(id);
                    reject(new Error(`Bridge call '${method}' timed out after 10s`));
                }
            }, 10000);
        });
    }

    // Expose resolution methods for Dart/Android to call back
    window.flutterBridge = {
        _resolve(id, result) {
            const pending = PENDING_CALLS.get(id);
            if (pending) {
                PENDING_CALLS.delete(id);
                pending.resolve(result);
            }
        },
        _reject(id, error) {
            const pending = PENDING_CALLS.get(id);
            if (pending) {
                PENDING_CALLS.delete(id);
                pending.reject(new Error(error));
            }
        },

        // ============================================================
        // DEVICE MANAGEMENT (Provisioning & Identification)
        // ============================================================
        identifyDevice(ip) {
            return callNative('identifyDevice', [ip]);
        },

        saveDeviceConfig(config) {
            return callNative('saveDeviceConfig', [config]);
        },

        saveRoomConfig(room, config) {
            return callNative('saveRoomConfig', [room, config]);
        },

        getDeviceConfig(serial) {
            return callNative('getDeviceConfig', [serial]);
        },

        getRoomConfig(room) {
            return callNative('getRoomConfig', [room]);
        },

        // ============================================================
        // TV CONTROL OPERATIONS (Core Launching & Hardware Input)
        // ============================================================
        launchApp(packageName) {
            console.log('[TVBridge] Launching App:', packageName);
            return callNative('launchApp', [packageName]).catch(err => {
                console.warn('[TVBridge] Launch app native call failed:', err);
                return { success: false, error: err.message };
            });
        },

        launchHdmi(model) {
            return callNative('launchHdmi', [model]);
        },

        getHdmiModels() {
            return callNative('getHdmiModels', []);
        },

        launchIptv(packageName, configPath) {
            return callNative('launchIptv', [packageName, configPath]);
        },

        openSettings() {
            return callNative('openSettings', []);
        },

        // ============================================================
        // PMS & GUEST DATA
        // ============================================================
        updatePmsGuest(guestData) {
            return callNative('updatePmsGuest', [guestData]);
        },

        // ============================================================
        // BACKGROUND SYNC
        // ============================================================
        syncWeather() {
            return callNative('syncWeather', []);
        },

        syncFlights() {
            return callNative('syncFlights', []);
        },

        // ============================================================
        // MEDIA / GALLERY
        // ============================================================
        getPictureList(category) {
            return callNative('getPictureList', [category]);
        },

        rotateImage(imagePath, degrees) {
            return callNative('rotateImage', [imagePath, degrees]);
        },

        // ============================================================
        // SYSTEM INFO & NETWORK
        // ============================================================
        getSystemInfo() {
            return callNative('getSystemInfo', []);
        },

        checkInternet() {
            return Promise.resolve(navigator.onLine);
        },

        call(method, args) {
            return callNative(method, args || []);
        },

        async getInstalledApps() {
            try {
                return await callNative('getInstalledApps', []);
            } catch (e) {
                const serial = localStorage.getItem('deviceSerial');
                const fallbackFiles = ['4KTV-0SU', 'SEI530', 'JSHRASHD'];
                const filesToTry = serial ? [serial, ...fallbackFiles.filter(f => f !== serial)] : fallbackFiles;
                for (const file of filesToTry) {
                    try {
                        const resp = await fetch('admin/' + file + '_applications.json?t=' + Date.now());
                        if (resp.ok) return await resp.json();
                    } catch (_) {}
                }
                return [];
            }
        },

        async getTvInputs() {
            try {
                return await callNative('getTvInputs', []);
            } catch (e) {
                try {
                    const resp = await fetch('admin/hdmi_models.json?t=' + Date.now());
                    if (!resp.ok) return [];
                    const models = await resp.json();
                    return Object.keys(models).map(key => ({ id: key, label: key, type: 'HDMI' }));
                } catch (_) {
                    return [];
                }
            }
        }
    };

    // Backward Compatibility Wrappers for Legacy Android webviews
    window.AndroidBridge = {
        getPictureList(category) {
            return window.flutterBridge.getPictureList(category);
        },
        rotateImage(imagePath, degrees) {
            return window.flutterBridge.rotateImage(imagePath, degrees);
        },
        hideLoading() {
            if (window.FlutterBridge && window.FlutterBridge.postMessage) {
                window.FlutterBridge.postMessage(JSON.stringify({ method: 'hideLoading', args: [], id: 0 }));
            }
        }
    };

    window.Android = {
        pictureListReady(jsonString) {
            window.dispatchEvent(new CustomEvent('pictureListReady', { detail: jsonString }));
        },
        hideLoading() {
            window.AndroidBridge.hideLoading();
        }
    };

    // Hardware Remote Control D-Pad Key Injector
    window.TVKeyInjector = {
        triggerBack: function () {
            this.triggerKey(8, 'Backspace');
        },
        triggerNumber: function (digit) {
            var num = parseInt(digit, 10);
            if (num >= 0 && num <= 9) {
                this.triggerKey(48 + num, digit);
            }
        },
        triggerKey: function (keyCode, keyName) {
            var event = new KeyboardEvent('keydown', {
                bubbles: true,
                cancelable: true,
                keyCode: keyCode,
                which: keyCode,
                key: keyName || ''
            });
            window.dispatchEvent(event);
        }
    };

    window.HOTEL_DATA_FILE = "data.json";

    window.getFastConfig = function () {
        try {
            const cached = localStorage.getItem('cachedHotelData');
            if (cached) return JSON.parse(cached);
        } catch (e) {}
        return null;
    };

    window.checkPlanExpiredRedirect = function (config, redirectUrl) {
        if (!config || !config.hotel || !config.hotel.active_plan || !config.hotel.active_plan.expiry_date) return false;
        var now = new Date();
        var expiry = new Date(config.hotel.active_plan.expiry_date);
        if (expiry <= now) {
            var p = window.location.pathname;
            var redirect = redirectUrl || ((p.lastIndexOf('/') > 0) ? '../index.html' : 'index.html');
            window.location.href = redirect;
            return true;
        }
        return false;
    };

    // Immediate PWA Service Worker Registration for 100% Offline Support
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

    // Hardware Bridge General Fallback Handler
    window.TVBridge = {
        getAppVersion: function() { return '1.0.0'; },
        isOffline: function() { return !navigator.onLine; },
        launchApp: function(packageName) {
            return window.flutterBridge.launchApp(packageName);
        }
    };
})();
