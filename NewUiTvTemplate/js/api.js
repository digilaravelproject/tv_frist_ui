/**
 * Unified API Data Service & Universal TV Background Slider Engine
 * DRY, High-Performance, Strict Try-Catch Guards, and Network-First Offline Caching
 */
(function () {
    'use strict';

    const CACHE_PREFIX = 'tv_app_cache_';
    const IMG_CACHE_PREFIX = 'img_b64_';

    /**
     * Helper: Safe LocalStorage Access Wrapper
     */
    const Storage = {
        get(key) {
            try {
                return localStorage.getItem(key);
            } catch (e) {
                return null;
            }
        },
        set(key, value) {
            try {
                localStorage.setItem(key, value);
            } catch (e) { }
        }
    };

    /**
     * Helper: Convert Image Element to Base64 dataURL via Canvas
     */
    function cacheImageAsBase64(imgElement, cacheKey, format) {
        try {
            if (imgElement && imgElement.complete && imgElement.naturalWidth > 0) {
                const canvas = document.createElement('canvas');
                canvas.width = imgElement.naturalWidth;
                canvas.height = imgElement.naturalHeight;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(imgElement, 0, 0);
                const dataURL = canvas.toDataURL(format || 'image/png');
                Storage.set(cacheKey, dataURL);
            }
        } catch (e) {
            // Ignore canvas export errors if cross-origin restricts canvas export
        }
    }

    /**
     * Reusable Glassmorphism Smart TV Modal Component System
     */
    window.TVModal = {
        showNotice(title, message, iconEmoji, buttonText) {
            try {
                const titleStr = title || 'Notice';
                const msgStr = message || 'Information updated.';
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
                        closeBtn.addEventListener('click', () => this.hideNotice());
                    }
                }

                const btn = document.getElementById('tv-offline-close-btn');
                if (btn) btn.focus();

                if (window.TVNavigation) window.TVNavigation.refresh();
            } catch (err) {
                console.error('[TVModal] showNotice error:', err);
            }
        },

        showOfflineNotice(options) {
            options = options || {};
            this.showNotice(
                options.title || 'No Internet Connection',
                options.message || 'Live feeds require an active network connection. Please check your TV Wi-Fi or Ethernet settings.',
                '📡',
                options.buttonText || 'OK'
            );
        },

        hideNotice() {
            try {
                const modal = document.getElementById('tv-offline-modal');
                if (modal) modal.style.display = 'none';
                if (window.TVNavigation) window.TVNavigation.refresh();
            } catch (err) {
                console.error('[TVModal] hideNotice error:', err);
            }
        },

        hideOfflineNotice() {
            this.hideNotice();
        }
    };

    /**
     * Unified APIService - Handles Network-First JSON & Image Caching with Strict Guards
     */
    window.APIService = {
        async fetchJSON(url) {
            if (!url) return null;
            const cacheKey = CACHE_PREFIX + url;

            try {
                // Step 1: Network-First if Online
                if (navigator.onLine) {
                    try {
                        const response = await fetch(url, { cache: 'reload' });
                        if (response.ok) {
                            const liveData = await response.json();
                            Storage.set(cacheKey, JSON.stringify({ timestamp: Date.now(), data: liveData }));
                            return liveData;
                        }
                    } catch (netErr) {
                        console.warn('[APIService] Network fetch failed, using cache:', netErr);
                    }
                }

                // Step 2: Read LocalStorage Cache if Offline or Fetch Failed
                const cachedLS = Storage.get(cacheKey);
                if (cachedLS) {
                    const parsed = JSON.parse(cachedLS);
                    if (parsed && parsed.data) return parsed.data;
                }

                // Secondary direct fetch fallback
                const res = await fetch(url);
                if (res.ok) return await res.json();
            } catch (err) {
                console.error(`[APIService] fetchJSON error for ${url}:`, err);
            }
            return null;
        },

        /**
         * Dynamic Image Loader with Base64 Caching (DRY Implementation)
         */
        bindImageWithCache(imgElement, remoteUrl, fallbackLocalPath) {
            try {
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

                const cacheKey = IMG_CACHE_PREFIX + remoteUrl;
                const cachedB64 = Storage.get(cacheKey);

                if (navigator.onLine) {
                    imgElement.src = remoteUrl;
                    imgElement.style.display = 'block';

                    imgElement.onload = () => cacheImageAsBase64(imgElement, cacheKey, 'image/png');
                    imgElement.onerror = () => {
                        const fallbackSrc = cachedB64 || fallbackLocalPath;
                        if (fallbackSrc) {
                            imgElement.src = fallbackSrc;
                            imgElement.style.display = 'block';
                        }
                    };
                } else {
                    const offlineSrc = cachedB64 || fallbackLocalPath;
                    if (offlineSrc) {
                        imgElement.src = offlineSrc;
                        imgElement.style.display = 'block';
                    } else {
                        imgElement.style.display = 'none';
                    }
                }
            } catch (err) {
                console.error('[APIService] bindImageWithCache error:', err);
            }
        },

        async fetchCityCoordinates(cityName) {
            if (!cityName || !navigator.onLine) return null;
            try {
                const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityName)}&count=1`;
                const res = await this.fetchJSON(url);
                if (res && res.results && res.results.length > 0) {
                    return { lat: res.results[0].latitude, lon: res.results[0].longitude };
                }
            } catch (e) {
                console.warn('[APIService] fetchCityCoordinates error:', e);
            }
            return null;
        },

        async fetchWeatherData(lat, lon) {
            if (!lat || !lon || !navigator.onLine) return null;
            try {
                const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code,surface_pressure,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset&timezone=auto`;
                return await this.fetchJSON(url);
            } catch (err) {
                console.error('[APIService] fetchWeatherData error:', err);
                return null;
            }
        }
    };

    /**
     * Universal TV Background Slider Module (DRY Engine)
     */
    window.TVSlider = {
        async init() {
            try {
                const slide1 = document.getElementById('bg-slide-1');
                const slide2 = document.getElementById('bg-slide-2');
                if (!slide1 || !slide2) return;

                const isSubpage = window.location.pathname.includes('/pages/');
                const basePath = isSubpage ? '../' : './';
                let sliderImages = [basePath + 'images/main.jpg', basePath + 'images/2main.jpg'];

                try {
                    const data = await window.APIService.fetchJSON(basePath + 'data.json');
                    if (data && data.data && data.data.hotel && data.data.hotel.media && Array.isArray(data.data.hotel.media.slider_images) && data.data.hotel.media.slider_images.length > 0) {
                        sliderImages = data.data.hotel.media.slider_images;
                    }
                } catch (e) { }

                const setSlideBg = (slideEl, url, fallbackPath) => {
                    if (!url || !slideEl) return;
                    const cacheKey = IMG_CACHE_PREFIX + url;
                    const cached = Storage.get(cacheKey);

                    if (navigator.onLine) {
                        const tempImg = new Image();
                        tempImg.src = url;
                        tempImg.onload = () => {
                            slideEl.style.backgroundImage = `url('${url}')`;
                            cacheImageAsBase64(tempImg, cacheKey, 'image/jpeg');
                        };
                        tempImg.onerror = () => {
                            slideEl.style.backgroundImage = `url('${cached || fallbackPath}')`;
                        };
                    } else {
                        slideEl.style.backgroundImage = `url('${cached || fallbackPath}')`;
                    }
                };

                if (sliderImages.length === 1) {
                    setSlideBg(slide1, sliderImages[0], basePath + 'images/main.jpg');
                    slide1.classList.add('active-slide', 'single-zoom-pulse');
                    slide2.style.display = 'none';
                    return;
                }

                let curIndex = 0;
                let isSlide1Active = true;

                setSlideBg(slide1, sliderImages[0], basePath + 'images/main.jpg');
                setSlideBg(slide2, sliderImages[1 % sliderImages.length], basePath + 'images/2main.jpg');
                slide1.classList.add('active-slide');

                setInterval(() => {
                    try {
                        curIndex = (curIndex + 1) % sliderImages.length;
                        const nextUrl = sliderImages[curIndex];

                        if (isSlide1Active) {
                            setSlideBg(slide2, nextUrl, basePath + 'images/main.jpg');
                            slide2.classList.add('active-slide');
                            slide1.classList.remove('active-slide');
                        } else {
                            setSlideBg(slide1, nextUrl, basePath + 'images/main.jpg');
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

    document.addEventListener('DOMContentLoaded', () => {
        try {
            if (window.TVSlider && window.TVSlider.init) {
                window.TVSlider.init();
            }
        } catch (e) {
            console.error('[APIService] DOMContentLoaded slider init error:', e);
        }
    });
})();
