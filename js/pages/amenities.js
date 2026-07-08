let images = [];
        let currentIndex = 0;
        let autoTimer;

        function waitForLoginData() {
            return new Promise(resolve => {
                if (window.tvLoginData) return resolve(window.tvLoginData);
                if (window.parent && window.parent.tvLoginData) return resolve(window.parent.tvLoginData);
                const check = setInterval(() => {
                    const data = window.tvLoginData || (window.parent && window.parent.tvLoginData);
                    if (data) {
                        clearInterval(check);
                        resolve(data);
                    }
                }, 100);
                setTimeout(() => { clearInterval(check); resolve(null); }, 3000);
            });
        }

        async function fetchHotelConfig() {
            const injected = await waitForLoginData();
            if (injected) {
                var normalized = injected.data || injected;
                localStorage.setItem('cachedHotelData', JSON.stringify(normalized));
                return normalized;
            }

            const filename = window.parent.HOTEL_DATA_FILE || window.HOTEL_DATA_FILE || 'data.json';
            const paths = [`../${filename}`, filename, '../data.json', 'data.json'];
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
        }

        let bgSlideImages = [];
        let bgCurrentImageIndex = 0;
        let bgActiveSlideIndex = 0;
        let bgSliderIntervalId = null;

        function initBackgroundSlider(config) {
            if (bgSliderIntervalId) clearInterval(bgSliderIntervalId);
            bgSlideImages = [];

            if (config && config.hotel && config.hotel.media) {
                if (config.hotel.media.slider_images && config.hotel.media.slider_images.length > 0) {
                    bgSlideImages = config.hotel.media.slider_images;
                } else if (config.hotel.media.cover_image) {
                    bgSlideImages = [config.hotel.media.cover_image];
                }
            }

            if (bgSlideImages.length === 0) {
                bgSlideImages = ['../images/main.jpg'];
            }

            const slides = document.querySelectorAll('#bg-slider .slide');
            if (slides.length < 2) return;

            const tempImg1 = new Image();
            tempImg1.onload = () => {
                slides[0].style.backgroundImage = `url('${bgSlideImages[0]}')`;
                slides[0].classList.add('active');
                slides[1].classList.remove('active');
            };
            tempImg1.onerror = () => {
                slides[0].style.backgroundImage = "url('../images/main.jpg')";
                slides[0].classList.add('active');
                slides[1].classList.remove('active');
            };
            tempImg1.src = bgSlideImages[0];

            bgCurrentImageIndex = 0;
            bgActiveSlideIndex = 0;

            if (bgSlideImages.length > 1) {
                bgSliderIntervalId = setInterval(() => {
                    bgCurrentImageIndex = (bgCurrentImageIndex + 1) % bgSlideImages.length;
                    const nextSlideIndex = bgActiveSlideIndex === 0 ? 1 : 0;
                    const targetUrl = bgSlideImages[bgCurrentImageIndex];

                    const tempImgNext = new Image();
                    tempImgNext.onload = () => {
                        slides[nextSlideIndex].style.backgroundImage = `url('${targetUrl}')`;
                        slides[nextSlideIndex].classList.add('active');
                        slides[bgActiveSlideIndex].classList.remove('active');
                        bgActiveSlideIndex = nextSlideIndex;
                    };
                    tempImgNext.onerror = () => {
                        slides[nextSlideIndex].style.backgroundImage = "url('../images/main.jpg')";
                        slides[nextSlideIndex].classList.add('active');
                        slides[bgActiveSlideIndex].classList.remove('active');
                        bgActiveSlideIndex = nextSlideIndex;
                    };
                    tempImgNext.src = targetUrl;
                }, 5000);
            }
        }

        async function initGallery() {
            // Load dynamic configuration instantly from parent cache if available
            const cachedConfig = (window.parent && window.parent.getFastConfig) ? window.parent.getFastConfig() : null;
            images = [];

            if (cachedConfig) {
                initBackgroundSlider(cachedConfig);
                if (cachedConfig.hotel && cachedConfig.hotel.media) {
                    if (cachedConfig.hotel.media.slider_images && cachedConfig.hotel.media.slider_images.length > 0) {
                        images = cachedConfig.hotel.media.slider_images;
                    } else if (cachedConfig.hotel.media.cover_image) {
                        images = [cachedConfig.hotel.media.cover_image];
                    }
                }
            } else {
                initBackgroundSlider(null);
            }

            // Run updated fetch in the background to avoid blocking initial render
            fetchHotelConfig().then(config => {
                if (config) {
                    if (typeof window.checkPlanExpiredRedirect === 'function') window.checkPlanExpiredRedirect(config, '../index.html');
                    initBackgroundSlider(config);

                    let newImages = [];
                    if (config.hotel && config.hotel.media) {
                        if (config.hotel.media.slider_images && config.hotel.media.slider_images.length > 0) {
                            newImages = config.hotel.media.slider_images;
                        } else if (config.hotel.media.cover_image) {
                            newImages = [config.hotel.media.cover_image];
                        }
                    }
                    if (newImages.length > 0 && JSON.stringify(newImages) !== JSON.stringify(images)) {
                        images = newImages;
                        currentIndex = 0;
                        updateDisplay();
                        startAutoSlide();
                    }
                }
            }).catch(err => console.warn("Background fetch failed:", err));

            // Standard local offline default fallback
            if (images.length === 0) {
                if (window.AndroidBridge && window.AndroidBridge.getPictureList) {
                    try {
                        const listString = window.AndroidBridge.getPictureList();
                        images = JSON.parse(listString);
                    } catch (e) { }
                }
            }

            if (images.length === 0) {
                images = ["pics/slide1.jpg", "pics/slide2.jpg"];
            }

            updateDisplay();
            startAutoSlide();

            let langFile = localStorage.getItem('selectedLangFile') || 'english.json';

            if (window.AndroidBridge && window.AndroidBridge.getSelectedLanguageFile) {
                langFile = window.AndroidBridge.getSelectedLanguageFile();
            }

            fetch(`../admin/languages/${langFile}?t=${Date.now()}`)
                .then(res => res.json())
                .then(data => {
                    const titleKey = 'amenities';
                    const titleEl = document.getElementById('headerTitle');
                    if (data.icons && data.icons[titleKey]) {
                        titleEl.innerText = data.icons[titleKey];
                    } else if (data[titleKey]) {
                        titleEl.innerText = data[titleKey];
                    }
                })
                .catch(err => console.error("Language load error:", err));
        }

        function updateDisplay() {
            if (images[currentIndex]) {
                const imgEl = document.getElementById('displayImage');
                imgEl.style.opacity = 0;
                setTimeout(() => {
                    imgEl.src = images[currentIndex];
                    imgEl.style.opacity = 1;
                }, 100);
            }
        }

        function changeSlide(dir) {
            let next = currentIndex + dir;
            if (next < 0) { trigger('btnPrev'); return; }
            if (next >= images.length) { trigger('btnNext'); return; }

            currentIndex = next;
            updateDisplay();
            startAutoSlide();
        }

        function startAutoSlide() {
            clearInterval(autoTimer);
            autoTimer = setInterval(() => {
                if (images.length > 1) {
                    currentIndex = (currentIndex + 1) % images.length;
                    updateDisplay();
                }
            }, 10000);
        }

        function trigger(id) {
            const el = document.getElementById(id);
            if (el) {
                el.classList.add('vibrate');
                setTimeout(() => el.classList.remove('vibrate'), 400);
            }
        }

        function goBack() {
            window.location.href = "../index.html";
        }

        
window.onTVNavigate = function(direction) {
    if (direction === 'left') {
        changeSlide(-1);
        return true;
    }
    if (direction === 'right') {
        changeSlide(1);
        return true;
    }
    return false;
};

window.onTVBack = function() {
    goBack();
    return true;
};


        
        window.onload = () => { initGallery(); setTimeout(() => document.getElementById('displayImage').focus(), 200); };