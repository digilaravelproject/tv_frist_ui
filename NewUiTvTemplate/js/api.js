/**
 * Unified API Data Service & Universal TV Background Slider Engine
 * 0ms instant loading from LocalStorage cache with background revalidation.
 * Universal reusable TVSlider module (DRY principle - zero code repetition).
 */
(function() {
    'use strict';

    const CACHE_PREFIX = 'tv_app_cache_';
    const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes cache TTL

    window.APIService = {
        fetchJSON: async function(url) {
            try {
                // Bypass cache for local data.json and live open-meteo weather API to ensure 100% real-time accuracy
                if (url.includes('data.json') || url.includes('open-meteo.com')) {
                    return await this._refreshCache(url, CACHE_PREFIX + url);
                }

                const cacheKey = CACHE_PREFIX + url;
                const cached = localStorage.getItem(cacheKey);

                if (cached) {
                    try {
                        const parsed = JSON.parse(cached);
                        const isStale = (Date.now() - parsed.timestamp) > CACHE_TTL_MS;

                        if (isStale) {
                            this._refreshCache(url, cacheKey);
                        }
                        return parsed.data;
                    } catch (e) {
                        localStorage.removeItem(cacheKey);
                    }
                }

                return await this._refreshCache(url, cacheKey);
            } catch (err) {
                console.error('[APIService] fetchJSON error:', err);
                throw err;
            }
        },

        _refreshCache: async function(url, cacheKey) {
            try {
                const response = await fetch(url);
                if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
                const data = await response.json();

                try {
                    localStorage.setItem(cacheKey, JSON.stringify({
                        timestamp: Date.now(),
                        data: data
                    }));
                } catch (e) {
                    console.warn('[APIService] LocalStorage quota exceeded or unavailable.', e);
                }

                return data;
            } catch (err) {
                console.error('[APIService] Refresh cache error:', err);
                throw err;
            }
        },

        fetchCityCoordinates: async function(cityName) {
            if (!cityName) return null;
            try {
                const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityName)}&count=1`;
                const res = await this.fetchJSON(url);
                if (res && res.results && res.results.length > 0) {
                    return {
                        lat: res.results[0].latitude,
                        lon: res.results[0].longitude
                    };
                }
            } catch (e) {
                console.warn('[APIService] Dynamic city geocoding fallback', e);
            }
            return null;
        },

        fetchWeatherData: async function(lat, lon) {
            try {
                if (!lat || !lon) throw new Error('Latitude and Longitude parameters required');
                const endpoint = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,surface_pressure,wind_speed_10m,weather_code&daily=temperature_2m_max,temperature_2m_min,weather_code,sunrise,sunset&timezone=auto`;
                return await this.fetchJSON(endpoint);
            } catch (err) {
                console.error('[APIService] fetchWeatherData error:', err);
                throw err;
            }
        },

        preloadImages: function(urls) {
            try {
                if (!Array.isArray(urls)) return;
                urls.forEach(url => {
                    if (!url) return;
                    try {
                        const img = new Image();
                        img.src = url;
                    } catch (err) {
                        console.warn('[APIService] Preload image failed:', url, err);
                    }
                });
            } catch (err) {
                console.error('[APIService] preloadImages error:', err);
            }
        }
    };

    /**
     * Universal TV Background Slider Engine (DRY - Shared across all pages)
     */
    window.TVSlider = {
        init: async function() {
            try {
                const slide1 = document.getElementById('bg-slide-1');
                const slide2 = document.getElementById('bg-slide-2');
                if (!slide1 || !slide2) return;

                const isSubpage = window.location.pathname.includes('/pages/');
                const basePath = isSubpage ? '../images/' : 'images/';

                const localFallbacks = [
                    basePath + 'main.jpg',
                    basePath + '2main.jpg',
                    basePath + 'mial.png'
                ];

                let bgImages = [];

                const jsonPaths = ['data.json', '../data.json', './data.json'];
                for (const path of jsonPaths) {
                    try {
                        const res = await window.APIService.fetchJSON(path);
                        if (res && res.data && res.data.hotel && res.data.hotel.media && Array.isArray(res.data.hotel.media.slider_images) && res.data.hotel.media.slider_images.length > 0) {
                            bgImages = res.data.hotel.media.slider_images;
                            break;
                        }
                    } catch (e) {}
                }

                const slideList = (bgImages && bgImages.length > 0) ? bgImages : localFallbacks;
                let currentSlideIndex = 0;
                let isSlide1Active = true;

                if (window._globalBgInterval) clearInterval(window._globalBgInterval);

                // If single image, apply smooth Ken-Burns auto zoom-in / zoom-out pulse animation
                if (slideList.length === 1) {
                    slide1.style.backgroundImage = `url('${slideList[0]}')`;
                    slide1.classList.add('active-slide', 'single-zoom-pulse');
                    slide2.classList.remove('active-slide', 'single-zoom-pulse');
                    return;
                }

                // If multiple images, remove pulse animation and run interval slider
                slide1.classList.remove('single-zoom-pulse');
                slide2.classList.remove('single-zoom-pulse');
                slide1.style.backgroundImage = `url('${slideList[0]}')`;
                slide1.classList.add('active-slide');

                window._globalBgInterval = setInterval(() => {
                    try {
                        currentSlideIndex = (currentSlideIndex + 1) % slideList.length;
                        const nextImgUrl = slideList[currentSlideIndex];
                        const fallbackUrl = localFallbacks[currentSlideIndex % localFallbacks.length];

                        const activeSlide = isSlide1Active ? slide1 : slide2;
                        const nextSlide = isSlide1Active ? slide2 : slide1;

                        const img = new Image();
                        img.onload = function() {
                            try {
                                nextSlide.style.backgroundImage = `url('${nextImgUrl}')`;
                                nextSlide.classList.add('active-slide');
                                activeSlide.classList.remove('active-slide');
                                isSlide1Active = !isSlide1Active;
                            } catch (err) {}
                        };
                        img.onerror = function() {
                            try {
                                nextSlide.style.backgroundImage = `url('${fallbackUrl}')`;
                                nextSlide.classList.add('active-slide');
                                activeSlide.classList.remove('active-slide');
                                isSlide1Active = !isSlide1Active;
                            } catch (err) {}
                        };
                        img.src = nextImgUrl;
                    } catch (err) {
                        console.error('[TVSlider] slide transition error:', err);
                    }
                }, 5000);
            } catch (err) {
                console.error('[TVSlider] init error:', err);
            }
        }
    };

    document.addEventListener('DOMContentLoaded', function() {
        try {
            window.TVSlider.init();
        } catch (err) {
            console.error('[TVSlider] DOMContentLoaded error:', err);
        }
    });
})();
