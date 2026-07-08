/**
 * Travel Gallery Page Logic
 */
document.addEventListener('DOMContentLoaded', function () {
    let images = [];
    let currentSlide = 0;
    let autoTimer;
    
    TVCore.fetchHotelConfig().then(config => {
        if (!TVCore.checkPlanExpiredRedirect(config, '../index.html')) {
            TVCore.initBackgroundSlider(config, '../images/main.jpg');
            setupGallery(config);
        }
    });

    function setupGallery(config) {
        if (config && config.hotel && config.hotel.media) {
            if (config.hotel.media.slider_images && config.hotel.media.slider_images.length > 0) {
                images = config.hotel.media.slider_images;
            } else if (config.hotel.media.cover_image) {
                images = [config.hotel.media.cover_image];
            }
        }

        if (images.length === 0) {
            if (window.AndroidBridge && window.AndroidBridge.getPictureList) {
                try {
                    const listString = window.AndroidBridge.getPictureList();
                    images = JSON.parse(listString);
                } catch (e) { }
            }
        }

        if (images.length === 0) {
            images = ["pics/slide1.jpg", "pics/slide2.jpg"]; // Fallback pics
        }

        updateDisplay();
        startAutoSlide();
        loadLanguage();

        const nextBtn = document.querySelector('.next');
        const prevBtn = document.querySelector('.prev');
        if (nextBtn) nextBtn.addEventListener('click', (e) => { e.preventDefault(); nextSlide(); });
        if (prevBtn) prevBtn.addEventListener('click', (e) => { e.preventDefault(); prevSlide(); });
        
        setTimeout(() => { 
            let img = document.getElementById('displayImage');
            if (img) img.focus(); 
        }, 200);
    }

    function loadLanguage() {
        let langFile = localStorage.getItem('selectedLangFile') || 'english.json';
        if (window.AndroidBridge && window.AndroidBridge.getSelectedLanguageFile) {
            langFile = window.AndroidBridge.getSelectedLanguageFile();
        }

        fetch(`../admin/languages/${langFile}?t=${Date.now()}`)
            .then(res => res.json())
            .then(data => {
                const titleKey = 'travel';
                const titleEl = document.getElementById('headerTitle');
                if (titleEl) {
                    if (data.icons && data.icons[titleKey]) {
                        titleEl.innerText = data.icons[titleKey];
                    } else if (data[titleKey]) {
                        titleEl.innerText = data[titleKey];
                    }
                }
            })
            .catch(err => console.error("Language load error:", err));
    }

    function updateDisplay() {
        if (images[currentSlide]) {
            const imgEl = document.getElementById('displayImage');
            if (imgEl) {
                imgEl.style.opacity = 0;
                setTimeout(() => {
                    imgEl.src = images[currentSlide];
                    imgEl.style.opacity = 1;
                }, 100);
            }
        }
    }

    function nextSlide() {
        if (images.length === 0) return;
        currentSlide = (currentSlide + 1) % images.length;
        updateDisplay();
        startAutoSlide();
    }

    function prevSlide() {
        if (images.length === 0) return;
        currentSlide = (currentSlide - 1 + images.length) % images.length;
        updateDisplay();
        startAutoSlide();
    }

    function startAutoSlide() {
        clearInterval(autoTimer);
        autoTimer = setInterval(() => {
            if (images.length > 1) {
                currentSlide = (currentSlide + 1) % images.length;
                updateDisplay();
            }
        }, 10000);
    }

    window.onTVNavigate = function(direction) {
        if (direction === 'left') {
            const icon = document.querySelector('.prev');
            if(icon) {
                icon.classList.add('vibrate');
                setTimeout(() => icon.classList.remove('vibrate'), 400);
            }
            prevSlide();
            return true;
        } else if (direction === 'right') {
            const icon = document.querySelector('.next');
            if(icon) {
                icon.classList.add('vibrate');
                setTimeout(() => icon.classList.remove('vibrate'), 400);
            }
            nextSlide();
            return true;
        }
        return false;
    };
});
