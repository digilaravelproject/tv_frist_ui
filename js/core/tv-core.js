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
     * Fetch hotel configuration from JSON, with offline fallback
     */
    fetchHotelConfig: async function () {
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
        
        // Define paths considering if we are in a subfolder or root
        const isInSubfolder = window.location.pathname.indexOf('/') !== window.location.pathname.lastIndexOf('/');
        const basePath = isInSubfolder ? '../' : '';
        const paths = [`${basePath}${filename}`, filename, `${basePath}data.json`, 'data.json'];
        
        let config = null;

        for (let path of paths) {
            try {
                const res = await fetch(`${path}?t=${Date.now()}`);
                if (res.ok) {
                    config = await res.json();
                    config = config.data || config;
                    localStorage.setItem('cachedHotelData', JSON.stringify(config));
                    break;
                }
            } catch (e) {
                console.warn(`Failed to fetch config from ${path}:`, e);
            }
        }

        if (!config) {
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

        if (config && config.hotel && config.hotel.media) {
            if (config.hotel.media.slider_images && config.hotel.media.slider_images.length > 0) {
                this.bgSlideImages = config.hotel.media.slider_images;
            } else if (config.hotel.media.cover_image) {
                this.bgSlideImages = [config.hotel.media.cover_image];
            }
        }

        if (this.bgSlideImages.length === 0) {
            const isInSubfolder = window.location.pathname.indexOf('/') !== window.location.pathname.lastIndexOf('/');
            const basePath = isInSubfolder ? '../' : '';
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
            const isInSubfolder = window.location.pathname.indexOf('/') !== window.location.pathname.lastIndexOf('/');
            const basePath = isInSubfolder ? '../' : '';
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
                    const isInSubfolder = window.location.pathname.indexOf('/') !== window.location.pathname.lastIndexOf('/');
                    const basePath = isInSubfolder ? '../' : '';
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
                img.src = config.hotel.media.logo_image;
                img.alt = config.hotel.hotel_name || 'Hotel Logo';

                container.appendChild(img);
                document.body.appendChild(container);
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
