/* ================= 1. CAROUSEL & FOCUS LOGIC ================= */
const track = document.getElementById("menuTrack");
const centerIndex = 3;

function updateCarouselPosition() {
    var vWidth = window.innerWidth;
    var totalSlot = vWidth * 0.14285;
    var offset = (vWidth / 2) - (centerIndex * totalSlot) - (totalSlot / 2);
    if (track) track.style.transform = 'translate3d(' + offset + 'px, 0px, 0px)';
}

function syncFocus() {
    if (!track) return;
    var allIcons = Array.prototype.slice.call(track.querySelectorAll(".icon-item"));

    for (var i = 0; i < allIcons.length; i++) {
        var icon = allIcons[i];
        icon.classList.remove("active-focus");
        var img = icon.querySelector(".icon-img");
        if (img) img.classList.remove("bounce");
    }

    var target = allIcons[centerIndex];
    if (target) {
        target.focus();
        target.classList.add("active-focus");

        // Save the focused label to localStorage to restore it on Back navigation
        var labelEl = target.querySelector(".icon-label");
        var label = labelEl ? labelEl.innerText : null;
        if (label) {
            localStorage.setItem("lastFocusedLabel", label);
        }

        var targetImg = target.querySelector(".icon-img");
        if (targetImg) {
            void targetImg.offsetWidth;
            targetImg.classList.add("bounce");
        }
    }
}

function rotate(dir) {
    if (!track) return;
    const isRTL = document.body.classList.contains('rtl-mode');
    let moveDir = dir;
    if (isRTL) {
        moveDir = (dir === 'right') ? 'left' : 'right';
    }

    if (moveDir === 'right') {
        track.appendChild(track.firstElementChild);
    } else {
        track.insertBefore(track.lastElementChild, track.firstElementChild);
    }
    syncFocus();
}

/* ================= 2. LIVE TV LOGIC (Refactored for Flutter Bridge) ================= */
async function handleLiveTV() {
    const serial = localStorage.getItem('deviceSerial');
    const ip = localStorage.getItem('deviceIp');

    if (!serial || !ip) {
        try {
            const device = await window.flutterBridge.identifyDevice(ip);
            if (device.success && device.serial) {
                localStorage.setItem('deviceSerial', device.serial);
                localStorage.setItem('deviceIp', device.ip);
                return handleLiveTV();
            }
            throw new Error(device.error || 'Failed to identify device');
        } catch (err) {
            console.error('Device identification failed:', err);
            return;
        }
    }

    try {
        const config = await fetch(`admin/devices/${serial}.json?t=${Date.now()}`).then(r => r.json());

        if (config.tv_source === "TV APP") {
            await window.flutterBridge.launchApp(config.package);
        } else if (config.tv_source === "HDMI") {
            await window.flutterBridge.launchHdmi(config.package);
        } else if (config.tv_source === "IPTV") {
            await window.flutterBridge.launchIptv(config.package, config.iptv_config || "iptv/all.json");
        }
    } catch (e) {
        console.error("Launch error", e);
    }
}

/* ================= 3. INITIALIZATION & DATA ================= */
let currentData = {
    "direction": "ltr",
    "room_label": "Room",
    "city_name": "Mumbai",
    "greetings": { "morning": "Good Morning", "afternoon": "Good Afternoon", "evening": "Good Evening", "night": "Good Night" },
    "days": { "sun": "Sun", "mon": "Mon", "tue": "Tue", "wed": "Wed", "thu": "Thu", "fri": "Fri", "sat": "Sat" },
    "months": { "jan": "Jan", "feb": "Feb", "mar": "Mar", "apr": "Apr", "may": "May", "jun": "Jun", "jul": "Jul", "aug": "Aug", "sep": "Sep", "oct": "Oct", "nov": "Nov", "dec": "Dec" },
    "icons": {}
};

async function fetchHotelConfig() {
    var injected = window.tvLoginData || (window.parent && window.parent.tvLoginData);
    if (injected) {
        var normalized = injected.data || injected;
        localStorage.setItem('cachedHotelData', JSON.stringify(normalized));
        return normalized;
    }

    // Try network first, always fetch fresh data.json
    const filename = window.HOTEL_DATA_FILE || 'data.json';
    const paths = [filename, `../${filename}`, 'data.json', '../data.json'];

    for (let path of paths) {
        try {
            const res = await fetch(`${path}?t=${Date.now()}`);
            if (res.ok) {
                var config = await res.json();
                var normalized = config.data || config;
                localStorage.setItem('cachedHotelData', JSON.stringify(normalized));
                return normalized;
            }
        } catch (e) {
            console.warn(`Failed to fetch config from ${path}:`, e);
        }
    }

    // Network failed — fall back to localStorage cache
    const cached = localStorage.getItem('cachedHotelData');
    if (cached) {
        try { return JSON.parse(cached); } catch (e) {
            console.error("Failed parsing cached config:", e);
        }
    }
    return null;
}

let slideImages = [];
let currentImageIndex = 0;
let activeSlideIndex = 0;
let sliderIntervalId = null;

function initSlider(images) {
    if (sliderIntervalId) clearInterval(sliderIntervalId);
    slideImages = images || [];

    // Fallback: If no slider images are specified, try default cover or main.jpg
    if (slideImages.length === 0) {
        const cached = localStorage.getItem('cachedHotelData');
        if (cached) {
            try {
                const config = JSON.parse(cached);
                if (config.hotel && config.hotel.media && config.hotel.media.cover_image) {
                    slideImages = [config.hotel.media.cover_image];
                }
            } catch (e) { }
        }
    }

    if (slideImages.length === 0) {
        slideImages = ['images/main.jpg'];
    }

    const slides = document.querySelectorAll('#bg-slider .slide');
    if (slides.length < 2) return;

    // Show main.jpg immediately, then upgrade to external images if they load
    slides[0].style.backgroundImage = "url('images/main.jpg')";
    slides[0].classList.add('active');
    slides[1].classList.remove('active');
    if (slideImages[0] && slideImages[0] !== 'images/main.jpg') {
        const tempImg1 = new Image();
        tempImg1.onload = () => {
            slides[0].style.backgroundImage = `url('${slideImages[0]}')`;
        };
        tempImg1.src = slideImages[0];
    }

    currentImageIndex = 0;
    activeSlideIndex = 0;

    if (slideImages.length > 1) {
        sliderIntervalId = setInterval(() => {
            currentImageIndex = (currentImageIndex + 1) % slideImages.length;
            const nextSlideIndex = activeSlideIndex === 0 ? 1 : 0;
            const targetUrl = slideImages[currentImageIndex];

            // Validate image loads successfully before transitioning
            const tempImgNext = new Image();
            tempImgNext.onload = () => {
                slides[nextSlideIndex].style.backgroundImage = `url('${targetUrl}')`;
                slides[nextSlideIndex].classList.add('active');
                slides[activeSlideIndex].classList.remove('active');
                activeSlideIndex = nextSlideIndex;
            };
            tempImgNext.onerror = () => {
                console.warn(`Failed to load slider image: ${targetUrl}. Falling back to default.`);
                slides[nextSlideIndex].style.backgroundImage = "url('images/main.jpg')";
                slides[nextSlideIndex].classList.add('active');
                slides[activeSlideIndex].classList.remove('active');
                activeSlideIndex = nextSlideIndex;
            };
            tempImgNext.src = targetUrl;
        }, 2000);
    }
}

async function initLanguage() {
    try {
        // Load dynamic hotel configuration instantly from cache if available
        const cachedConfig = window.getFastConfig();
        if (cachedConfig) {
            if (cachedConfig.device && cachedConfig.device.room_no) {
                localStorage.setItem('roomNo', cachedConfig.device.room_no);
            }
            if (cachedConfig.hotel && cachedConfig.hotel.hotel_name) {
                document.title = cachedConfig.hotel.hotel_name;
            }
            if (cachedConfig.hotel && cachedConfig.hotel.active_plan) {
                checkPlanStatus(cachedConfig.hotel.active_plan);
            }
            if (cachedConfig.hotel && cachedConfig.hotel.media && cachedConfig.hotel.media.slider_images) {
                initSlider(cachedConfig.hotel.media.slider_images);
            } else {
                initSlider([]);
            }
        } else {
            initSlider([]);
        }

        // Run updated fetch in the background to avoid blocking initial render
        fetchHotelConfig().then(config => {
            if (config) {
                if (config.device && config.device.room_no) {
                    localStorage.setItem('roomNo', config.device.room_no);
                }
                if (config.hotel && config.hotel.hotel_name) {
                    document.title = config.hotel.hotel_name;
                }
                if (config.hotel && config.hotel.active_plan) {
                    checkPlanStatus(config.hotel.active_plan);
                }
                if (config.hotel && config.hotel.media && config.hotel.media.slider_images) {
                    initSlider(config.hotel.media.slider_images);
                }
            }
        }).catch(err => console.warn("Background fetch failed:", err));

        const langFile = localStorage.getItem('selectedLangFile') || 'english.json';
        const response = await fetch(`admin/languages/${langFile}`);
        if (response.ok) {
            const freshData = await response.json();
            currentData = { ...currentData, ...freshData };
            if (currentData.direction === 'rtl') {
                document.body.classList.add('rtl-mode');
            } else {
                document.body.classList.remove('rtl-mode');
            }
        }
    } catch (e) { console.error("Initialization failed:", e); }
    finally {
        applyTranslations();
        updateDateTime();
        updateWeather();
        fetchGuestData();

        // Restore last focused item from localStorage before updating positions
        var lastLabel = localStorage.getItem("lastFocusedLabel");
        if (lastLabel && track) {
            // Disable transition temporarily to prevent sliding animation on page load
            var originalTransition = track.style.transition;
            track.style.transition = 'none';

            var allIcons = Array.prototype.slice.call(track.querySelectorAll(".icon-item"));
            var targetIndex = -1;
            for (var j = 0; j < allIcons.length; j++) {
                var labelEl = allIcons[j].querySelector(".icon-label");
                if (labelEl && labelEl.innerText === lastLabel) {
                    targetIndex = j;
                    break;
                }
            }
            if (targetIndex !== -1) {
                var diff = targetIndex - centerIndex;
                if (diff > 0) {
                    for (var i = 0; i < diff; i++) {
                        track.appendChild(track.firstElementChild);
                    }
                } else if (diff < 0) {
                    for (var i = 0; i < Math.abs(diff); i++) {
                        track.insertBefore(track.lastElementChild, track.firstElementChild);
                    }
                }
            }

            updateCarouselPosition();

            // Force a DOM reflow to make the positioning instant before re-enabling transition
            void track.offsetHeight;

            // Restore transition for D-pad navigation
            track.style.transition = originalTransition;
        } else {
            updateCarouselPosition();
        }

        setTimeout(syncFocus, 300);
    }
}

function applyTranslations() {
    const roomNo = localStorage.getItem('roomNo') || "";
    const roomEl = document.getElementById('room');
    if (roomEl) roomEl.textContent = `${currentData.room_label} ${roomNo}`;

    const iconMap = {
        'apps': 'applications',
        'livetv': 'live_tv',
        'languages.html': 'language',
        'hotel_info/hotel_info.html': 'hotel_info',
        'amenities/amenities.html': 'amenities',
        'travel/travel.html': 'travel',
        'city/city.html': 'our_city',
        'weather/weather.html': 'weather',
        'settings.html': 'settings',
        'flights/flights.html': 'flights'
    };

    document.querySelectorAll('.icon-item').forEach(item => {
        const key = item.getAttribute('data-link') || item.getAttribute('data-action');
        const labelEl = item.querySelector('.icon-label');
        const jsonKey = iconMap[key];
        if (labelEl && jsonKey && currentData.icons && currentData.icons[jsonKey]) {
            labelEl.textContent = currentData.icons[jsonKey];
        }
    });
}

function fetchGuestData() {
    const roomNo = localStorage.getItem('roomNo') || "";
    if (!roomNo) return;
    fetch(`admin/rooms.json?t=` + new Date().getTime())
        .then(res => res.json())
        .then(allRooms => {
            const roomData = allRooms[roomNo] || allRooms["_default"];
            if (roomData && roomData.guest_name) {
                const langKey = (currentData.language_name) ? currentData.language_name.toLowerCase() : "english";
                let localizedName = roomData.guest_name[langKey] || roomData.guest_name["english"] || "Guest";
                window.guestName = localizedName;
                updateGreetingDisplay();
            }
        }).catch(e => { });
}

function updateDateTime() {
    const now = new Date();
    const isRTL = document.body.classList.contains('rtl-mode');

    // Set Time - uses local system clock (no NTP)
    const timeEl = document.getElementById('time');
    if (timeEl) timeEl.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

    // Set Room
    const roomNo = localStorage.getItem('roomNo') || "";
    const roomEl = document.getElementById('room');
    if (roomEl) roomEl.textContent = `${currentData.room_label} ${roomNo}`;

    // Set Date with RTL comma
    const dateEl = document.getElementById('date');
    if (dateEl) {
        const dayKey = now.toLocaleDateString('en-US', { weekday: 'short' }).toLowerCase();
        const monthKey = now.toLocaleDateString('en-US', { month: 'short' }).toLowerCase();
        const dayName = (currentData.days && currentData.days[dayKey]) || "";
        const monthName = (currentData.months && currentData.months[monthKey]) || "";

        dateEl.textContent = isRTL
            ? `${dayName}، ${now.getDate()} ${monthName}`
            : `${dayName}, ${monthName} ${now.getDate()}`;
    }
    updateGreetingDisplay();
}

function updateGreetingDisplay() {
    const hour = new Date().getHours();
    let msg = currentData.greetings.night;
    if (hour < 12) msg = currentData.greetings.morning;
    else if (hour < 17) msg = currentData.greetings.afternoon;
    else if (hour < 21) msg = currentData.greetings.evening;

    const greetEl = document.getElementById('greeting');
    if (!greetEl) return;
    const guest = window.guestName || "";
    const comma = (currentData.direction === 'rtl') ? "، " : ", ";
    var text = guest ? msg + comma + guest : msg;

    var cfg = typeof window.getFastConfig === 'function' ? window.getFastConfig() : null;
    if (cfg && cfg.hotel && cfg.hotel.hotel_name) {
        text = text + " | " + cfg.hotel.hotel_name;
    }

    greetEl.textContent = text;
}

async function updateWeather() {
    const tempEl = document.getElementById('temp');
    if (!tempEl) return;

    try {
        // Use the offline-capable weather module if available
        if (window.WeatherModule && typeof window.WeatherModule.getDisplayData === 'function') {
            const weatherData = await window.WeatherModule.getDisplayData();
            if (weatherData) {
                const { tempString, city, isRTL } = weatherData;
                if (isRTL) {
                    tempEl.textContent = `${tempString} ${city}`;
                    tempEl.style.direction = 'rtl';
                } else {
                    tempEl.textContent = `${city} ${tempString}`;
                    tempEl.style.direction = 'ltr';
                }
                return;
            }
        }

        // Fallback: direct fetch (will work if cached, show error gracefully if not)
        const response = await fetch('weather/weather_data.json?v=' + Date.now());
        if (!response.ok) throw new Error("Weather file not found");

        const data = await response.json();
        const tempC = Math.round(data.extracted_data.temp);
        const tempF = Math.round((tempC * 9 / 5) + 32);
        const tempString = `${tempC}°C / ${tempF}°F`;

        let city = "Mumbai";
        if (typeof currentData !== 'undefined' && currentData.city_name) {
            city = currentData.city_name;
        }

        const isRTL = document.body.classList.contains('rtl-mode');

        if (isRTL) {
            tempEl.textContent = `${tempString} ${city}`;
            tempEl.style.direction = 'rtl';
        } else {
            tempEl.textContent = `${city} ${tempString}`;
            tempEl.style.direction = 'ltr';
        }
    } catch (error) {
        console.error("Weather Update Error:", error);
        // Silent fail - temp element keeps previous value or shows nothing
    }
}

/* ================= 4. COMING SOON ================= */
var comingSoonLinks = ['./travel/travel.html', './flights/flights.html', './city/city.html', './weather/weather.html'];

/* ================= 5. LISTENERS ================= */
document.addEventListener("keydown", function (e) {
    var keyCode = e.keyCode || e.which;

    // If coming soon overlay is visible, dismiss it on any keypress
    var csOverlay = document.getElementById('comingSoonOverlay');
    if (csOverlay && csOverlay.style.display === 'flex') {
        e.preventDefault();
        csOverlay.style.display = 'none';
        return;
    }

    if (keyCode === 8 || keyCode === 461 || keyCode === 4 || keyCode === 10009 || keyCode === 10182) { // support Android TV, webOS, and Tizen back keys
        var path = window.location.pathname.split("/").pop();
        if (path !== "index.html" && path !== "") {
            e.preventDefault();
            window.location.href = "index.html";
        }
    }

    if (keyCode === 39 || keyCode === 22 || e.key === "ArrowRight" || e.key === "Right") {
        rotate('right');
    }
    else if (keyCode === 37 || keyCode === 21 || e.key === "ArrowLeft" || e.key === "Left") {
        rotate('left');
    }
    else if (keyCode === 13 || keyCode === 23 || keyCode === 66 || e.key === "Enter") {
        var active = document.activeElement;
        if (!active) return;
        var link = active.getAttribute('data-link');
        var action = active.getAttribute('data-action');

        if (action === "apps") {
            if (typeof window.openAppsOverlay === 'function') {
                window.openAppsOverlay();
            } else if (window.AndroidBridge && window.AndroidBridge.openApplications) {
                window.AndroidBridge.openApplications();
            }
        } else if (action === "livetv") {
            handleLiveTV();
        } else if (link) {
            if (comingSoonLinks.indexOf(link) !== -1) {
                e.preventDefault();
                document.getElementById('comingSoonOverlay').style.display = 'flex';
                return;
            }
            window.location.href = link;
        }
    }
});

function showExpiredOverlay() {
    var overlay = document.getElementById('planExpiredOverlay');
    if (!overlay) return;
    overlay.style.display = 'flex';
    var btn = document.getElementById('planDismissBtn');
    if (btn) {
        btn.onclick = function () { overlay.style.display = 'none'; };
    }
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
            overlay.style.display = 'none';
        }
    });
}

function showWarningToast(daysLeft) {
    var toast = document.getElementById('planWarningToast');
    var body = document.getElementById('planWarningBody');
    if (!toast || !body) return;
    body.innerHTML = 'Your plan will expire in <strong>' + daysLeft + ' day' + (daysLeft > 1 ? 's' : '') + '</strong>. Please renew to avoid interruption.';
    toast.style.display = 'block';
    setTimeout(function () {
        toast.style.display = 'none';
    }, 10000);
}

function checkPlanStatus(plan) {
    if (!plan || !plan.expiry_date) return;
    var now = new Date();
    var parts = plan.expiry_date.split('-');
    var expiry = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    var diff = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));
    if (diff <= 0) {
        showExpiredOverlay();
    } else if (diff <= 5) {
        showWarningToast(diff);
    }
}

window.onload = function () {
    var bg = document.getElementById('bg-slider');
    if (bg && !bg.style.backgroundImage) {
        bg.style.backgroundImage = "url('images/main.jpg')";
    }
    initLanguage();
    setInterval(updateDateTime, 1000);
    setInterval(updateWeather, 900000);
};