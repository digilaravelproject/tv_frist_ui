let images = []; 
        let currentIndex = 0;
        let autoTimer;

        function initGallery() {
            if (window.AndroidBridge && window.AndroidBridge.getPictureList) {
                const listString = window.AndroidBridge.getPictureList();
                images = JSON.parse(listString);
            } else {
                images = ["pics/slide1.jpg", "pics/slide2.jpg"];
            }
            
            if (images.length > 0) {
                updateDisplay();
                startAutoSlide();
            }

            let langFile = localStorage.getItem('selectedLangFile') || 'english.json';
            
            if (window.AndroidBridge && window.AndroidBridge.getSelectedLanguageFile) {
                langFile = window.AndroidBridge.getSelectedLanguageFile();
            }

            fetch(`../admin/${langFile}?t=${Date.now()}`)
                .then(res => res.json())
                .then(data => {
                    const titleKey = 'city'; 
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