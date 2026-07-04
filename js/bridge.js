/**
 * Flutter Bridge Interface
 * 
 * This module provides the JavaScript-to-Dart bridge for the Hotel TV UI.
 * The Flutter app must expose these functions via a JavaScriptChannel named 'FlutterBridge'.
 * 
 * Communication Protocol:
 * - JS calls: FlutterBridge.postMessage(JSON.stringify({ method: 'methodName', args: [...], id: <unique_id> }))
 * - Dart responds: window.flutterBridge._resolve(id, result) or window.flutterBridge._reject(id, error)
 * 
 * The Flutter developer must implement the native side for each method listed below.
 */

(function() {
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
                window.FlutterBridge.postMessage(JSON.stringify({ method, args, id }));
            } else {
                PENDING_CALLS.delete(id);
                reject(new Error('FlutterBridge not available. Ensure Flutter app has initialized the JavaScriptChannel.'));
            }

            // Timeout after 10 seconds
            setTimeout(() => {
                if (PENDING_CALLS.has(id)) {
                    PENDING_CALLS.delete(id);
                    reject(new Error(`Bridge call '${method}' timed out after 10s`));
                }
            }, 10000);
        });
    }

    // Expose resolution methods for Dart to call back
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
        // DEVICE MANAGEMENT (Required for provisioning & identification)
        // ============================================================

        /**
         * Identify the TV device via ADB
         * @param {string} ip - TV IP address (e.g., "192.168.1.100")
         * @returns {Promise<Object>} { success: boolean, serial: string, model: string, ip: string, mac: string, room?: string, error?: string }
         */
        identifyDevice(ip) {
            return callNative('identifyDevice', [ip]);
        },

        /**
         * Save device configuration to persistent storage
         * @param {Object} config - Device config object
         * @returns {Promise<Object>} { success: boolean, error?: string }
         */
        saveDeviceConfig(config) {
            return callNative('saveDeviceConfig', [config]);
        },

        /**
         * Save room configuration (room number + device serial mapping)
         * @param {string} room - Room number (e.g., "101")
         * @param {Object} config - Room config object
         * @returns {Promise<Object>} { success: boolean, error?: string }
         */
        saveRoomConfig(room, config) {
            return callNative('saveRoomConfig', [room, config]);
        },

        /**
         * Get saved device config by serial
         * @param {string} serial - Device serial number
         * @returns {Promise<Object|null>} Device config or null if not found
         */
        getDeviceConfig(serial) {
            return callNative('getDeviceConfig', [serial]);
        },

        /**
         * Get saved room config by room number
         * @param {string} room - Room number
         * @returns {Promise<Object|null>} Room config or null if not found
         */
        getRoomConfig(room) {
            return callNative('getRoomConfig', [room]);
        },

        // ============================================================
        // TV CONTROL OPERATIONS (Required for core functionality)
        // ============================================================

        /**
         * Launch an Android TV app by package name
         * @param {string} packageName - Android package name (e.g., "com.netflix.ninja")
         * @returns {Promise<Object>} { success: boolean, error?: string }
         */
        launchApp(packageName) {
            return callNative('launchApp', [packageName]);
        },

        /**
         * Launch HDMI input by model identifier
         * @param {string} model - HDMI model key from hdmi_models.json (e.g., "Worldtech_RT32HD")
         * @returns {Promise<Object>} { success: boolean, error?: string }
         */
        launchHdmi(model) {
            return callNative('launchHdmi', [model]);
        },

        /**
         * Get available HDMI models list
         * @returns {Promise<Object>} { models: Object } - same structure as hdmi_models.json
         */
        getHdmiModels() {
            return callNative('getHdmiModels', []);
        },

        /**
         * Launch IPTV app with optional config path
         * @param {string} packageName - IPTV app package name
         * @param {string} [configPath] - Path to IPTV config JSON (e.g., "iptv/all.json")
         * @returns {Promise<Object>} { success: boolean, error?: string }
         */
        launchIptv(packageName, configPath) {
            return callNative('launchIptv', [packageName, configPath]);
        },

        /**
         * Open Android Settings on the TV
         * @returns {Promise<Object>} { success: boolean, error?: string }
         */
        openSettings() {
            return callNative('openSettings', []);
        },

        // ============================================================
        // PMS / GUEST DATA (Required for hotel operations)
        // ============================================================

        /**
         * Update PMS guest data for a room (called from PMS/Android app)
         * @param {Object} guestData - { room: string, guestName: string, checkIn: string, checkOut: string, ... }
         * @returns {Promise<Object>} { success: boolean, error?: string }
         */
        updatePmsGuest(guestData) {
            return callNative('updatePmsGuest', [guestData]);
        },

        // ============================================================
        // WEATHER & FLIGHTS SYNC (Optional - for background updates)
        // ============================================================

        /**
         * Trigger weather data sync from Open-Meteo API
         * @returns {Promise<Object>} { success: boolean, data?: Object, error?: string }
         */
        syncWeather() {
            return callNative('syncWeather', []);
        },

        /**
         * Trigger flights data sync from FlightRadar24 API
         * @returns {Promise<Object>} { success: boolean, data?: Object, error?: string }
         */
        syncFlights() {
            return callNative('syncFlights', []);
        },

        // ============================================================
        // MEDIA / GALLERY (Optional - for gallery pages)
        // ============================================================

        /**
         * Get picture list for gallery slideshow
         * @param {string} category - Category name (e.g., "travel", "hotel_info", "city", "amenities")
         * @returns {Promise<Array<string>>} Array of image paths/URLs
         */
        getPictureList(category) {
            return callNative('getPictureList', [category]);
        },

        /**
         * Rotate image (for gallery interaction)
         * @param {string} imagePath - Path to image
         * @param {number} degrees - Rotation degrees (90, 180, 270)
         * @returns {Promise<Object>} { success: boolean, rotatedPath?: string, error?: string }
         */
        rotateImage(imagePath, degrees) {
            return callNative('rotateImage', [imagePath, degrees]);
        },

        // ============================================================
        // SYSTEM INFO (Optional)
        // ============================================================

        /**
         * Get TV system information
         * @returns {Promise<Object>} { model: string, androidVersion: string, ip: string, mac: string, ... }
         */
        getSystemInfo() {
            return callNative('getSystemInfo', []);
        },

        /**
         * Check internet connectivity
         * @returns {Promise<boolean>} true if online
         */
        checkInternet() {
            return callNative('checkInternet', []);
        }
    };

    // Backward compatibility: expose AndroidBridge for existing gallery pages
    window.AndroidBridge = {
        getPictureList(category) {
            return window.flutterBridge.getPictureList(category);
        },
        rotateImage(imagePath, degrees) {
            return window.flutterBridge.rotateImage(imagePath, degrees);
        },
        hideLoading() {
            // Dart should call this on WebView to hide native loading indicator
            if (window.FlutterBridge && window.FlutterBridge.postMessage) {
                window.FlutterBridge.postMessage(JSON.stringify({ method: 'hideLoading', args: [], id: 0 }));
            }
        }
    };

    // Also expose window.Android for legacy code
    window.Android = {
        pictureListReady(jsonString) {
            // Called by Dart when picture list is ready
            window.dispatchEvent(new CustomEvent('pictureListReady', { detail: jsonString }));
        },
        hideLoading() {
            window.AndroidBridge.hideLoading();
        }
    };

})();