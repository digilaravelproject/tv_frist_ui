/**
 * TV Core Logic
 * Handles global operations: fetching configuration, initializing the background slider,
 * and checking plan expiration.
 */
window.TVCore = {
    bgSlideImages: [],
    bgCurrentImageIndex: 0,
    bgActiveSlideIndex: 0,
    bgSliderIntervalId: null,

    /**
     * Instantly get the cached configuration (used for offline sync)
     */
    getFastConfig: function () {
        try {
            const cached = localStorage.getItem('cachedHotelData');
            if (cached) {
                return JSON.parse(cached);
            }
        } catch (e) {
            console.error("Error reading fast config:", e);
        }
        return null;
    },

    /**
     * Fetch hotel configuration from JSON or Remote API via Bearer Token, with offline fallback
     */
    fetchHotelConfig: async function (forceApi = false) {
        // Fallback for injected data from parent frame if any
        if (window.tvLoginData) {
            const normalized = window.tvLoginData.data || window.tvLoginData;
            localStorage.setItem('cachedHotelData', JSON.stringify(normalized));
            return normalized;
        }
        if (window.parent && window.parent.tvLoginData) {
            const normalized = window.parent.tvLoginData.data || window.parent.tvLoginData;
            localStorage.setItem('cachedHotelData', JSON.stringify(normalized));
            return normalized;
        }

        const filename = (window.parent && window.parent.HOTEL_DATA_FILE) || window.HOTEL_DATA_FILE || 'data.json';
        const isInSubfolder = window.location.pathname.indexOf('/') !== window.location.pathname.lastIndexOf('/');
        const basePath = isInSubfolder ? '../' : '';
        const paths = [`${basePath}${filename}`, filename, `${basePath}data.json`, 'data.json'];
        
        let config = null;
        let token = localStorage.getItem('authToken');

        // Step 1: Read local JSON file first to extract config and Bearer Token
        for (let path of paths) {
            try {
                const res = await fetch(`${path}?t=${Date.now()}`);
                if (res.ok) {
                    const rawData = await res.json();
                    config = rawData.data || rawData;
                    if (config.auth && config.auth.token) {
                        token = config.auth.token;
                        localStorage.setItem('authToken', token);
                    }
                    break;
                }
            } catch (e) {
                console.warn(`Failed to fetch config from ${path}:`, e);
            }
        }

        // Step 2: If forceApi is true or if online, hit the check-version remote API using Authorization Bearer token
        if ((forceApi || !config) && navigator.onLine && token) {
            try {
                const apiRes = await fetch("https://tvapp.digiemperor.com/api/tv/template/check-version", {
                    method: "GET",
                    headers: {
                        "Accept": "application/json",
                        "Authorization": `Bearer ${token}`
                    }
                });

                if (apiRes.ok) {
                    const apiData = await apiRes.json();
                    const freshConfig = apiData.data || apiData;
                    if (freshConfig && (freshConfig.hotel || freshConfig.guest_info)) {
                        config = freshConfig;
                        if (!config.auth) config.auth = { token: token };
                        const fullPayload = { status: true, message: "TV data updated.", data: config };
                        const payloadStr = JSON.stringify(fullPayload, null, 2);

                        localStorage.setItem('cachedHotelData', JSON.stringify(config));
                        
                        // Send to Flutter Native bridge to update & write data.json on device disk
                        if (window.flutterBridge && typeof window.flutterBridge.saveDeviceConfig === 'function') {
                            window.flutterBridge.saveDeviceConfig(fullPayload).catch(function(err){ console.warn('Bridge save file warn:', err); });
                        }

                        console.log("Successfully fetched fresh data from Remote check-version API");
                    }
                }
            } catch (apiErr) {
                console.warn("Remote check-version API fetch failed, falling back to local/cached data:", apiErr);
            }
        }

        // Step 3: Cache sync fallback
        if (config) {
            localStorage.setItem('cachedHotelData', JSON.stringify(config));
        } else {
            const cached = localStorage.getItem('cachedHotelData');
            if (cached) {
                try {
                    config = JSON.parse(cached);
                } catch (e) {
                    console.error("Failed parsing cached config:", e);
                }
            }
        }
        return config;
    },

    /**
     * Initialize the #bg-slider element
     */
    initBackgroundSlider: function (config, fallbackImage) {
        // Automatically inject the hotel logo if available
        this.injectHotelLogo(config);
        if (this.bgSliderIntervalId) clearInterval(this.bgSliderIntervalId);
        this.bgSlideImages = [];

        const isInSubfolder = window.location.pathname.indexOf('/') !== window.location.pathname.lastIndexOf('/');
        const basePath = isInSubfolder ? '../' : '';

        if (config && config.hotel && config.hotel.media) {
            if (config.hotel.media.slider_images && config.hotel.media.slider_images.length > 0) {
                this.bgSlideImages = config.hotel.media.slider_images.map(function(img) {
                    return (img.startsWith('http') || img.startsWith('/')) ? img : basePath + img;
                });
            } else if (config.hotel.media.cover_image) {
                var cover = config.hotel.media.cover_image;
                if (!cover.startsWith('http') && !cover.startsWith('/')) {
                    cover = basePath + cover;
                }
                this.bgSlideImages = [cover];
            }
        }

        if (this.bgSlideImages.length === 0) {
            this.bgSlideImages = [fallbackImage || `${basePath}images/main.jpg`];
        }

        const slides = document.querySelectorAll('#bg-slider .slide');
        if (slides.length < 2) return;

        // Load initial background image
        const tempImg1 = new Image();
        tempImg1.onload = () => {
            slides[0].style.backgroundImage = `url('${this.bgSlideImages[0]}')`;
            slides[0].classList.add('active');
            slides[1].classList.remove('active');
        };
        tempImg1.onerror = () => {
            slides[0].style.backgroundImage = `url('${basePath}images/main.jpg')`;
            slides[0].classList.add('active');
            slides[1].classList.remove('active');
        };
        tempImg1.src = this.bgSlideImages[0];

        this.bgCurrentImageIndex = 0;
        this.bgActiveSlideIndex = 0;

        if (this.bgSlideImages.length > 1) {
            this.bgSliderIntervalId = setInterval(() => {
                this.bgCurrentImageIndex = (this.bgCurrentImageIndex + 1) % this.bgSlideImages.length;
                const nextSlideIndex = this.bgActiveSlideIndex === 0 ? 1 : 0;
                const targetUrl = this.bgSlideImages[this.bgCurrentImageIndex];

                const tempImgNext = new Image();
                tempImgNext.onload = () => {
                    slides[nextSlideIndex].style.backgroundImage = `url('${targetUrl}')`;
                    slides[nextSlideIndex].classList.add('active');
                    slides[this.bgActiveSlideIndex].classList.remove('active');
                    this.bgActiveSlideIndex = nextSlideIndex;
                };
                tempImgNext.onerror = () => {
                    slides[nextSlideIndex].style.backgroundImage = `url('${basePath}images/main.jpg')`;
                    slides[nextSlideIndex].classList.add('active');
                    slides[this.bgActiveSlideIndex].classList.remove('active');
                    this.bgActiveSlideIndex = nextSlideIndex;
                };
                tempImgNext.src = targetUrl;
            }, 5000);
        }
    },

    /**
     * Check if plan is expired and redirect if necessary
     */
    checkPlanExpiredRedirect: function (config, redirectUrl) {
        if (!config || !config.hotel || !config.hotel.active_plan || !config.hotel.active_plan.expiry_date) return false;
        var now = new Date();
        var expiry = new Date(config.hotel.active_plan.expiry_date);
        if (expiry <= now) {
            var p = window.location.pathname;
            var redirect = redirectUrl || ((p.lastIndexOf('/') > 0) ? '../index.html' : 'index.html');
            window.location.href = redirect;
            return true;
        }
        return false;
    },

    /**
     * Initialize core logic
     */
    init: function () {
        this.fetchHotelConfig().then(config => {
            if (!this.checkPlanExpiredRedirect(config)) {
                this.initBackgroundSlider(config);
                this.injectHotelLogo(config);
            }
        });
    },

    /**
     * Dynamically inject the hotel logo to the top center of the page
     */
    injectHotelLogo: function (config) {
        if (config && config.hotel && config.hotel.media && config.hotel.media.logo_image) {
            // Check if container already exists
            if (!document.getElementById('global-hotel-logo-container')) {
                const container = document.createElement('div');
                container.className = 'hotel-logo-container';
                container.id = 'global-hotel-logo-container';

                const img = document.createElement('img');
                img.id = 'global-hotel-logo';
                
                let logoSrc = config.hotel.media.logo_image;
                if (logoSrc && !logoSrc.startsWith('http') && !logoSrc.startsWith('/')) {
                    const isInSubfolder = window.location.pathname.indexOf('/') !== window.location.pathname.lastIndexOf('/');
                    const basePath = isInSubfolder ? '../' : '';
                    logoSrc = basePath + logoSrc;
                }
                img.src = logoSrc;
                img.alt = config.hotel.hotel_name || 'Hotel Logo';

                container.appendChild(img);

                const logoSlot = document.getElementById('hotelLogoSlot');
                const headerRight = document.querySelector('.header-right');
                if (logoSlot) {
                    logoSlot.appendChild(container);
                } else if (headerRight) {
                    headerRight.appendChild(container);
                } else {
                    document.body.appendChild(container);
                }
            }
        }
    }
};


// Automatically inject hotel logo on DOMContentLoaded for all pages loading tv-core.js
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        TVCore.fetchHotelConfig().then(config => {
            if (config) {
                TVCore.injectHotelLogo(config);
            }
        });
    });
} else {
    TVCore.fetchHotelConfig().then(config => {
        if (config) {
            TVCore.injectHotelLogo(config);
        }
    });
}

// Global Zoom Prevention (Disable Ctrl + Wheel / Pinch-to-zoom / Touch gestures)
window.addEventListener('wheel', function (e) {
    if (e.ctrlKey) {
        e.preventDefault();
    }
}, { passive: false });

window.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && (e.key === '+' || e.key === '-' || e.key === '=' || e.keyCode === 187 || e.keyCode === 189)) {
        e.preventDefault();
    }
});

document.addEventListener('gesturestart', function (e) { e.preventDefault(); });
document.addEventListener('gesturechange', function (e) { e.preventDefault(); });
document.addEventListener('gestureend', function (e) { e.preventDefault(); });
