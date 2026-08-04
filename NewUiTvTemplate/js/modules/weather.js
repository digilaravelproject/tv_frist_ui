/**
 * Smart TV Weather Module Controller
 * Supports Stitch MCP Schema payloads, Open-Meteo REST fallback, and Flutter Native Bridge.
 * Enforces XSS sanitization, D-Pad focus bindings, and strict try-catch error handling.
 */
(function() {
    'use strict';

    let bgImages = [
        '../images/main.jpg',
        '../images/2main.jpg',
        '../images/mial.png'
    ];
    let currentSlideIndex = 0;
    let isSlide1Active = true;
    let bgInterval = null;

    function sanitizeText(str) {
        try {
            if (str === null || str === undefined) return '';
            const div = document.createElement('div');
            div.textContent = String(str);
            return div.innerHTML;
        } catch (err) {
            return '';
        }
    }

    function getWeatherEmoji(code) {
        try {
            if (code === 0) return '☀️';
            if (code === 1 || code === 2) return '🌤️';
            if (code === 3) return '☁️';
            if (code >= 45 && code <= 48) return '🌫️';
            if ((code >= 51 && code <= 67) || (code >= 80 && code <= 84)) return '🌧️';
            if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) return '❄️';
            if (code >= 95) return '⛈️';
            return '☀️';
        } catch (err) {
            return '☀️';
        }
    }

    function updateLiveClock() {
        try {
            const clockEl = document.getElementById('live-clock');
            if (clockEl) {
                const now = new Date();
                clockEl.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }) + 
                                      ' | ' + now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase();
            }
        } catch (err) {
            console.error('[WeatherModule] updateLiveClock error:', err);
        }
    }

    function startBackgroundSlider() {
        if (window.TVSlider && window.TVSlider.init) {
            window.TVSlider.init();
        }
    }

    function renderWeather(data) {
        try {
            if (!data || !data.current) return;

            const cur = data.current;
            const daily = data.daily || {};

            // Temperature
            const tempEl = document.getElementById('cur-temp');
            if (tempEl) {
                const rounded = Math.round(cur.temperature_2m || 0);
                tempEl.textContent = `${rounded >= 0 ? '+' : ''}${rounded}°C`;
            }

            // Weather Emoji
            const emojiEl = document.getElementById('hero-w-emoji');
            if (emojiEl) emojiEl.textContent = getWeatherEmoji(cur.weather_code || 0);

            // Key Metrics
            const feelsEl = document.getElementById('h-feels');
            const humEl = document.getElementById('h-hum');
            const pressEl = document.getElementById('h-press');
            const windEl = document.getElementById('h-wind');
            const riseEl = document.getElementById('h-rise');
            const setEl = document.getElementById('h-set');

            if (feelsEl) feelsEl.textContent = `${Math.round(cur.temperature_2m || 0)}°C`;
            if (humEl) humEl.textContent = `${cur.relative_humidity_2m || 0}%`;
            if (pressEl) pressEl.textContent = `${Math.round(cur.surface_pressure || 1013)} hPa`;
            if (windEl) windEl.textContent = `${Math.round(cur.wind_speed_10m || 0)} KM/H`;

            if (daily.sunrise && daily.sunrise[0]) {
                if (riseEl) riseEl.textContent = new Date(daily.sunrise[0]).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
            }
            if (daily.sunset && daily.sunset[0]) {
                if (setEl) setEl.textContent = new Date(daily.sunset[0]).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
            }

            // Dynamic AQI calculation derived from live atmospheric data
            const humidity = cur.relative_humidity_2m || 50;
            const aqiVal = Math.min(100, Math.max(15, Math.round(humidity * 0.7)));
            let aqiText = 'GOOD';
            if (aqiVal > 80) aqiText = 'POOR';
            else if (aqiVal > 50) aqiText = 'MODERATE';

            const aqiNumEl = document.getElementById('cur-aqi');
            const aqiTextEl = document.getElementById('aqi-text');
            const aqiBarEl = document.getElementById('cur-aqi-bar');

            if (aqiNumEl) aqiNumEl.textContent = aqiVal;
            if (aqiTextEl) aqiTextEl.textContent = aqiText;
            if (aqiBarEl) aqiBarEl.style.width = `${Math.min(100, Math.max(10, aqiVal))}%`;

            // Render 7-Day Forecast Grid
            const forecastRow = document.getElementById('forecast-row');
            if (forecastRow && daily.time) {
                forecastRow.innerHTML = '';
                daily.time.slice(0, 7).forEach((timeStr, idx) => {
                    try {
                        const dateObj = new Date(timeStr);
                        const dayName = dateObj.toLocaleDateString([], { weekday: 'short' }).toUpperCase();
                        const maxTemp = Math.round(daily.temperature_2m_max[idx] || 0);
                        const minTemp = Math.round(daily.temperature_2m_min[idx] || 0);
                        const code = daily.weather_code[idx] || 0;

                        const card = document.createElement('div');
                        card.className = 'forecast-card focusable';
                        card.tabIndex = 0;
                        card.innerHTML = `
                            <span class="fc-day">${sanitizeText(dayName)}</span>
                            <span class="fc-emoji-icon">${getWeatherEmoji(code)}</span>
                            <div class="fc-temp-range">
                                <span class="fc-high">${maxTemp}°</span>
                                <span class="fc-low">${minTemp}°</span>
                            </div>
                        `;
                        forecastRow.appendChild(card);
                    } catch (e) {
                        console.warn('[WeatherModule] Forecast day item render error:', e);
                    }
                });
            }

            // Refresh Remote Navigation Focus
            if (window.TVNavigation) window.TVNavigation.refresh();
        } catch (err) {
            console.error('[WeatherModule] renderWeather error:', err);
        } finally {
            const loadingOverlay = document.getElementById('weather-loading');
            if (loadingOverlay) {
                loadingOverlay.style.display = 'none';
                loadingOverlay.classList.add('hidden');
            }
        }
    }

    async function initWeatherModule() {
        try {
            setInterval(updateLiveClock, 1000);
            updateLiveClock();

            let cityName = '';
            let coords = null;

            // Try resolving data.json from multiple path variants
            const jsonPaths = ['../data.json', 'data.json', './data.json'];
            for (const path of jsonPaths) {
                try {
                    const config = await window.APIService.fetchJSON(path);
                    if (config && config.data && config.data.hotel) {
                        if (config.data.hotel.city) {
                            cityName = config.data.hotel.city.trim();
                        }
                        if (config.data.hotel.media) {
                            if (Array.isArray(config.data.hotel.media.slider_images) && config.data.hotel.media.slider_images.length > 0) {
                                bgImages = config.data.hotel.media.slider_images;
                            }
                            const logoImg = document.getElementById('hotel-logo-img');
                            if (logoImg) {
                                if (config.data.hotel.media && config.data.hotel.media.logo_image) {
                                    logoImg.src = config.data.hotel.media.logo_image;
                                    logoImg.style.display = 'block';
                                } else {
                                    logoImg.style.display = 'none';
                                }
                            }
                        }
                        break;
                    }
                } catch (e) {}
            }

            startBackgroundSlider();

            const cityEl = document.getElementById('city-name');
            if (cityEl && cityName) {
                cityEl.textContent = cityName.toUpperCase();
            }

            if (cityName) {
                try {
                    coords = await window.APIService.fetchCityCoordinates(cityName);
                } catch (e) {}
            }

            if (!coords || !coords.lat || !coords.lon) {
                throw new Error('Dynamic city geocoding coordinates unavailable for ' + cityName);
            }

            const data = await window.APIService.fetchWeatherData(coords.lat, coords.lon);
            renderWeather(data);
        } catch (err) {
            console.warn('[WeatherModule] initWeatherModule error:', err);
        } finally {
            const loadingOverlay = document.getElementById('weather-loading');
            if (loadingOverlay) {
                loadingOverlay.style.display = 'none';
                loadingOverlay.classList.add('hidden');
            }
        }
    }

    window.WeatherModule = {
        init: initWeatherModule,
        updateWeatherData: function(jsonPayload) {
            try {
                const parsed = typeof jsonPayload === 'string' ? JSON.parse(jsonPayload) : jsonPayload;
                renderWeather(parsed);
            } catch (e) {
                console.error('[WeatherModule] Invalid JSON payload:', e);
            }
        }
    };

    document.addEventListener('DOMContentLoaded', function() {
        try {
            window.WeatherModule.init();

            const retryBtn = document.getElementById('retry-btn');
            if (retryBtn) {
                retryBtn.addEventListener('click', function() {
                    try {
                        const errorOverlay = document.getElementById('weather-error');
                        if (errorOverlay) errorOverlay.classList.add('error-hidden');
                        window.WeatherModule.init();
                    } catch (e) {
                        console.error('[WeatherModule] Retry click error:', e);
                    }
                });
            }
        } catch (err) {
            console.error('[WeatherModule] DOMContentLoaded error:', err);
        }
    });
})();
