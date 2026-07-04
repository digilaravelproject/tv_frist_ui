/**
 * Weather Module - Offline-First Weather Display
 * 
 * This module handles weather data fetching with graceful offline fallback.
 * It reads from local cached JSON (weather_data.json) and localStorage cache.
 * No external API calls from the frontend - sync is handled by Flutter/Dart background isolate.
 */

(function() {
    'use strict';

    const CACHE_KEY = 'weather_cache';
    const CACHE_TIMESTAMP_KEY = 'weather_cache_timestamp';
    const MAX_CACHE_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

    let currentLanguageData = null;

    function getWeatherIcon(code) {
        if (code === 0) return 'sunny.png';
        if (code >= 1 && code <= 3) return 'cloudy.png';
        if (code >= 45 && code <= 48) return 'cloudy.png';
        if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return 'rainy.png';
        if (code >= 71 && code <= 77) return 'rainy.png';
        if (code >= 95) return 'storm.png';
        return 'sunny.png';
    }

    function formatTime(isoString) {
        const date = new Date(isoString);
        return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
    }

    function formatDate(date) {
        if (!currentLanguageData || !currentLanguageData.months || !currentLanguageData.days_short) {
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase();
        }
        const dKey = date.toLocaleDateString('en-US', { weekday: 'short' }).toLowerCase();
        const mKey = date.toLocaleDateString('en-US', { month: 'short' }).toLowerCase();
        const dName = currentLanguageData.days_short[dKey] || dKey.toUpperCase();
        const mName = currentLanguageData.months[mKey] || mKey.toUpperCase();
        return `${dName} | ${date.getDate()} ${mName}`;
    }

    function renderWeather(data, isCached = false) {
        if (!data || !data.current) return;

        const cur = data.current;
        const ext = data.extracted_data || {};

        // Temperature
        const tempEl = document.getElementById('cur-temp');
        const feelsEl = document.getElementById('h-feels');
        if (tempEl) tempEl.innerText = `+${Math.round(cur.temperature_2m)}°C`;
        if (feelsEl) feelsEl.innerText = `${Math.round(cur.temperature_2m)}°C`;

        // AQI
        const aqiVal = parseInt(ext.aqi) || 0;
        const aqiTextEl = document.getElementById('aqi-text');
        const aqiNumEl = document.getElementById('cur-aqi');
        
        let statusKey = "";
        let color = "#00b050";

        if (aqiVal <= 50) { statusKey = "good"; color = "#00b050"; }
        else if (aqiVal <= 100) { statusKey = "satisfactory"; color = "#92d050"; }
        else if (aqiVal <= 200) { statusKey = "moderate"; color = "#ffff00"; }
        else if (aqiVal <= 300) { statusKey = "poor"; color = "#ff9900"; }
        else if (aqiVal <= 400) { statusKey = "very_poor"; color = "#ff0000"; }
        else { statusKey = "severe"; color = "#af2d24"; }

        const localizedAqi = (currentLanguageData && currentLanguageData.aqi) ? currentLanguageData.aqi : "AQI";
        let localizedStatus = statusKey.toUpperCase();
        if (currentLanguageData && currentLanguageData.status_text && currentLanguageData.status_text[statusKey]) {
            localizedStatus = currentLanguageData.status_text[statusKey];
        }

        if (aqiTextEl) {
            aqiTextEl.innerText = `${localizedAqi}: ${localizedStatus}`;
            aqiTextEl.style.color = color;
        }
        if (aqiNumEl) {
            aqiNumEl.innerText = aqiVal;
            aqiNumEl.style.color = color;
        }

        // Other params
        const humidityEl = document.getElementById('h-hum');
        const pressureEl = document.getElementById('h-press');
        const windEl = document.getElementById('h-wind');
        if (humidityEl) humidityEl.innerText = `${cur.relative_humidity_2m}%`;
        if (pressureEl) pressureEl.innerText = `${Math.round(cur.surface_pressure)} MB`;
        if (windEl) windEl.innerText = `${Math.round(cur.wind_speed_10m)} KM/H`;

        // Sunrise/Sunset
        const riseEl = document.getElementById('h-rise');
        const setEl = document.getElementById('h-set');
        if (data.daily && data.daily.sunrise && data.daily.sunset) {
            if (riseEl) riseEl.innerText = formatTime(data.daily.sunrise[0]);
            if (setEl) setEl.innerText = formatTime(data.daily.sunset[0]);
        }

        // Forecast row
        const row = document.getElementById('forecast-row');
        if (!row || !data.daily || !data.daily.time) return;

        const dayKeys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
        row.innerHTML = '';

        for (let i = 0; i < 7; i++) {
            const date = new Date(data.daily.time[i]);
            const key = dayKeys[date.getDay()];
            const dayName = (currentLanguageData && currentLanguageData.days_short && currentLanguageData.days_short[key])
                ? currentLanguageData.days_short[key]
                : key.toUpperCase();

            const maxTemp = Math.round(data.daily.temperature_2m_max[i]);
            const iconFile = getWeatherIcon(data.daily.weather_code[i]);

            row.innerHTML += `
                <div class="day-card">
                    <div class="day-title">${dayName}</div>
                    <img src="images/icons/${iconFile}" class="day-img" onerror="this.src='images/icons/sunny.png'">
                    <div class="day-temp">${maxTemp}°C</div>
                </div>`;
        }

        // Show offline banner if using cached data
        if (isCached) {
            showOfflineBanner();
        } else {
            hideOfflineBanner();
        }
    }

    function showOfflineBanner() {
        let banner = document.getElementById('offline-banner');
        if (!banner) {
            banner = document.createElement('div');
            banner.id = 'offline-banner';
            banner.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#ff9900;color:#000;text-align:center;padding:8px;font-weight:bold;z-index:9999;font-size:14px;';
            banner.innerText = '⚠️ Offline Mode — Showing Cached Weather Data';
            document.body.insertBefore(banner, document.body.firstChild);
        }
    }

    function hideOfflineBanner() {
        const banner = document.getElementById('offline-banner');
        if (banner) banner.remove();
    }

    function saveToCache(data) {
        try {
            localStorage.setItem(CACHE_KEY, JSON.stringify(data));
            localStorage.setItem(CACHE_TIMESTAMP_KEY, Date.now().toString());
        } catch (e) {
            console.warn('Failed to save weather cache:', e);
        }
    }

    function getFromCache() {
        try {
            const timestamp = parseInt(localStorage.getItem(CACHE_TIMESTAMP_KEY) || '0');
            if (Date.now() - timestamp > MAX_CACHE_AGE_MS) {
                return null; // Cache expired
            }
            const cached = localStorage.getItem(CACHE_KEY);
            return cached ? JSON.parse(cached) : null;
        } catch (e) {
            console.warn('Failed to read weather cache:', e);
            return null;
        }
    }

    async function loadLanguage() {
        try {
            const langFile = localStorage.getItem('selectedLangFile') || 'english.json';
            const response = await fetch('languages/' + langFile + '?t=' + Date.now());
            if (response.ok) {
                currentLanguageData = await response.json();
                if (currentLanguageData.direction === 'rtl') document.body.classList.add('rtl-mode');
                
                // Update static labels
                const cityEl = document.getElementById('city-name');
                if (cityEl) cityEl.innerText = currentLanguageData.city_name || "MUMBAI";
                
                const labels = {
                    'label-feels': 'feels_like',
                    'label-humidity': 'humidity',
                    'label-pressure': 'pressure',
                    'label-wind': 'wind',
                    'label-sunrise': 'sunrise',
                    'label-sunset': 'sunset'
                };
                
                Object.entries(labels).forEach(([elId, dataKey]) => {
                    const el = document.getElementById(elId);
                    if (el && currentLanguageData[dataKey]) el.innerText = currentLanguageData[dataKey];
                });
            }
        } catch (e) { 
            console.error("Weather: Lang Load Failed", e); 
        }
    }

    async function updateWeather() {
        // Try to fetch fresh data from local JSON (updated by Flutter background sync)
        try {
            const response = await fetch('weather_data.json?v=' + Date.now());
            if (response.ok) {
                const data = await response.json();
                saveToCache(data);
                renderWeather(data, false);
                return;
            }
        } catch (e) {
            console.warn('Weather: Fresh fetch failed, trying cache...', e);
        }

        // Fallback to localStorage cache
        const cached = getFromCache();
        if (cached) {
            renderWeather(cached, true);
            return;
        }

        // Ultimate fallback: show placeholder
        console.error('Weather: No data available (fresh fetch failed, no valid cache)');
        showOfflineBanner();
        setPlaceholderValues();
    }

    function setPlaceholderValues() {
        const placeholders = {
            'cur-temp': '--°C',
            'h-feels': '--°C',
            'aqi-text': 'AQI: --',
            'cur-aqi': '--',
            'h-hum': '--%',
            'h-press': '-- MB',
            'h-wind': '-- KM/H',
            'h-rise': '--:-- AM',
            'h-set': '--:-- PM'
        };
        Object.entries(placeholders).forEach(([id, val]) => {
            const el = document.getElementById(id);
            if (el) el.innerText = val;
        });
    }

    function updateClock() {
        const clockEl = document.getElementById('live-clock');
        if (!clockEl) return;
        clockEl.innerText = formatDate(new Date()) + " | " + new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', hour12: true}).toUpperCase();
    }

    // Public API
    window.WeatherModule = {
        init() {
            loadLanguage();
            updateWeather();
            updateClock();
            
            setInterval(updateClock, 1000);
            setInterval(updateWeather, 300000); // 5 minutes
        },
        
        // Called by Flutter when fresh sync completes
        onSyncComplete(data) {
            saveToCache(data);
            renderWeather(data, false);
        }
    };

})();