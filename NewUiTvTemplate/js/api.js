/**
 * Unified API Data Service & Universal TV Background Slider Engine
 * Strict Network-First with LocalStorage Offline Caching Architecture
 * 1. Online: Direct network fetch & update LocalStorage cache.
 * 2. Offline: Read from LocalStorage cache & local fallbacks.
 */
(function() {
    'use strict';

    const CACHE_PREFIX = 'tv_app_cache_';

    /**
     * Reusable Glassmorphism Smart TV Modal Component System
     * Call window.TVModal.showOfflineNotice() anywhere in the application.
     */
    window.TVModal = {
        showNotice: function(title, message, iconEmoji, buttonText) {
            const titleStr = title || 'Coming Soon';
            const msgStr = message || 'This feature is coming soon to your Smart TV experience.';
            const iconStr = iconEmoji || '✨';
            const btnStr = buttonText || 'OK';

            let modal = document.getElementById('tv-offline-modal');
            if (modal) {
                modal.style.display = 'flex';
                const iconEl = modal.querySelector('.tv-offline-icon-badge');
                const titleEl = modal.querySelector('.tv-offline-title');
                const descEl = modal.querySelector('.tv-offline-desc');
                if (iconEl) iconEl.textContent = iconStr;
                if (titleEl) titleEl.textContent = titleStr;
                if (descEl) descEl.textContent = msgStr;
            } else {
                modal = document.createElement('div');
                modal.id = 'tv-offline-modal';
                modal.className = 'tv-offline-modal-overlay';
                modal.innerHTML = `
                    <div class="tv-offline-modal-card">
                        <div class="tv-offline-icon-badge">${iconStr}</div>
                        <h2 class="tv-offline-title">${titleStr}</h2>
                        <p class="tv-offline-desc">${msgStr}</p>
                        <button id="tv-offline-close-btn" class="tv-offline-btn focusable" tabindex="0">${btnStr}</button>
                    </div>
                `;
                document.body.appendChild(modal);

                const closeBtn = document.getElementById('tv-offline-close-btn');
                if (closeBtn) {
                    closeBtn.addEventListener('click', function() {
                        window.TVModal.hideNotice();
                    });
                }
            }

            const btn = document.getElementById('tv-offline-close-btn');
            if (btn) btn.focus();

            if (window.TVNavigation) window.TVNavigation.refresh();
        },

        showOfflineNotice: function(options) {
            options = options || {};
            this.showNotice(
                options.title || 'No Internet Connection',
                options.message || 'Live feeds require an active network connection. Please check your TV Wi-Fi or Ethernet settings.',
                '📡',
                options.buttonText || 'OK'
            );
        },

        hideNotice: function() {
            const modal = document.getElementById('tv-offline-modal');
            if (modal) {
                modal.style.display = 'none';
            }
            if (window.TVNavigation) window.TVNavigation.refresh();
        },

        hideOfflineNotice: function() {
            this.hideNotice();
        }
    };

    window.APIService = {
        fetchJSON: async function(url) {
            try {
                const cacheKey = CACHE_PREFIX + url;

                // Step 1: If Internet IS connected -> Direct network fetch & update LocalStorage cache
                if (navigator.onLine) {
                    try {
                        const response = await fetch(url, { cache: 'reload' });
                        if (response.ok) {
                            const liveData = await response.json();
                            try {
                                localStorage.setItem(cacheKey, JSON.stringify({
                                    timestamp: Date.now(),
                                    data: liveData
                                }));
                            } catch (e) {}
                            return liveData;
                        }
                    } catch (netErr) {
                        console.warn('[APIService] Online network fetch failed, using cache:', netErr);
                    }
                }

                // Step 2: If Internet NOT connected (Offline) -> Read from LocalStorage cache
                const cachedLS = localStorage.getItem(cacheKey);
                if (cachedLS) {
                    try {
                        const parsed = JSON.parse(cachedLS);
                        if (parsed && parsed.data) return parsed.data;
                    } catch (e) {}
                }

                // Secondary attempt fallback
                const res = await fetch(url);
                if (res.ok) return await res.json();

                throw new Error(`Data unavailable offline for ${url}`);
            } catch (err) {
                console.error('[APIService] fetchJSON error:', err);
                throw err;
            }
        },

        /**
         * Strict Network-First Image Loader & LocalStorage Cache
         * 1. Online: Direct remote URL load + convert to Base64 & save in LocalStorage on load.
         * 2. Offline: Read Base64 from LocalStorage (or local fallback image asset).
         */
        bindImageWithCache: function(imgElement, remoteUrl, fallbackLocalPath) {
            if (!imgElement) return;

            if (!remoteUrl) {
                if (fallbackLocalPath) {
                    imgElement.src = fallbackLocalPath;
                    imgElement.style.display = 'block';
                } else {
                    imgElement.style.display = 'none';
                }
                return;
            }

            const cacheKey = 'img_b64_' + remoteUrl;

            // Step 1: If Internet IS connected -> Direct live URL load + save Base64 to LocalStorage on load
            if (navigator.onLine) {
                imgElement.src = remoteUrl;
                imgElement.style.display = 'block';

                imgElement.onload = function() {
                    try {
                        imgElement.style.display = 'block';
                        if (imgElement.complete && imgElement.naturalWidth > 0) {
                            const canvas = document.createElement('canvas');
                            canvas.width = imgElement.naturalWidth;
                            canvas.height = imgElement.naturalHeight;
                            const ctx = canvas.getContext('2d');
                            ctx.drawImage(imgElement, 0, 0);
                            const dataURL = canvas.toDataURL('image/png');
                            localStorage.setItem(cacheKey, dataURL);
                        }
                    } catch (e) {
                        // Ignore canvas export errors if cross-origin restricts canvas export
                    }
                };

                imgElement.onerror = function() {
                    let cachedB64 = null;
                    try { cachedB64 = localStorage.getItem(cacheKey); } catch (e) {}

                    if (cachedB64) {
                        imgElement.src = cachedB64;
                        imgElement.style.display = 'block';
                    } else if (fallbackLocalPath) {
                        imgElement.src = fallbackLocalPath;
                        imgElement.style.display = 'block';
                    }
                };
            } else {
                // Step 2: If Internet NOT connected (Offline) -> Read Base64 from LocalStorage
                let cachedB64 = null;
                try { cachedB64 = localStorage.getItem(cacheKey); } catch (e) {}

                if (cachedB64) {
                    imgElement.src = cachedB64;
                    imgElement.style.display = 'block';
                } else if (fallbackLocalPath) {
                    imgElement.src = fallbackLocalPath;
                    imgElement.style.display = 'block';
                } else {
                    imgElement.style.display = 'none';
                }
            }
        },

        fetchCityCoordinates: async function(cityName) {
            if (!cityName || !navigator.onLine) return null;
            try {
                const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityName)}&count=1`;
                const res = await this.fetchJSON(url);
                if (res && res.results && res.results.length > 0) {
                    return {
                        lat: res.results[0].latitude,
                        lon: res.results[0].longitude
                    };
                }
            } catch (e) {}
            return null;
        },

        fetchWeatherData: async function(lat, lon) {
            if (!navigator.onLine) return null;
            try {
                const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code,surface_pressure,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset&timezone=auto`;
                return await this.fetchJSON(url);
            } catch (err) {
                console.error('[APIService] Weather API error:', err);
                return null;
            }
        }
    };

    /**
     * Universal TV Background Slider Module (DRY Engine)
     */
    window.TVSlider = {
        init: async function() {
            try {
                const slide1 = document.getElementById('bg-slide-1');
                const slide2 = document.getElementById('bg-slide-2');
                if (!slide1 || !slide2) return;

                const isSubpage = window.location.pathname.includes('/pages/');
                const basePath = isSubpage ? '../' : './';
                let sliderImages = [
                    basePath + 'images/main.jpg',
                    basePath + 'images/2main.jpg'
                ];

                try {
                    const data = await window.APIService.fetchJSON(basePath + 'data.json');
                    if (data && data.data && data.data.hotel && data.data.hotel.media && Array.isArray(data.data.hotel.media.slider_images) && data.data.hotel.media.slider_images.length > 0) {
                        sliderImages = data.data.hotel.media.slider_images;
                    }
                } catch (e) {}

                function setSlideBackground(slideEl, url, fallbackPath) {
                    if (!url) return;

                    const cacheKey = 'img_b64_' + url;
                    let cached = null;
                    try { cached = localStorage.getItem(cacheKey); } catch (e) {}

                    if (navigator.onLine) {
                        const tempImg = new Image();
                        tempImg.src = url;
                        tempImg.onload = function() {
                            slideEl.style.backgroundImage = `url('${url}')`;
                            try {
                                const canvas = document.createElement('canvas');
                                canvas.width = tempImg.naturalWidth;
                                canvas.height = tempImg.naturalHeight;
                                const ctx = canvas.getContext('2d');
                                ctx.drawImage(tempImg, 0, 0);
                                localStorage.setItem(cacheKey, canvas.toDataURL('image/jpeg'));
                            } catch (e) {}
                        };
                        tempImg.onerror = function() {
                            const fallbackUrl = cached || fallbackPath;
                            slideEl.style.backgroundImage = `url('${fallbackUrl}')`;
                        };
                    } else {
                        const fallbackUrl = cached || fallbackPath;
                        slideEl.style.backgroundImage = `url('${fallbackUrl}')`;
                    }
                }

                if (sliderImages.length === 1) {
                    setSlideBackground(slide1, sliderImages[0], basePath + 'images/main.jpg');
                    slide1.classList.add('active-slide', 'single-zoom-pulse');
                    slide2.style.display = 'none';
                    return;
                }

                let curIndex = 0;
                let isSlide1Active = true;

                setSlideBackground(slide1, sliderImages[0], basePath + 'images/main.jpg');
                setSlideBackground(slide2, sliderImages[1 % sliderImages.length], basePath + 'images/2main.jpg');
                slide1.classList.add('active-slide');

                setInterval(() => {
                    try {
                        curIndex = (curIndex + 1) % sliderImages.length;
                        const nextUrl = sliderImages[curIndex];

                        if (isSlide1Active) {
                            setSlideBackground(slide2, nextUrl, basePath + 'images/main.jpg');
                            slide2.classList.add('active-slide');
                            slide1.classList.remove('active-slide');
                        } else {
                            setSlideBackground(slide1, nextUrl, basePath + 'images/main.jpg');
                            slide1.classList.add('active-slide');
                            slide2.classList.remove('active-slide');
                        }
                        isSlide1Active = !isSlide1Active;
                    } catch (err) {
                        console.error('[TVSlider] Crossfade error:', err);
                    }
                }, 5000);
            } catch (err) {
                console.error('[TVSlider] init error:', err);
            }
        }
    };

    document.addEventListener('DOMContentLoaded', function() {
        try {
            if (window.TVSlider && window.TVSlider.init) {
                window.TVSlider.init();
            }
        } catch (e) {}
    });
})();
