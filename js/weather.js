/**
 * Weather Module - Offline-First Weather Display
 * 
 * This module handles weather data fetching with graceful offline fallback.
 * It reads from local cached JSON (weather_data.json) and localStorage cache.
 * No external API calls from the frontend - sync is handled by Flutter/Dart background isolate.
 */

(function () {
    'use strict';

    const CACHE_KEY = 'weather_cache';
    const CACHE_TIMESTAMP_KEY = 'weather_cache_timestamp';
    const MAX_CACHE_AGE_MS = 30 * 60 * 1000; // 30 minutes

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
        if (feelsEl) {
            const feelsVal = (cur.apparent_temperature !== undefined) ? cur.apparent_temperature : cur.temperature_2m;
            feelsEl.innerText = `${Math.round(feelsVal)}°C`;
        }

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
        if (pressureEl) {
            const pressVal = (cur.pressure_msl !== undefined) ? cur.pressure_msl : cur.surface_pressure;
            pressureEl.innerText = `${Math.round(pressVal)} MB`;
        }
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

        for (let i = 0; i < Math.min(7, data.daily.time.length); i++) {
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

    function getFromCache(city) {
        try {
            const timestamp = parseInt(localStorage.getItem(CACHE_TIMESTAMP_KEY) || '0');
            const cachedCity = localStorage.getItem('cached_temp_city');
            if (Date.now() - timestamp > MAX_CACHE_AGE_MS) {
                return null; // Cache expired
            }
            if (cachedCity !== city) {
                return null; // Location changed
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

    // Background slider logic for weather forecast page
    let slideImages = [];
    let currentImageIndex = 0;
    let activeSlideIndex = 0;
    let sliderIntervalId = null;

    function initSlider(images) {
        if (sliderIntervalId) clearInterval(sliderIntervalId);
        slideImages = images || [];

        // Fallback: Try cover or main.jpg
        if (slideImages.length === 0) {
            const cached = localStorage.getItem('cachedHotelData');
            if (cached) {
                try {
                    const config = JSON.parse(cached);
                    if (config.hotel && config.hotel.media && config.hotel.media.cover_image) {
                        slideImages = [config.hotel.media.cover_image];
                    }
                } catch (e) { }
            }
        }

        if (slideImages.length === 0) {
            slideImages = ['../images/main.jpg'];
        }

        const slides = document.querySelectorAll('#bg-slider .slide');
        if (slides.length < 2) return;

        slides[0].style.backgroundImage = "url('../images/main.jpg')";
        slides[0].classList.add('active');
        slides[1].classList.remove('active');
        if (slideImages[0] && slideImages[0] !== '../images/main.jpg') {
            const tempImg1 = new Image();
            tempImg1.onload = () => {
                slides[0].style.backgroundImage = `url('${slideImages[0]}')`;
            };
            tempImg1.src = slideImages[0];
        }

        currentImageIndex = 0;
        activeSlideIndex = 0;

        if (slideImages.length > 1) {
            const preloader = new Image();
            sliderIntervalId = setInterval(() => {
                currentImageIndex = (currentImageIndex + 1) % slideImages.length;
                const nextSlideIndex = activeSlideIndex === 0 ? 1 : 0;
                const targetUrl = slideImages[currentImageIndex];

                preloader.onload = () => {
                    slides[nextSlideIndex].style.backgroundImage = `url('${targetUrl}')`;
                    slides[nextSlideIndex].classList.add('active');
                    slides[activeSlideIndex].classList.remove('active');
                    activeSlideIndex = nextSlideIndex;
                };
                preloader.onerror = () => {
                    slides[nextSlideIndex].style.backgroundImage = "url('../images/main.jpg')";
                    slides[nextSlideIndex].classList.add('active');
                    slides[activeSlideIndex].classList.remove('active');
                    activeSlideIndex = nextSlideIndex;
                };
                preloader.src = targetUrl;
            }, 5000);
        }
    }

    async function fetchCoordinates(city) {
        if (!navigator.onLine) {
            return {
                lat: 19.0760,
                lon: 72.8777,
                timezone: "Asia/Kolkata"
            };
        }
        try {
            const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`;
            const res = await fetch(geoUrl);
            if (res.ok) {
                const data = await res.json();
                if (data && data.results && data.results.length > 0) {
                    return {
                        lat: data.results[0].latitude,
                        lon: data.results[0].longitude,
                        timezone: data.results[0].timezone || "auto"
                    };
                }
            }
        } catch (e) {
            console.warn("Geocoding lookup failed, using fallback coordinates:", e);
        }
        // Fallback to Mumbai coordinates
        return {
            lat: 19.0760,
            lon: 72.8777,
            timezone: "Asia/Kolkata"
        };
    }

    async function fetchHotelLocation() {
        try {
            const res = await fetch('../data.json?t=' + Date.now());
            if (res.ok) {
                const config = await res.json();
                const data = config.data || config;
                if (data && data.hotel && data.hotel.hotel_location) {
                    localStorage.setItem('weather_city', data.hotel.hotel_location);
                    localStorage.setItem('cachedHotelData', JSON.stringify(data));
                    return data.hotel.hotel_location;
                }
            }
        } catch (e) {
            console.warn("Failed to fetch hotel location from ../data.json:", e);
        }
        return null;
    }

    async function resolveLocation() {
        let city = "Mumbai";
        const fetchedLoc = await fetchHotelLocation();
        if (fetchedLoc) {
            city = fetchedLoc;
        } else {
            let cachedCity = localStorage.getItem('weather_city');
            if (cachedCity) {
                city = cachedCity;
            } else {
                const cachedHotel = localStorage.getItem('cachedHotelData');
                if (cachedHotel) {
                    try {
                        const config = JSON.parse(cachedHotel);
                        if (config.hotel && config.hotel.hotel_location) {
                            city = config.hotel.hotel_location;
                        }
                    } catch (e) {}
                }
            }
        }

        // Normalize Mumbai suburbs
        const mumbaiSuburbs = ['borivali', 'andheri', 'bandra', 'thane', 'navi mumbai', 'mulund', 'kandivali', 'malad', 'goregaon', 'dahisar', 'chembur', 'kurla', 'ghatkopar', 'mumbai suburb'];
        const cleanCity = city.trim().toLowerCase();
        if (mumbaiSuburbs.indexOf(cleanCity) !== -1) {
            return "Mumbai";
        }
        return city;
    }

    async function updateWeather(force = false) {
        const loadingOverlay = document.getElementById('weather-loading');
        const errorOverlay = document.getElementById('weather-error');

        const city = await resolveLocation();

        // Dynamically update city title name in viewport and document title
        const cityEl = document.getElementById('city-name');
        if (cityEl) cityEl.innerText = city.toUpperCase();
        document.title = `${city.charAt(0).toUpperCase() + city.slice(1)} Weather`;

        // Offline Mode Fallback Check
        if (!navigator.onLine) {
            console.warn("Weather: Device is offline. Fetching from cache.");
            const cachedOffline = getFromCache(city);
            if (cachedOffline) {
                renderWeather(cachedOffline, true);
                if (loadingOverlay) loadingOverlay.style.display = 'none';
                if (errorOverlay) errorOverlay.style.display = 'none';
                return;
            }
            // Attempt to load from the local fallback JSON file
            try {
                const response = await fetch('weather_data.json?v=' + Date.now());
                if (response.ok) {
                    const fallbackData = await response.json();
                    saveToCache(fallbackData);
                    renderWeather(fallbackData, false);
                    if (loadingOverlay) loadingOverlay.style.display = 'none';
                    if (errorOverlay) errorOverlay.style.display = 'none';
                    return;
                }
            } catch (fallbackErr) {
                console.warn("Local fallback load failed:", fallbackErr);
            }
            showErrorUI("No Internet Connection", "Unable to fetch weather data. Please check your connectivity and try again.");
            return;
        }

        // 1. Cache-freshness check: load instantly if valid (skip if force=true)
        if (!force) {
            const cached = getFromCache(city);
            if (cached) {
                console.log("Weather: Loaded fresh cache for " + city);
                renderWeather(cached, false);
                if (loadingOverlay) loadingOverlay.style.display = 'none';
                if (errorOverlay) errorOverlay.style.display = 'none';
                return;
            }
        }

        // Cache missing or expired — fetch fresh data
        if (loadingOverlay) loadingOverlay.style.display = 'flex';
        if (errorOverlay) errorOverlay.style.display = 'none';

        try {
            // A. Resolve city to geographic coordinates
            const coords = await fetchCoordinates(city);

            // B. Fetch Weather forecast and Air Quality in parallel
            const [forecastRes, aqiRes] = await Promise.all([
                fetch(`https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,surface_pressure,pressure_msl,wind_speed_10m,weather_code&daily=temperature_2m_max,sunrise,sunset,weather_code&timezone=${encodeURIComponent(coords.timezone)}`),
                fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${coords.lat}&longitude=${coords.lon}&current=us_aqi`)
            ]);

            if (!forecastRes.ok) throw new Error(`Forecast API failed with status ${forecastRes.status}`);
            const forecastData = await forecastRes.json();

            let aqiVal = 50;
            if (aqiRes.ok) {
                try {
                    const aqiData = await aqiRes.json();
                    if (aqiData && aqiData.current && aqiData.current.us_aqi !== undefined) {
                        aqiVal = aqiData.current.us_aqi;
                    }
                } catch (e) {
                    console.warn("AQI fetch/parse failed:", e);
                }
            }

            // C. Map Open-Meteo payloads into structure expected by UI components
            const mappedData = {
                latitude: coords.lat,
                longitude: coords.lon,
                current: {
                    temperature_2m: forecastData.current.temperature_2m,
                    relative_humidity_2m: forecastData.current.relative_humidity_2m,
                    apparent_temperature: forecastData.current.apparent_temperature,
                    surface_pressure: forecastData.current.surface_pressure,
                    pressure_msl: forecastData.current.pressure_msl,
                    wind_speed_10m: forecastData.current.wind_speed_10m,
                    weather_code: forecastData.current.weather_code
                },
                daily: {
                    time: forecastData.daily.time,
                    temperature_2m_max: forecastData.daily.temperature_2m_max,
                    sunrise: forecastData.daily.sunrise,
                    sunset: forecastData.daily.sunset,
                    weather_code: forecastData.daily.weather_code
                },
                extracted_data: {
                    temp: forecastData.current.temperature_2m,
                    humidity: forecastData.current.relative_humidity_2m,
                    apparent_temperature: forecastData.current.apparent_temperature,
                    pressure: forecastData.current.pressure_msl || forecastData.current.surface_pressure,
                    wind: forecastData.current.wind_speed_10m,
                    sunrise: forecastData.daily.sunrise[0],
                    sunset: forecastData.daily.sunset[0],
                    aqi: aqiVal
                }
            };

            saveToCache(mappedData);
            localStorage.setItem('cached_temp_city', city);
            renderWeather(mappedData, false);

            if (loadingOverlay) loadingOverlay.style.display = 'none';

        } catch (e) {
            console.error("Weather Fetch Error:", e);
            const cachedOffline = getFromCache(city);
            if (cachedOffline) {
                renderWeather(cachedOffline, true);
                if (loadingOverlay) loadingOverlay.style.display = 'none';
                return;
            }
            // Attempt to load from the local fallback JSON file
            try {
                const response = await fetch('weather_data.json?v=' + Date.now());
                if (response.ok) {
                    const fallbackData = await response.json();
                    saveToCache(fallbackData);
                    renderWeather(fallbackData, false);
                    if (loadingOverlay) loadingOverlay.style.display = 'none';
                    return;
                }
            } catch (fallbackErr) {
                console.warn("Local fallback load failed:", fallbackErr);
            }
            showErrorUI("Unable to Fetch Weather", "There was an issue contacting the weather service. Please try again.");
        }
    }

    function showErrorUI(title, body) {
        const loadingOverlay = document.getElementById('weather-loading');
        const errorOverlay = document.getElementById('weather-error');
        const errTitle = document.getElementById('error-message-title');
        const errBody = document.getElementById('error-message-body');
        const retryBtn = document.getElementById('retry-btn');

        if (loadingOverlay) loadingOverlay.style.display = 'none';
        if (errorOverlay) errorOverlay.style.display = 'flex';
        if (errTitle) errTitle.textContent = title;
        if (errBody) errBody.textContent = body;

        setTimeout(() => {
            if (window.TVNavigation && typeof window.TVNavigation.markDirty === 'function') {
                window.TVNavigation.markDirty();
            }
            if (retryBtn) {
                retryBtn.focus();
                retryBtn.classList.add('active-focus');
            }
        }, 100);
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
        clockEl.innerText = formatDate(new Date()) + " | " + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase();
    }

    // Public API
    window.WeatherModule = {
        init() {
            loadLanguage();
            updateClock();

            // Load background slider slides
            let sliderImages = [];
            const cached = localStorage.getItem('cachedHotelData');
            if (cached) {
                try {
                    const config = JSON.parse(cached);
                    if (config.hotel && config.hotel.media && config.hotel.media.slider_images) {
                        sliderImages = config.hotel.media.slider_images;
                    }
                } catch (e) { }
            }
            initSlider(sliderImages);

            updateWeather();

            setInterval(updateClock, 1000);
            setInterval(updateWeather, 1800000); // Check weather every 30 minutes

            // Bind D-pad retry button action
            const retryBtn = document.getElementById('retry-btn');
            if (retryBtn) {
                retryBtn.addEventListener('click', function () {
                    updateWeather(true); // Force bypass cache on manual retry
                });
            }
        },

        onSyncComplete(data) {
            saveToCache(data);
            renderWeather(data, false);
        }
    };

})();
window.onTVBack = function () { window.location.href = '../index.html'; return true; };
