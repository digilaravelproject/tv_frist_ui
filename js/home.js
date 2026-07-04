/* ================= 1. CAROUSEL & FOCUS LOGIC ================= */
const track = document.getElementById("menuTrack");
const centerIndex = 3; 

function updateCarouselPosition() {
    const vWidth = window.innerWidth;
    const totalSlot = vWidth * 0.14285; 
    const offset = (vWidth / 2) - (centerIndex * totalSlot) - (totalSlot / 2);
    if(track) track.style.transform = `translateX(${offset}px)`;
}

function syncFocus() {
    if (!track) return;
    const allIcons = Array.from(track.querySelectorAll(".icon-item"));
    
    allIcons.forEach(icon => {
        const img = icon.querySelector(".icon-img");
        if (img) img.classList.remove("bounce");
    });

    const target = allIcons[centerIndex];
    if (target) {
        target.focus();
        const img = target.querySelector(".icon-img");
        if (img) {
            void img.offsetWidth; 
            img.classList.add("bounce");
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

async function initLanguage() {
    try {
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
        updateCarouselPosition();
        setTimeout(syncFocus, 300);
    }
}

function applyTranslations() {
    const roomNo = localStorage.getItem('roomNo') || "";
    const roomEl = document.getElementById('room');
    if(roomEl) roomEl.textContent = `${currentData.room_label} ${roomNo}`;
    
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
    fetch(`admin/rooms/${roomNo}.json?t=` + new Date().getTime())
        .then(res => res.json())
        .then(roomData => {
            if(roomData.guest_name) {
                const langKey = (currentData.language_name) ? currentData.language_name.toLowerCase() : "english";
                let localizedName = roomData.guest_name[langKey] || roomData.guest_name["english"] || "";
                window.guestName = localizedName;
                updateGreetingDisplay();
            }
        }).catch(e => {});
}

function updateDateTime() {
    const now = new Date();
    const isRTL = document.body.classList.contains('rtl-mode');
    
    // Set Time - uses local system clock (no NTP)
    const timeEl = document.getElementById('time');
    if(timeEl) timeEl.textContent = now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', hour12: false});

    // Set Room
    const roomNo = localStorage.getItem('roomNo') || "";
    const roomEl = document.getElementById('room');
    if(roomEl) roomEl.textContent = `${currentData.room_label} ${roomNo}`;

    // Set Date with RTL comma
    const dateEl = document.getElementById('date');
    if(dateEl) {
        const dayKey = now.toLocaleDateString('en-US', {weekday: 'short'}).toLowerCase();
        const monthKey = now.toLocaleDateString('en-US', {month: 'short'}).toLowerCase();
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
    greetEl.textContent = guest ? `${msg}${comma}${guest}` : msg;
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
        const tempF = Math.round((tempC * 9/5) + 32);
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

/* ================= 4. LISTENERS ================= */
document.addEventListener("keydown", (e) => {
    if (e.keyCode === 8 || e.keyCode === 461) {
        const path = window.location.pathname.split("/").pop();
        if (path !== "index.html" && path !== "") {
            e.preventDefault();
            window.location.href = "index.html";
        }
    }
    if (e.key === "ArrowRight") rotate('right');
    else if (e.key === "ArrowLeft") rotate('left');
    else if (e.key === "Enter") {
        const active = document.activeElement;
        const link = active.getAttribute('data-link');
        const action = active.getAttribute('data-action');
        
        if (action === "apps") {
            if (window.AndroidBridge && window.AndroidBridge.openApplications) {
                window.AndroidBridge.openApplications();
            } else if (window.flutterBridge) {
                // Fallback: open applications menu via bridge
                window.flutterBridge.getHdmiModels().catch(() => {});
            }
        } else if (action === "livetv") {
            handleLiveTV();
        } else if (link) {
            window.location.href = link;
        }
    }
});

window.onload = () => {
    initLanguage();
    setInterval(updateDateTime, 1000);
    setInterval(updateWeather, 900000); // 15 minutes
};