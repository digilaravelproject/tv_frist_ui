/**
 * Smart TV Unique Split Dual-Panel Controller (index2.html Variant 2)
 * Handles auto background slider (slider_images), live clock, data.json binding, and Split Grid Tile navigation.
 * Wrapped in strict try-catch handlers for zero runtime crashes.
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
            const timeEl = document.getElementById('time');
            const dateEl = document.getElementById('date');

            const now = new Date();
            if (timeEl) {
                timeEl.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
            }
            if (dateEl) {
                dateEl.textContent = now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase();
            }
        } catch (err) {
            console.error('[SplitTVApp] updateHeaderClock error:', err);
        }
    }

    async function loadAppData() {
        try {
            const data = await window.APIService.fetchJSON('data.json');
            if (data && data.data) {
                bindAppData(data.data);
            }
        } catch (e) {
            console.warn('[SplitTVApp] data.json load fallback triggered.', e);
        }
        try {
            startBackgroundSlider();
        } catch (e) {
            console.error('[SplitTVApp] startBackgroundSlider error:', e);
        }
    }

    function bindAppData(d) {
        try {
            // Room Number
            const roomEl = document.getElementById('room');
            if (roomEl && d.device && d.device.room_no) {
                roomEl.textContent = `🔑 ROOM ${d.device.room_no}`;
            }

            // Guest Greeting & Hotel Info
            const greetingEl = document.getElementById('greeting');
            const hotelTitleEl = document.getElementById('hotel-title');
            const hotelDescEl = document.getElementById('hotel-description');

            if (greetingEl) {
                const rawName = (d.guest_info && d.guest_info.name && typeof d.guest_info.name === 'string') ? d.guest_info.name.trim() : '';
                const guestName = rawName ? rawName : 'Guest';
                greetingEl.textContent = `Welcome, ${guestName}`;
            }

            if (hotelTitleEl && d.hotel && d.hotel.hotel_name) {
                hotelTitleEl.textContent = d.hotel.hotel_name.toUpperCase();
            }

            // Dynamic Hotel Logo Image Binding strictly from data.json payload (Base64 + Local Storage Caching)
            const logoImg = document.getElementById('hotel-logo-img');
            const logoUrl = (d && d.hotel && d.hotel.media) ? d.hotel.media.logo_image : '';
            if (logoImg) {
                window.APIService.bindImageWithCache(logoImg, logoUrl, 'images/logo.png');
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
                                const pkgName = app.package_name || app.packageName || app.pkg || app.name;
                                console.log('[SplitTVApp] Launching native application:', app.name, pkgName);
                                if (window.flutterBridge && typeof window.flutterBridge.launchApp === 'function') {
                                    window.flutterBridge.launchApp(pkgName);
                                } else if (window.FlutterBridge && typeof window.FlutterBridge.postMessage === 'function') {
                                    window.FlutterBridge.postMessage(JSON.stringify({ method: 'launchApp', args: [pkgName], id: Date.now() }));
                                }
                            } catch (err) {
                                console.error('[SplitTVApp] App click error:', err);
                            }
                        });
                        appsContainer.appendChild(appCard);
                    } catch (err) {
                        console.error('[SplitTVApp] Active OTT item render error:', err);
                    }
                });
            }

            // Dynamic Menu Alignment from data.json
            applyDynamicMenuVisibility(d);
        } catch (err) {
            console.error('[SplitTVApp] bindAppData error:', err);
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
                            console.warn('[SplitTVApp] Item visibility check error:', e);
                        }
                    });
                } catch (e) {
                    console.warn('[SplitTVApp] Menu item processing error:', e);
                }
            });
        } catch (err) {
            console.error('[SplitTVApp] applyDynamicMenuVisibility error:', err);
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
            const menuId = item.getAttribute('data-menu-id');

            if (link) {
                // Coming Soon feature guard for City Guide & Explore Travel
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

                // If navigation requires internet (weather/flight) and device is offline, block navigation & show No Internet modal on homepage
                if ((link.includes('weather') || link.includes('flight')) && !navigator.onLine) {
                    if (window.TVModal && window.TVModal.showOfflineNotice) {
                        window.TVModal.showOfflineNotice({
                            title: 'No Internet Connection',
                            message: 'Live satellite weather feeds require an active internet connection. Please check your TV Wi-Fi or Ethernet settings.',
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
            console.error('[SplitTVApp] handleNavClick error:', err);
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
            console.error('[SplitTVApp] openSubpage error:', err);
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
            console.error('[SplitTVApp] closeSubpage error:', err);
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
            console.error('[SplitTVApp] toggleOverlay error:', err);
        }
    }

    window.SplitTVApp = {
        init: function() {
            try {
                setInterval(updateHeaderClock, 1000);
                updateHeaderClock();
                loadAppData();

                const tileItems = document.querySelectorAll('.grid-tile-card');
                tileItems.forEach(item => {
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
                        console.error('[SplitTVApp] Keydown event error:', err);
                    }
                });
            } catch (err) {
                console.error('[SplitTVApp] init error:', err);
            }
        }
    };

    document.addEventListener('DOMContentLoaded', function() {
        try {
            window.SplitTVApp.init();
        } catch (err) {
            console.error('[SplitTVApp] DOMContentLoaded error:', err);
        }
    });
})();
