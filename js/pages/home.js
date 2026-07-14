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
        }, 5000);
    }
}

async function initLanguage() {
    try {
        // Load dynamic hotel configuration instantly from cache if available
        const cachedConfig = typeof window.getFastConfig === 'function' ? window.getFastConfig() : null;
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
                updateGreetingDisplay();
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

    var cfg = typeof window.getFastConfig === 'function' ? window.getFastConfig() : null;
    let guest = "Guest";
    if (cfg && cfg.guest_info && cfg.guest_info.name) {
        guest = cfg.guest_info.name;
    } else if (window.guestName) {
        guest = window.guestName;
    }

    const comma = (currentData.direction === 'rtl') ? "، " : ", ";
    var text = msg + comma + guest;

    greetEl.textContent = text;
}

let owmApiKey = null;
async function getApiKey() {
    if (owmApiKey) return owmApiKey;
    try {
        const response = await fetch('admin/config.json?v=' + Date.now());
        if (response.ok) {
            const config = await response.json();
            owmApiKey = config.OWM_API_KEY;
        }
    } catch (e) {
        console.warn("Could not load OWM_API_KEY from config.json", e);
    }
    return owmApiKey || "95265a9bc38d5d5ec7092f78a9fa8c2d";
}

async function fetchIpLocation() {
    try {
        const res = await fetch('https://ipinfo.io/json');
        if (res.ok) {
            const data = await res.json();
            if (data && data.city) return data.city;
        }
    } catch (e) {
        console.warn("ipinfo.io failed, trying fallback:", e);
    }
    try {
        const res = await fetch('https://ipapi.co/json/');
        if (res.ok) {
            const data = await res.json();
            if (data && data.city) return data.city;
        }
    } catch (e) {
        console.warn("ipapi.co failed:", e);
    }
    return null;
}

async function resolveLocation() {
    // 1. Manual override takes highest priority
    let cachedCity = localStorage.getItem('weather_city');
    let isManual = localStorage.getItem('weather_city_manual') === 'true';
    if (cachedCity && isManual) return cachedCity;

    // 2. data.json (hotel_location)
    try {
        const cachedConfigStr = localStorage.getItem('cachedHotelData');
        let config = null;
        if (cachedConfigStr) {
            config = JSON.parse(cachedConfigStr);
        }
        if (!config && typeof window.getFastConfig === 'function') {
            config = window.getFastConfig();
        }
        if (config && config.hotel && config.hotel.hotel_location) {
            const loc = config.hotel.hotel_location;
            localStorage.setItem('weather_city', loc);
            // Ensure manual flag is false since it's an auto-detected/configured hotel location
            localStorage.setItem('weather_city_manual', 'false');
            return loc;
        }
    } catch (e) {
        console.warn("Failed resolving hotel_location", e);
    }

    // 3. Fallback to cached city (even if not manual)
    if (cachedCity) return cachedCity;

    // 4. IP Geolocation fallback
    const ipCity = await fetchIpLocation();
    if (ipCity) {
        localStorage.setItem('weather_city', ipCity);
        localStorage.setItem('weather_city_manual', 'false');
        return ipCity;
    }

    // 5. Ultimate Fallback
    return "Mumbai";
}

async function updateWeather() {
    const tempEl = document.getElementById('temp');
    if (!tempEl) return;

    try {
        const city = await resolveLocation();
        const apiKey = await getApiKey();

        if (!apiKey || apiKey === "YOUR_OPENWEATHERMAP_API_KEY") {
            console.warn("No valid OWM API key configured. Using local fallback data.");
            const response = await fetch('weather/weather_data.json?v=' + Date.now());
            if (!response.ok) throw new Error("Weather file not found");

            const data = await response.json();
            const tempC = Math.round(data.extracted_data.temp);
            const tempF = Math.round((tempC * 9 / 5) + 32);
            const tempString = `${tempC}°C / ${tempF}°F`;
            const isRTL = document.body.classList.contains('rtl-mode');
            tempEl.textContent = isRTL ? `${tempString} ${city}` : `${city} ${tempString}`;
            tempEl.style.direction = isRTL ? 'rtl' : 'ltr';
            return;
        }

        const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&units=metric&appid=${apiKey}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error("OWM API Request failed");

        const data = await response.json();
        const tempC = Math.round(data.main.temp);
        const tempF = Math.round((tempC * 9 / 5) + 32);
        const tempString = `${tempC}°C / ${tempF}°F`;

        const isRTL = document.body.classList.contains('rtl-mode');
        if (isRTL) {
            tempEl.textContent = `${tempString} ${city}`;
            tempEl.style.direction = 'rtl';
        } else {
            tempEl.textContent = `${city} ${tempString}`;
            tempEl.style.direction = 'ltr';
        }

        localStorage.setItem('cached_temp_string', tempString);
        localStorage.setItem('cached_temp_city', city);

    } catch (error) {
        console.error("Weather Update Error:", error);
        const cachedTemp = localStorage.getItem('cached_temp_string');
        const cachedCity = localStorage.getItem('cached_temp_city');
        if (cachedTemp && cachedCity) {
            const isRTL = document.body.classList.contains('rtl-mode');
            tempEl.textContent = isRTL ? `${cachedTemp} ${cachedCity}` : `${cachedCity} ${cachedTemp}`;
            tempEl.style.direction = isRTL ? 'rtl' : 'ltr';
        }
    }
}

let allCitiesList = [];
async function loadCitiesList() {
    try {
        const langFile = localStorage.getItem('selectedLangFile') || 'english.json';
        const langName = langFile.replace('.json', '');
        const response = await fetch(`admin/cities/${langName}_cities.json`);
        if (response.ok) {
            allCitiesList = await response.json();
        } else {
            const fallbackRes = await fetch('admin/cities/english_cities.json');
            if (fallbackRes.ok) {
                allCitiesList = await fallbackRes.json();
            }
        }
    } catch (e) {
        console.warn("Failed to load cities list", e);
    }
}

function initCitySelector() {
    const tempEl = document.getElementById('temp');
    const overlay = document.getElementById('citySelectorOverlay');
    const closeBtn = document.getElementById('city-selector-close-btn');
    const customInput = document.getElementById('custom-city-input');
    const customSaveBtn = document.getElementById('custom-city-save-btn');
    const statusEl = document.getElementById('current-location-status');
    const autoDetectBtn = document.getElementById('auto-detect-location-btn');
    const suggestionsContainer = document.getElementById('city-suggestions-container');

    if (!tempEl || !overlay) return;

    // Load cities list dynamically on init
    loadCitiesList();

    async function showOverlay() {
        overlay.style.display = 'flex';
        document.body.classList.add('overlay-active');
        window.__citySelectorOpen = true;

        const currentLoc = await resolveLocation();
        if (statusEl) statusEl.textContent = `Current: ${currentLoc}`;

        // Clear previous input & suggestions
        if (customInput) customInput.value = '';
        if (suggestionsContainer) {
            suggestionsContainer.innerHTML = '';
            suggestionsContainer.style.display = 'none';
        }

        setTimeout(() => {
            if (window.TVNavigation && typeof window.TVNavigation.markDirty === 'function') {
                window.TVNavigation.markDirty();
            }
            const firstBtn = overlay.querySelector('.city-btn');
            if (firstBtn) {
                firstBtn.focus();
                firstBtn.classList.add('active-focus');
            }
        }, 100);
    }

    function hideOverlay() {
        overlay.style.display = 'none';
        document.body.classList.remove('overlay-active');
        window.__citySelectorOpen = false;
        setTimeout(() => {
            if (window.TVNavigation && typeof window.TVNavigation.markDirty === 'function') {
                window.TVNavigation.markDirty();
            }
            tempEl.focus();
            tempEl.classList.add('active-focus');
        }, 100);
    }

    // Auto-Detect Click Handler
    if (autoDetectBtn) {
        autoDetectBtn.addEventListener('click', async function() {
            if (statusEl) statusEl.textContent = "Current: Detecting location...";
            const ipCity = await fetchIpLocation();
            if (ipCity) {
                localStorage.setItem('weather_city', ipCity);
                localStorage.setItem('weather_city_manual', 'true');
                await updateWeather();
                hideOverlay();
                return;
            }
            if (statusEl) statusEl.textContent = "Current: Auto Detect Failed";
        });
    }

    tempEl.addEventListener('click', showOverlay);
    tempEl.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            showOverlay();
        }
    });

    if (closeBtn) closeBtn.addEventListener('click', hideOverlay);

    const cityButtons = overlay.querySelectorAll('.city-btn');
    cityButtons.forEach(btn => {
        btn.addEventListener('click', function () {
            const city = btn.getAttribute('data-city');
            if (city) {
                localStorage.setItem('weather_city', city);
                localStorage.setItem('weather_city_manual', 'true');
                updateWeather();
                hideOverlay();
            }
        });
    });

    // Handle suggestions on input typing
    if (customInput && suggestionsContainer) {
        customInput.addEventListener('input', function() {
            const query = customInput.value.trim().toLowerCase();
            if (query.length < 1) {
                suggestionsContainer.innerHTML = '';
                suggestionsContainer.style.display = 'none';
                return;
            }

            // Filter cities from json
            const matches = allCitiesList.filter(item => {
                const eng = (item.english_name || '').toLowerCase();
                const loc = (item.local_name || '').toLowerCase();
                return eng.includes(query) || loc.includes(query);
            }).slice(0, 5); // Max 5 suggestions

            if (matches.length === 0) {
                suggestionsContainer.innerHTML = '';
                suggestionsContainer.style.display = 'none';
                return;
            }

            suggestionsContainer.innerHTML = '';
            suggestionsContainer.style.display = 'block';

            matches.forEach(match => {
                const div = document.createElement('div');
                div.className = 'suggestion-item';
                div.tabIndex = 0;
                div.textContent = match.local_name || match.english_name;
                div.setAttribute('data-english', match.english_name);
                
                div.addEventListener('click', function() {
                    const selectedCity = div.getAttribute('data-english');
                    localStorage.setItem('weather_city', selectedCity);
                    localStorage.setItem('weather_city_manual', 'true');
                    updateWeather();
                    hideOverlay();
                });

                div.addEventListener('keydown', function(e) {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        div.click();
                    }
                });

                suggestionsContainer.appendChild(div);
            });

            if (window.TVNavigation && typeof window.TVNavigation.markDirty === 'function') {
                window.TVNavigation.markDirty();
            }
        });
    }

    if (customSaveBtn && customInput) {
        customSaveBtn.addEventListener('click', function () {
            const val = customInput.value.trim();
            if (val) {
                localStorage.setItem('weather_city', val);
                localStorage.setItem('weather_city_manual', 'true');
                updateWeather();
                hideOverlay();
            }
        });
        customInput.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                customSaveBtn.click();
            }
        });
    }
}

/* ================= 4. COMING SOON ================= */
var comingSoonLinks = ['./travel/travel.html', './flights/flights.html', './city/city.html'];

/* ================= 5. LISTENERS ================= */
function showExpiredOverlay() {
    var overlay = document.getElementById('planExpiredOverlay');
    if (!overlay) return;
    overlay.style.display = 'flex';
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
    try {
        var bg = document.getElementById('bg-slider');
        if (bg && !bg.style.backgroundImage) {
            bg.style.backgroundImage = "url('images/main.jpg')";
        }
        initLanguage();
        initCitySelector();
        setInterval(updateDateTime, 1000);
        setInterval(updateWeather, 900000);

        // Auto-focus synchronization for subpages loaded inside the iframe
        var subFrame = document.getElementById('subFrame');
        if (subFrame) {
            subFrame.addEventListener('load', function () {
                try {
                    if (subFrame.contentWindow) {
                        subFrame.contentWindow.focus();
                        if (subFrame.contentWindow.TVNavigation) {
                            subFrame.contentWindow.TVNavigation.handleInitialFocus();
                        }
                    }
                } catch (e) {
                    console.warn("Iframe focus sync error:", e);
                }
            });
        }

    } catch (e) {
        console.error('Initialization failed:', e);
    }
};        // --- 1. PREVENT ANDROID EXIT (Original Logic) ---
window.history.pushState(null, "", window.location.href);
window.onpopstate = function () {
    var comingSoon = document.getElementById('comingSoonOverlay');
    if (comingSoon && comingSoon.style.display === 'flex') {
        comingSoon.style.display = 'none';
        window.history.pushState(null, "", window.location.href);
        return;
    }
    var appsOverlay = document.getElementById('appsOverlay');
    if (appsOverlay && appsOverlay.classList.contains('show')) {
        closeAppsOverlay();
        window.history.pushState(null, "", window.location.href);
        return;
    }
    var overlay = document.getElementById('subPageOverlay');
    if (overlay.style.display === 'block') {
        closeSubPage();
        window.history.pushState(null, "", window.location.href);
    } else {
        window.history.pushState(null, "", window.location.href);
    }
};


function openSubPage(url) {
    var overlay = document.getElementById('subPageOverlay');
    if (!overlay) return;
    document.getElementById('subFrame').src = url;
    overlay.style.display = 'block';
    document.getElementById('mainUI').style.display = 'none';
    window.history.pushState(null, "", window.location.href);
    var subFrame = document.getElementById('subFrame');
    if (subFrame) {
        subFrame.focus();
        try {
            if (subFrame.contentWindow) {
                subFrame.contentWindow.focus();
            }
        } catch (e) { }
    }
}
window.openSubPage = openSubPage;

function closeSubPage() {
    document.getElementById('subPageOverlay').style.display = 'none';
    document.getElementById('subFrame').src = "";
    document.getElementById('mainUI').style.display = 'block';
    var items = document.querySelectorAll('.icon-item');
    if (items[3]) items[3].focus();
}

// =============================================================
// APPLICATIONS OVERLAY (Apps + TV Inputs)
// =============================================================

var DEFAULT_APP_ICON = 'images/icons/apps.png';

async function loadApplications() {
    var container = document.getElementById('apps-container');
    if (!container) return;
    container.innerHTML = '<div style="color:#888;font-size:1.2vw;grid-column:1/-1;text-align:center;">Loading...</div>';

    try {
        var bridge = window.flutterBridge;
        var apps = await bridge.getInstalledApps();
        if (!apps || apps.length === 0) throw new Error('No apps');

        container.innerHTML = '';
        apps.forEach(function (app) {
            var pkg = app.packageName || app.package || app.id || '';
            var name = app.name || app.label || pkg;
            var icon = app.icon || '';

            var card = document.createElement('div');
            card.className = 'app-card';
            card.tabIndex = 0;
            card.setAttribute('data-package', pkg);

            var img = document.createElement('img');
            img.src = icon || DEFAULT_APP_ICON;
            img.alt = name;
            img.onerror = function () { this.src = DEFAULT_APP_ICON; };

            var label = document.createElement('div');
            label.className = 'app-name';
            label.textContent = name;

            card.appendChild(img);
            card.appendChild(label);

            card.addEventListener('click', function () {
                var p = this.getAttribute('data-package');
                if (p && window.flutterBridge && window.flutterBridge.launchApp) {
                    window.flutterBridge.launchApp(p)['catch'](function (err) {
                        console.error('Launch app failed:', err);
                    });
                }
            });
            card.addEventListener('keydown', function (e) {
                if (e.key === 'Enter' || e.keyCode === 13) {
                    this.click();
                }
            });

            container.appendChild(card);
        });

        // Mark focus cache dirty and focus the first card once rendered
        if (window.TVNavigation && typeof window.TVNavigation.markDirty === 'function') {
            window.TVNavigation.markDirty();
        }
        var firstCard = container.querySelector('.app-card');
        if (firstCard) {
            firstCard.focus();
            firstCard.classList.add('active-focus');
        }
    } catch (e) {
        container.innerHTML = '<div style="color:#888;font-size:1.2vw;grid-column:1/-1;text-align:center;">No applications available</div>';
        console.error('loadApplications error:', e);
    }
}

async function loadTvInputs() {
    var container = document.getElementById('tv-inputs-container');
    if (!container) return;

    try {
        var bridge = window.flutterBridge;
        var inputs = await bridge.getTvInputs();
        if (!inputs || inputs.length === 0) {
            container.innerHTML = '<div style="color:#888;font-size:1.1vw;">No TV inputs available</div>';
            return;
        }

        var lastPort = localStorage.getItem('selectedHdmiPort');
        var deviceSerial = localStorage.getItem('deviceSerial');
        if (deviceSerial) {
            try {
                var res = await fetch('/admin/devices/' + deviceSerial + '.json');
                if (res.ok) {
                    var deviceData = await res.json();
                    if (deviceData.hdmiPort) lastPort = deviceData.hdmiPort;
                }
            } catch (e) { /* fallback to local storage */ }
        }

        container.innerHTML = '';
        inputs.forEach(function (input) {
            var btn = document.createElement('button');
            btn.className = 'tv-input-btn';
            btn.tabIndex = 0;
            var label = input.label || input.id || 'HDMI';
            btn.textContent = label;
            var modelId = input.id || '';
            btn.setAttribute('data-model', modelId);

            if (lastPort && (modelId.toLowerCase() === lastPort.toLowerCase() || label.toLowerCase() === lastPort.toLowerCase())) {
                btn.style.border = '2px solid #b38a2d';
                btn.style.background = 'rgba(179,138,45,0.2)';
                btn.style.boxShadow = 'inset 0 0 8px rgba(179,138,45,0.5)';
            }

            btn.addEventListener('click', function () {
                var model = this.getAttribute('data-model');
                var label = this.textContent;
                if (model) {
                    localStorage.setItem('selectedHdmiPort', model);
                } else if (label) {
                    localStorage.setItem('selectedHdmiPort', label);
                }
                loadTvInputs();
                closeAppsOverlay();
                if (model && window.flutterBridge && window.flutterBridge.launchHdmi) {
                    window.flutterBridge.launchHdmi(model)['catch'](function (err) {
                        console.error('Launch HDMI failed:', err);
                    });
                }
            });
            btn.addEventListener('keydown', function (e) {
                if (e.key === 'Enter' || e.keyCode === 13) {
                    this.click();
                }
            });

            container.appendChild(btn);
        });

        // Mark focus cache dirty and focus the first input button once rendered
        if (window.TVNavigation && typeof window.TVNavigation.markDirty === 'function') {
            window.TVNavigation.markDirty();
        }
        var firstInput = container.querySelector('.tv-input-btn');
        if (firstInput) {
            firstInput.focus();
            firstInput.classList.add('active-focus');
        }
    } catch (e) {
        container.innerHTML = '<div style="color:#888;font-size:1.1vw;">No TV inputs available</div>';
        console.error('loadTvInputs error:', e);
    }
}

function openAppsOverlay() {
    var overlay = document.getElementById('appsOverlay');
    if (!overlay) return;
    overlay.classList.add('show');
    document.body.classList.add('overlay-active');
    document.getElementById('mainUI').style.display = 'none';
    window.history.pushState(null, "", window.location.href);
    window.__appsOverlayOpen = true;

    var appsTitle = overlay.querySelector('.apps-title');
    if (appsTitle) appsTitle.textContent = 'Applications';

    var section = document.getElementById('tv-inputs-section');
    if (section) section.style.display = 'none';

    var container = document.getElementById('tv-inputs-container');
    if (container) container.style.display = 'none';

    document.getElementById('apps-container').style.display = '';

    loadApplications();

    setTimeout(function () {
        var firstCard = document.querySelector('.app-card');
        if (firstCard) firstCard.focus();
    }, 200);
}

function openLiveTVOverlay() {
    var overlay = document.getElementById('appsOverlay');
    if (!overlay) return;
    overlay.classList.add('show');
    document.body.classList.add('overlay-active');
    document.getElementById('mainUI').style.display = 'none';
    window.history.pushState(null, "", window.location.href);
    window.__appsOverlayOpen = true;

    var appsTitle = overlay.querySelector('.apps-title');
    if (appsTitle) appsTitle.textContent = 'Live TV';

    var section = document.getElementById('tv-inputs-section');
    if (section) section.style.display = '';

    var container = document.getElementById('tv-inputs-container');
    if (container) container.style.display = '';

    document.getElementById('apps-container').style.display = 'none';

    loadTvInputs();

    setTimeout(function () {
        var firstInput = document.querySelector('.tv-input-btn');
        if (firstInput) firstInput.focus();
    }, 200);
}

function closeAppsOverlay() {
    var overlay = document.getElementById('appsOverlay');
    if (!overlay) return;
    overlay.classList.remove('show');
    document.body.classList.remove('overlay-active');
    window.__appsOverlayOpen = false;
    document.getElementById('mainUI').style.display = 'block';
    var items = document.querySelectorAll('.icon-item');
    if (items[3]) items[3].focus();
}



document.getElementById('appsCloseBtn').addEventListener('click', function () {
    closeAppsOverlay();
    window.history.pushState(null, "", window.location.href);
});

window.openAppsOverlay = openAppsOverlay;
window.closeAppsOverlay = closeAppsOverlay;
window.openLiveTVOverlay = openLiveTVOverlay;

var comingSoonLinks = ['./travel/travel.html', './flights/flights.html', './city/city.html'];

document.querySelectorAll('.icon-item').forEach(item => {
    item.addEventListener('click', function () {
        const action = this.getAttribute('data-action');

        if (action === "livetv") {
            if (typeof window.openLiveTVOverlay === 'function') window.openLiveTVOverlay();
            return;
        }
        if (action === "apps") {
            if (typeof window.openAppsOverlay === 'function') window.openAppsOverlay();
            return;
        }

        const link = this.dataset.link || this.getAttribute('href');

        if (link && comingSoonLinks.indexOf(link) !== -1) {
            var overlay = document.getElementById('comingSoonOverlay');
            if (overlay) {
                overlay.style.display = 'flex';
                setTimeout(function () {
                    if (window.TVNavigation && typeof window.TVNavigation.markDirty === 'function') {
                        window.TVNavigation.markDirty();
                    }
                    var btn = overlay.querySelector('.cs-close-btn');
                    if (btn) {
                        btn.focus();
                        btn.classList.add('active-focus');
                    }
                }, 100);
            }
            return;
        }

        if (link) {
            window.location.href = link;
        }
    });
});



window.onTVKeyDown = function (e) {
    var comingSoon = document.getElementById("comingSoonOverlay");
    if (comingSoon && comingSoon.style.display === "flex") {
        e.preventDefault();
        comingSoon.style.display = "none";
        var items = document.querySelectorAll('.icon-item');
        if (items[3]) items[3].focus();
        return true;
    }
    return false;
};

window.onTVBack = function () {
    var citySelector = document.getElementById("citySelectorOverlay");
    if (citySelector && citySelector.style.display === "flex") {
        citySelector.style.display = "none";
        window.__citySelectorOpen = false;
        var tempEl = document.getElementById('temp');
        if (tempEl) {
            tempEl.focus();
            tempEl.classList.add('active-focus');
        }
        if (window.TVNavigation && typeof window.TVNavigation.markDirty === 'function') {
            window.TVNavigation.markDirty();
        }
        window.history.pushState(null, "", window.location.href);
        return true;
    }
    var comingSoon = document.getElementById("comingSoonOverlay");
    if (comingSoon && comingSoon.style.display === "flex") {
        comingSoon.style.display = "none";
        var items = document.querySelectorAll('.icon-item');
        if (items[3]) items[3].focus();
        window.history.pushState(null, "", window.location.href);
        return true;
    }
    var appsOverlay = document.getElementById("appsOverlay");
    if (appsOverlay && appsOverlay.classList.contains("show")) {
        closeAppsOverlay();
        window.history.pushState(null, "", window.location.href);
        return true;
    }
    var overlay = document.getElementById("subPageOverlay");
    if (overlay && overlay.style.display === "block") {
        closeSubPage();
        window.history.pushState(null, "", window.location.href);
        return true;
    }
    return false;
};

window.onTVNavigate = function (direction, active) {
    var isIndex = window.location.pathname.indexOf('index.html') !== -1 || window.location.pathname.split('/').pop() === '';
    if (isIndex && !window.__appsOverlayOpen) {
        if (direction === "left") {
            rotate("left");
            return true;
        }
        if (direction === "right") {
            rotate("right");
            return true;
        }
    }
    return false;
};
