/**
 * Smart TV Core Application Manager (index.html)
 * Real-time header clock, data.json binding, D-Pad modal routing, and offline safeguards.
 * 100% Wrapped in Try-Catch Guards for Maximum Stability.
 */
(function () {
    'use strict';

    function updateHeaderClock() {
        try {
            const clockEl = document.getElementById('live-clock') || document.getElementById('time');
            const dateEl = document.getElementById('date');
            const now = new Date();

            if (clockEl) {
                const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
                const dateStr = now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase();
                clockEl.textContent = `${timeStr} | ${dateStr}`;
            }
            if (dateEl) {
                dateEl.textContent = now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase();
            }
        } catch (err) {
            console.error('[SmartTVApp] updateHeaderClock error:', err);
        }
    }

    async function updateRealtimeWeather(cityName) {
        try {
            const descEl = document.getElementById('weather-quick-desc');
            const iconEl = document.getElementById('weather-quick-icon');
            if (!descEl || !cityName) return;

            if (!navigator.onLine) {
                descEl.textContent = 'No Internet';
                return;
            }

            const city = cityName.trim();
            const coords = await window.APIService.fetchCityCoordinates(city);
            if (!coords || !coords.lat || !coords.lon) {
                descEl.textContent = `${city} • No Internet`;
                return;
            }

            const weatherData = await window.APIService.fetchWeatherData(coords.lat, coords.lon);
            if (weatherData && weatherData.current) {
                const temp = Math.round(weatherData.current.temperature_2m || 0);
                const code = weatherData.current.weather_code || 0;
                let statusText = 'Sunny';

                if (code === 0) { statusText = 'Sunny'; }
                else if (code >= 1 && code <= 3) { statusText = 'Partly Cloudy'; }
                else if (code >= 45 && code <= 48) { statusText = 'Foggy'; }
                else if ((code >= 51 && code <= 67) || (code >= 80 && code <= 84)) { statusText = 'Rainy'; }
                else if (code >= 95) { statusText = 'Thunderstorm'; }
                else { statusText = 'Rainy'; }

                descEl.textContent = `${city} • ${temp}°C ${statusText}`;
                if (iconEl && !iconEl.querySelector('img')) {
                    iconEl.innerHTML = '<img src="images/icons/weather.png" alt="Weather">';
                }
            } else {
                descEl.textContent = `${city} • No Internet`;
            }
        } catch (err) {
            console.warn('[SmartTVApp] updateRealtimeWeather error:', err);
        }
    }

    async function loadAppData() {
        try {
            const data = await window.APIService.fetchJSON('data.json');
            if (data && data.data) {
                bindAppData(data.data);
            }
        } catch (e) {
            console.warn('[SmartTVApp] loadAppData fallback triggered:', e);
        }
    }

    function bindAppData(d) {
        try {
            if (!d) return;

            // 1. Room Number
            const roomEl = document.getElementById('room');
            if (roomEl && d.device && d.device.room_no) {
                roomEl.textContent = `ROOM ${d.device.room_no}`;
            }

            // 2. Hotel Logo Binding (Base64 LocalStorage Cached)
            const logoImgs = document.querySelectorAll('#hotel-logo-img, .hotel-logo-img, .top-brand-logo');
            const logoUrl = (d.hotel && d.hotel.media) ? d.hotel.media.logo_image : '';
            logoImgs.forEach(img => {
                window.APIService.bindImageWithCache(img, logoUrl, 'images/logo.png');
            });

            // 3. Guest Greeting & Subtitle
            const greetingEl = document.getElementById('greeting');
            const hotelSubEl = document.getElementById('hotel-subtitle');
            if (greetingEl) {
                const rawName = (d.guest_info && d.guest_info.name && typeof d.guest_info.name === 'string') ? d.guest_info.name.trim() : '';
                greetingEl.textContent = `WELCOME ${rawName ? rawName.toUpperCase() : 'GUEST'}`;
            }
            if (hotelSubEl && d.hotel) {
                const hName = d.hotel.hotel_name || '';
                const hCity = d.hotel.city || '';
                hotelSubEl.textContent = (hName && hCity) ? `${hName}, ${hCity}` : (hName || hCity);
            }

            // 4. Live Weather Sync
            if (d.hotel && d.hotel.city) {
                updateRealtimeWeather(d.hotel.city);
            }

            // 5. Installed Applications Grid Binding
            const appsContainer = document.getElementById('apps-container');
            if (appsContainer && d.active_ott && Array.isArray(d.active_ott)) {
                appsContainer.innerHTML = '';
                d.active_ott.forEach(app => {
                    try {
                        const appCard = document.createElement('div');
                        appCard.className = 'app-card focusable';
                        appCard.tabIndex = 0;
                        appCard.innerHTML = `
                            <div class="app-icon-wrapper">📱</div>
                            <span class="app-name">${app.name}</span>
                        `;
                        appCard.addEventListener('click', () => {
                            try {
                                const pkgName = app.package_name || app.packageName || app.pkg || app.name;
                                console.log('[SmartTVApp] Launching native app:', app.name, pkgName);
                                if (window.flutterBridge && typeof window.flutterBridge.launchApp === 'function') {
                                    window.flutterBridge.launchApp(pkgName);
                                } else if (window.FlutterBridge && typeof window.FlutterBridge.postMessage === 'function') {
                                    window.FlutterBridge.postMessage(JSON.stringify({ method: 'launchApp', args: [pkgName], id: Date.now() }));
                                }
                            } catch (err) {
                                console.error('[SmartTVApp] App launch error:', err);
                            }
                        });
                        appsContainer.appendChild(appCard);
                    } catch (err) {
                        console.error('[SmartTVApp] Active OTT item render error:', err);
                    }
                });
            }

            // 6. Dynamic Menu Visibility Alignment from data.json
            applyDynamicMenuVisibility(d);
        } catch (err) {
            console.error('[SmartTVApp] bindAppData error:', err);
        }
    }

    function applyDynamicMenuVisibility(config) {
        try {
            if (!config || !config.menus || !Array.isArray(config.menus)) return;

            const menuMap = {
                'apps': ['apps', 'applications'],
                'applications': ['apps', 'applications'],
                'live_tv': ['livetv', 'live_tv'],
                'livetv': ['livetv', 'live_tv'],
                'input': ['input'],
                'screen_cast': ['cast', 'screen_cast'],
                'cast': ['cast', 'screen_cast'],
                'languages': ['pages/languages.html', 'languages.html', 'languages'],
                'hotel_info': ['pages/hotel_info.html', './hotel_info/hotel_info.html', 'hotel_info'],
                'amenities': ['pages/amenities.html', './amenities/amenities.html', 'amenities'],
                'travel': ['pages/travel.html', './travel/travel.html', 'travel'],
                'flights': ['pages/flights.html', './flights/flights.html', 'flights'],
                'our_city': ['pages/city.html', './city/city.html', 'our_city', 'city'],
                'city': ['pages/city.html', './city/city.html', 'our_city', 'city'],
                'weather': ['pages/weather.html', './weather/weather.html', 'weather'],
                'settings': ['pages/settings.html', './settings.html', 'settings']
            };

            config.menus.forEach(menu => {
                try {
                    if (!menu || !menu.id) return;
                    const keys = menuMap[menu.id] || [menu.id];
                    const status = (menu.status || '').toLowerCase();

                    document.querySelectorAll('.focusable, .nav-item, .grid-tile-card').forEach(item => {
                        try {
                            const action = item.getAttribute('data-action');
                            const link = item.getAttribute('data-link') || item.getAttribute('href');
                            const menuId = item.getAttribute('data-menu-id');

                            if (keys.includes(action) || keys.includes(link) || keys.includes(menuId)) {
                                if (status === 'hide' || status === 'disabled' || status === '0' || status === 'false') {
                                    item.style.display = 'none';
                                } else if (status === 'show' || status === '1' || status === 'true') {
                                    item.style.display = '';
                                }
                            }
                        } catch (e) {}
                    });
                } catch (e) {}
            });
        } catch (err) {
            console.error('[SmartTVApp] applyDynamicMenuVisibility error:', err);
        }
    }

    function handleNavClick(item) {
        try {
            if (!item) return;
            const link = item.getAttribute('data-link');
            const action = item.getAttribute('data-action');
            const menuId = item.getAttribute('data-menu-id');

            if (link) {
                // 1. Coming Soon Guard for City Guide & Explore Travel
                if (link.includes('city') || link.includes('travel') || menuId === 'our_city' || menuId === 'travel') {
                    if (window.TVModal && window.TVModal.showNotice) {
                        const labelEl = item.querySelector('.nav-label');
                        const featureName = labelEl ? labelEl.textContent : 'This Feature';
                        window.TVModal.showNotice(
                            'Coming Soon',
                            `${featureName} is coming soon to your in-room Smart TV experience. Stay tuned!`,
                            '🚀',
                            'OK'
                        );
                    }
                    return;
                }

                // 2. Offline Guard for Live Weather & Flight Status
                if ((link.includes('weather') || link.includes('flight')) && !navigator.onLine) {
                    if (window.TVModal && window.TVModal.showOfflineNotice) {
                        window.TVModal.showOfflineNotice({
                            title: 'No Internet Connection',
                            message: 'Live satellite feeds require an active internet connection. Please check your TV Wi-Fi or Ethernet settings.',
                            buttonText: 'OK'
                        });
                    }
                    return;
                }
                window.location.href = link;
            } else if (action === 'apps') {
                toggleOverlay('appsOverlay', true);
            } else if (action === 'cast') {
                toggleOverlay('castOverlay', true);
            } else if (action === 'livetv') {
                alert('Live TV Stream Initializing...');
            }
        } catch (err) {
            console.error('[SmartTVApp] handleNavClick error:', err);
        }
    }

    function toggleOverlay(id, show) {
        try {
            const el = document.getElementById(id);
            if (el) {
                if (show) el.classList.remove('hidden');
                else el.classList.add('hidden');
                if (window.TVNavigation) window.TVNavigation.refresh();
            }
        } catch (err) {
            console.error('[SmartTVApp] toggleOverlay error:', err);
        }
    }

    window.SmartTVApp = {
        init: function () {
            try {
                setInterval(updateHeaderClock, 1000);
                updateHeaderClock();
                loadAppData();

                window.addEventListener('offline', () => {
                    const descEl = document.getElementById('weather-quick-desc');
                    if (descEl) descEl.textContent = 'No Internet';
                });

                window.addEventListener('online', () => loadAppData());

                document.querySelectorAll('.nav-item, .quick-card').forEach(item => {
                    item.addEventListener('click', function () {
                        handleNavClick(this);
                    });
                });

                const appsClose = document.getElementById('appsCloseBtn');
                const castClose = document.getElementById('castCloseBtn');
                if (appsClose) appsClose.addEventListener('click', () => toggleOverlay('appsOverlay', false));
                if (castClose) castClose.addEventListener('click', () => toggleOverlay('castOverlay', false));

                window.addEventListener('keydown', (e) => {
                    try {
                        if (e.keyCode === 27 || e.keyCode === 10009) {
                            toggleOverlay('appsOverlay', false);
                            toggleOverlay('castOverlay', false);
                        }
                    } catch (err) {
                        console.error('[SmartTVApp] Keydown event error:', err);
                    }
                });
            } catch (err) {
                console.error('[SmartTVApp] init error:', err);
            }
        }
    };

    document.addEventListener('DOMContentLoaded', () => {
        try {
            window.SmartTVApp.init();
        } catch (err) {
            console.error('[SmartTVApp] DOMContentLoaded error:', err);
        }
    });
})();
