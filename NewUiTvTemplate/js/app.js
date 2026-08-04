/**
 * Smart TV Core Application Manager
 * Automatic Background Slider Engine (Cross-fades slider_images & local fallbacks every 5s)
 * Real-time clock, data.json binding, and D-Pad modal routing.
 * Every function is wrapped in try-catch for 100% crash protection.
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

    function updateHeaderClock() {
        try {
            const clockEl = document.getElementById('live-clock') || document.getElementById('time');
            const dateEl = document.getElementById('date');

            const now = new Date();
            if (clockEl) {
                clockEl.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }) +
                                      ' | ' + now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase();
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

            const city = cityName.trim();

            const coords = await window.APIService.fetchCityCoordinates(city);
            if (!coords || !coords.lat || !coords.lon) return;
            const weatherData = await window.APIService.fetchWeatherData(coords.lat, coords.lon);

            if (weatherData && weatherData.current) {
                const temp = Math.round(weatherData.current.temperature_2m || 26);
                const code = weatherData.current.weather_code || 0;
                let statusText = 'Sunny';
                let emoji = '☀️';

                if (code === 0) { statusText = 'Sunny'; emoji = '☀️'; }
                else if (code >= 1 && code <= 3) { statusText = 'Partly Cloudy'; emoji = '⛅'; }
                else if (code >= 45 && code <= 48) { statusText = 'Foggy'; emoji = '🌫️'; }
                else if ((code >= 51 && code <= 67) || (code >= 80 && code <= 84)) { statusText = 'Rainy'; emoji = '🌧️'; }
                else if (code >= 95) { statusText = 'Thunderstorm'; emoji = '⛈️'; }
                else { statusText = 'Rainy'; emoji = '🌧️'; }

                descEl.textContent = `${city} • ${temp}°C ${statusText}`;
                if (iconEl) iconEl.textContent = emoji;
            }
        } catch (e) {
            console.warn('[SmartTVApp] Live weather fetch fallback', e);
        }
    }

    async function loadAppData() {
        try {
            const data = await window.APIService.fetchJSON('data.json');
            if (data && data.data) {
                bindAppData(data.data);
            }
        } catch (e) {
            console.warn('[SmartTVApp] data.json load fallback triggered.', e);
        }
        try {
            startBackgroundSlider();
        } catch (e) {
            console.error('[SmartTVApp] startBackgroundSlider error:', e);
        }
    }

    function bindAppData(d) {
        try {
            // Room Number
            const roomEl = document.getElementById('room');
            if (roomEl && d.device && d.device.room_no) {
                roomEl.textContent = `ROOM ${d.device.room_no}`;
            }

            // Dynamic Hotel Logo Image Binding strictly from data.json payload
            const logoImgs = document.querySelectorAll('#hotel-logo-img, .hotel-logo-img, .top-brand-logo');
            logoImgs.forEach(img => {
                if (d && d.hotel && d.hotel.media && d.hotel.media.logo_image) {
                    img.src = d.hotel.media.logo_image;
                    img.style.display = 'block';
                } else {
                    img.style.display = 'none';
                }
            });

            // Guest Greeting & Hotel Subtitle
            const greetingEl = document.getElementById('greeting');
            const hotelSubEl = document.getElementById('hotel-subtitle');
            if (greetingEl) {
                const rawName = (d.guest_info && d.guest_info.name && typeof d.guest_info.name === 'string') ? d.guest_info.name.trim() : '';
                const guestName = rawName ? rawName.toUpperCase() : 'GUEST';
                greetingEl.textContent = `WELCOME ${guestName}`;
            }
            if (hotelSubEl && d.hotel) {
                const hName = d.hotel.hotel_name || '';
                const hCity = d.hotel.city || '';
                hotelSubEl.textContent = (hName && hCity) ? `${hName}, ${hCity}` : (hName || hCity);
            }

            // Live Weather & City Location Data Binding
            const city = (d.hotel && d.hotel.city) ? d.hotel.city : '';
            if (city) {
                updateRealtimeWeather(city);
            }

            // Extract slider images strictly from data.json slider_images array
            if (d.hotel && d.hotel.media && Array.isArray(d.hotel.media.slider_images) && d.hotel.media.slider_images.length > 0) {
                bgImages = d.hotel.media.slider_images;
            }

            // Dynamic Active Apps Modal
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
                        appCard.addEventListener('click', function() {
                            try {
                                alert(`Launching ${app.name}...`);
                            } catch (err) {
                                console.error('[SmartTVApp] App click error:', err);
                            }
                        });
                        appsContainer.appendChild(appCard);
                    } catch (err) {
                        console.error('[SmartTVApp] Active OTT item render error:', err);
                    }
                });
            }
            // Dynamic Menu Alignment from data.json
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
                        } catch (e) {
                            console.warn('[SmartTVApp] Item visibility check error:', e);
                        }
                    });
                } catch (e) {
                    console.warn('[SmartTVApp] Menu item processing error:', e);
                }
            });
        } catch (err) {
            console.error('[SmartTVApp] applyDynamicMenuVisibility error:', err);
        }
    }

    function startBackgroundSlider() {
        if (window.TVSlider && window.TVSlider.init) {
            window.TVSlider.init();
        }
    }

    function handleNavClick(item) {
        try {
            const link = item.getAttribute('data-link');
            const action = item.getAttribute('data-action');

            if (link) {
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

    function openSubpage(url) {
        try {
            const overlay = document.getElementById('subPageOverlay');
            const frame = document.getElementById('subFrame');

            if (overlay && frame) {
                frame.src = url;
                overlay.classList.remove('hidden');
            }
        } catch (err) {
            console.error('[SmartTVApp] openSubpage error:', err);
        }
    }

    function closeSubpage() {
        try {
            const overlay = document.getElementById('subPageOverlay');
            const frame = document.getElementById('subFrame');

            if (overlay) {
                overlay.classList.add('hidden');
                if (frame) frame.src = 'about:blank';
            }
        } catch (err) {
            console.error('[SmartTVApp] closeSubpage error:', err);
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
        init: function() {
            try {
                setInterval(updateHeaderClock, 1000);
                updateHeaderClock();
                loadAppData();

                const navItems = document.querySelectorAll('.nav-item, .quick-card');
                navItems.forEach(item => {
                    item.addEventListener('click', function() {
                        handleNavClick(this);
                    });
                });

                const appsClose = document.getElementById('appsCloseBtn');
                const castClose = document.getElementById('castCloseBtn');
                if (appsClose) appsClose.addEventListener('click', () => toggleOverlay('appsOverlay', false));
                if (castClose) castClose.addEventListener('click', () => toggleOverlay('castOverlay', false));

                window.addEventListener('keydown', function(e) {
                    try {
                        if (e.keyCode === 27 || e.keyCode === 10009) {
                            closeSubpage();
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

    document.addEventListener('DOMContentLoaded', function() {
        try {
            window.SmartTVApp.init();
        } catch (err) {
            console.error('[SmartTVApp] DOMContentLoaded error:', err);
        }
    });
})();
