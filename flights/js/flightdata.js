/**
 * Flight Module - Offline-First Flight Board
 * 
 * This module handles flight data with graceful offline fallback.
 * It reads from local cached JSON (data_departures.json, data_arrivals.json)
 * and localStorage cache. Sync is handled by Flutter/Dart background isolate.
 */

(function() {
    'use strict';

    const CACHE_KEY_DEP = 'flights_cache_departures';
    const CACHE_KEY_ARR = 'flights_cache_arrivals';
    const CACHE_TIMESTAMP_KEY = 'flights_cache_timestamp';
    const MAX_CACHE_AGE_MS = 6 * 60 * 60 * 1000; // 6 hours

    let currentMode = 'departures';
    let currentPage = 0;
    let flightData = [];
    let currentLangData = null;
    let cityTranslations = [];
    let airlineTranslations = [];
    const rowsPerPage = 7;
    const fixedMaxFlights = 70;

    const navMap = {
        'depBtn':     { left: null,      right: 'arrBtn',      up: null,     down: 'prevBtn' },
        'arrBtn':     { left: 'depBtn',  right: null,          up: null,     down: 'nextBtn' },
        'prevBtn':    { left: null,      right: 'nextBtn',     up: 'depBtn', down: null },
        'nextBtn':    { left: 'prevBtn', right: 'refreshBtn',  up: 'arrBtn', down: null },
        'refreshBtn': { left: 'nextBtn', right: null,           up: 'arrBtn', down: null }
    };

    async function loadFlightTranslations() {
        try {
            const langFile = localStorage.getItem('selectedLangFile') || 'english.json';
            const langCode = langFile.split('.')[0];
            
            // Load main language file
            const response = await fetch('languages/' + langFile + '?t=' + Date.now());
            if (response.ok) {
                currentLangData = await response.json();
                applyStaticLabels();
            }
            
            // Load city translations (pre-generated at build time)
            const cityRes = await fetch(`cities/${langCode}_cities.json?t=` + Date.now()).catch(() => null);
            if (cityRes && cityRes.ok) cityTranslations = await cityRes.json();
            
            // Load airline translations (pre-generated at build time)
            const airRes = await fetch(`airlines/${langCode}_airlines.json?t=` + Date.now()).catch(() => null);
            if (airRes && airRes.ok) airlineTranslations = await airRes.json();
        } catch (e) { 
            console.error("Lang Load Error", e); 
        }
    }

    function getLocalName(englishName, translationList) {
        if (!translationList || translationList.length === 0 || !englishName) return englishName;
        const searchName = englishName.trim().toLowerCase();
        
        const match = translationList.find(item => {
            if (!item.english_name) return false;
            const entry = item.english_name.toLowerCase();
            return entry === searchName || searchName.startsWith(entry) || searchName.includes(entry) || entry.includes(searchName);
        });
        
        // Always return englishName as fallback to prevent empty cells
        return match ? match.local_name : englishName;
    }

    function applyStaticLabels() {
        if (!currentLangData) return;

        // Handle Direction
        const isRTL = currentLangData.direction === 'rtl';
        document.body.style.direction = isRTL ? 'rtl' : 'ltr';
        
        const footer = document.querySelector('.footer-info');
        if (footer) {
            footer.style.direction = isRTL ? 'rtl' : 'ltr';
        }

        const setLabel = (id, text) => {
            const el = document.getElementById(id);
            if (el) el.innerText = text;
        };

        setLabel('depBtn', currentLangData.departures || "DEPARTURES");
        setLabel('arrBtn', currentLangData.arrivals || "ARRIVALS");
        setLabel('th-time', currentLangData.time || "TIME");
        setLabel('th-flight', currentLangData.flight || "FLIGHT");
        setLabel('th-terminal', currentLangData.terminal || "TERMINAL");
        setLabel('th-airline', currentLangData.airline || "AIRLINE");
        setLabel('th-status', currentLangData.status || "STATUS");
        setLabel('prevBtn', currentLangData.previous || "PREV");
        setLabel('nextBtn', currentLangData.next || "NEXT");
        setLabel('refreshBtn', currentLangData.refresh || "REFRESH NOW");
        
        updateHeaderLabel();
    }

    function updateHeaderLabel() {
        const header = document.getElementById('headerLabel');
        if (!header) return;
        header.innerText = (currentMode === 'departures') ? (currentLangData?.destination || "DESTINATION") : (currentLangData?.origin || "ORIGIN");
    }

    async function loadTableData(isInitial = true, forceRefresh = false) {
        const cacheKey = currentMode === 'departures' ? CACHE_KEY_DEP : CACHE_KEY_ARR;
        const jsonFile = `data_${currentMode}.json`;
        
        // Try to fetch fresh data from local JSON
        try {
            const response = await fetch(`${jsonFile}?v=${Date.now()}`);
            if (response.ok) {
                const fileLastModified = response.headers.get('Last-Modified');
                const fileDate = fileLastModified ? new Date(fileLastModified) : new Date();
                const now = new Date();
                
                // Check if data is stale (> 6 hours)
                if (!forceRefresh && Math.abs(now - fileDate) > 600000) {
                    triggerBackgroundSync();
                }
                
                let data = await response.json();
                
                // Filter out cargo flights
                flightData = data.filter(f => {
                    if (!f.airline) return true;
                    const airline = f.airline.toLowerCase();
                    return !airline.includes("cargo") && !airline.includes("blue dart");
                }).slice(0, fixedMaxFlights);
                
                // Update localStorage cache
                localStorage.setItem(cacheKey, JSON.stringify(flightData));
                localStorage.setItem(CACHE_TIMESTAMP_KEY, now.toISOString());
                
                if (isInitial) currentPage = 0;
                renderPage();
                
                const lastUpLabel = currentLangData?.last_updated || "Last Refreshed";
                const lastUpdatedEl = document.getElementById('lastUpdated');
                if (lastUpdatedEl) {
                    lastUpdatedEl.innerText = `${lastUpLabel}: ${fileDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
                }
                
                // Remove offline banner if present
                removeOfflineBanner();
                return;
            }
        } catch (e) {
            console.warn("Fresh flight data fetch failed, trying cache:", e);
        }

        // Fallback to localStorage cache
        const cachedData = localStorage.getItem(cacheKey);
        const cacheTimestamp = localStorage.getItem(CACHE_TIMESTAMP_KEY);
        
        if (cachedData) {
            try {
                flightData = JSON.parse(cachedData);
                if (isInitial) currentPage = 0;
                renderPage();
                
                // Show offline banner
                if (cacheTimestamp) {
                    const cacheDate = new Date(cacheTimestamp);
                    showOfflineBanner(cacheDate);
                }
                
                const lastUpLabel = currentLangData?.last_updated || "Last Refreshed";
                const lastUpdatedEl = document.getElementById('lastUpdated');
                if (lastUpdatedEl && cacheTimestamp) {
                    const cacheDate = new Date(cacheTimestamp);
                    lastUpdatedEl.innerText = `${lastUpLabel} (Offline): ${cacheDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
                }
                return;
            } catch (e) {
                console.error("Failed to parse cached flight data:", e);
            }
        }

        // No data at all - show empty state
        flightData = [];
        if (isInitial) currentPage = 0;
        renderPage();
        showOfflineBanner(null);
    }

    function showOfflineBanner(cacheDate) {
        removeOfflineBanner();
        const banner = document.createElement('div');
        banner.id = 'offline-banner';
        banner.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#ff8c00;color:#000;text-align:center;padding:8px;font-weight:bold;z-index:9999;font-size:1.2rem;';
        if (cacheDate) {
            banner.textContent = `⚠️ Offline Mode — Showing cached flight data from ${cacheDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
        } else {
            banner.textContent = '⚠️ Offline Mode — No cached flight data available';
        }
        document.body.insertBefore(banner, document.body.firstChild);
    }

    function removeOfflineBanner() {
        const existing = document.getElementById('offline-banner');
        if (existing) existing.remove();
    }

    function triggerBackgroundSync() {
        if (window.flutterBridge && typeof window.flutterBridge.syncFlights === 'function') {
            window.flutterBridge.syncFlights().catch(() => {});
        }
    }

    function renderPage() {
        const tableBody = document.getElementById('flightBody');
        if (!tableBody) return;

        const start = currentPage * rowsPerPage;
        const pageData = flightData.slice(start, start + rowsPerPage);

        let html = "";
        pageData.forEach(f => {
            let rawCity = f.city ? f.city.trim() : "Unknown";
            let searchCity = rawCity;
            const upperCity = rawCity.toUpperCase();

            // Handle specific multi-word airports
            if (upperCity.includes("NEWARK") || upperCity.includes("LIBERTY")) {
                searchCity = "Newark";
            } else if (upperCity.includes("KENNEDY") || upperCity.includes("JFK")) {
                searchCity = "New York";
            } else if (upperCity.includes("MALE") && upperCity.includes("VELANA")) {
                searchCity = "Male";
            } else if (upperCity.includes("DUBAI") && (upperCity.includes("WORLD") || upperCity.includes("CENTRAL"))) {
                searchCity = "Dubai";
            } else if (upperCity.includes("NAGPUR")) {
                searchCity = "Nagpur";
            } else if (upperCity.includes("HEATHROW")) {
                searchCity = "London Heathrow";
            } else if (upperCity.includes("GATWICK")) {
                searchCity = "London Gatwick";
            } else if (upperCity.includes("MANOHAR") || upperCity.includes("MOPA")) {
                searchCity = "Goa Mopa";
            } else if (upperCity.includes("DABOLIM")) {
                searchCity = "Goa Dabolim";
            } else {
                const dualCities = ["LONDON", "NEW YORK", "TOKYO", "DUBAI", "GOA", "MALE"];
                const isDual = dualCities.some(c => upperCity.includes(c));

                if (!isDual) {
                    searchCity = rawCity.split(/\s+(?:AIRPORT|INTL|INT'L|INTERNATIONAL|INDIRA|RAJIV|GANDHI|CHHATRAPATI|ZAYED|CHANGI|JOMO|HEYDAR|CHARLES|KING|BANDARANAIKE|BOLE|HAMAD|KEMPEGOWDA|NETAJI|SUBHAS|CHAUDHARY|DR\.|WUXU|TIANFU|WORLD|CENTRAL|SCHIPHOL|SIR|CHANDRA|BOSE|PRINCE|MOHAMMAD|CHOPIN|SEEWOOSAGUR|RAMGOOLAM)\b/i)[0].trim();
                }
            }

            // Translate
            let displayCity = getLocalName(searchCity, cityTranslations);
            
            // English special override
            const langFile = localStorage.getItem('selectedLangFile') || 'english.json';
            if (langFile === 'english.json') {
                if (upperCity.includes("KENNEDY") || upperCity.includes("JFK")) {
                    displayCity = "NEW YORK JFK";
                }
            }

            const airlineName = f.airline ? f.airline.split('(')[0].trim() : "Unknown";
            const displayAirline = getLocalName(airlineName, airlineTranslations);

            let statusText = (currentLangData?.on_time) || "On Time";
            let statusClass = "status-ontime";
            const timeMatch = f.status ? f.status.match(/(\d{2}:\d{2})/) : null;

            if (f.status && f.status.toLowerCase().includes("cancel")) {
                statusText = (currentLangData?.cancelled) || "Cancelled";
                statusClass = "status-cancelled";
            } else if (timeMatch && timeMatch[0] > f.time) {
                statusText = `${(currentLangData?.delayed) || "Delayed"} (${timeMatch[0]})`;
                statusClass = "status-delayed";
            }

            let term = f.terminal ? f.terminal.toString().toUpperCase() : "-";
            if (term !== "-" && !term.startsWith("T")) term = "T" + term;

            html += `<tr>
                <td style="color: #ff8c00; font-weight: bold;">${f.time}</td>
                <td><b>${f.flight.substring(0, 7)}</b></td>
                <td style="text-align:center;">${term}</td>
                <td>${displayAirline}</td>
                <td>${displayCity}</td>
                <td class="${statusClass}">${statusText}</td>
            </tr>`;
        });

        // Pad to minimum 7 rows
        while (html.split('<tr>').length - 1 < 7) {
            html += `<tr style="border:none;"><td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td></tr>`;
        }
        tableBody.innerHTML = html;
    }

    // Expose module API
    window.FlightModule = {
        loadTableData,
        getCurrentMode: () => currentMode,
        setCurrentMode: (mode) => { currentMode = mode; },
        triggerBackgroundSync,
        getFlightData: () => flightData,
        getCurrentPage: () => currentPage,
        setCurrentPage: (page) => { currentPage = page; }
    };

    // Backward compatibility for existing inline handlers
    window.currentMode = currentMode;
    Object.defineProperty(window, 'currentMode', {
        get: () => currentMode,
        set: (val) => { currentMode = val; }
    });

})();

// Navigation handlers (keep in global scope for inline event handlers)
let currentMode = 'departures';

document.addEventListener('keydown', (e) => {
    const id = document.activeElement.id;
    if (!navMap[id]) return;

    if (e.key.startsWith("Arrow")) {
        e.preventDefault();
        let dir = e.key.replace("Arrow", "").toLowerCase();

        const isRTL = document.body.style.direction === 'rtl';

        if (isRTL) {
            if (dir === "left") dir = "right";
            else if (dir === "right") dir = "left";
        }

        const targetId = navMap[id][dir];
        if (targetId) document.getElementById(targetId).focus();
    }

    if (e.key === "Enter" || e.keyCode === 13) {
        e.preventDefault();
        if (id === "nextBtn") {
            const totalPages = Math.ceil(flightData.length / rowsPerPage);
            if (currentPage < (totalPages - 1)) { 
                currentPage++; 
                window.FlightModule.renderPage(); 
            } 
        } else if (id === "prevBtn") {
            if (currentPage > 0) { 
                currentPage--; 
                window.FlightModule.renderPage(); 
            } 
        } else if (id === "depBtn" || id === "arrBtn") {
            currentMode = (id === "depBtn") ? 'departures' : 'arrivals';
            document.getElementById('depBtn').classList.toggle('active', id === "depBtn");
            document.getElementById('arrBtn').classList.toggle('active', id === "arrBtn");
            window.FlightModule.setCurrentMode(currentMode);
            updateHeaderLabel();
            window.FlightModule.loadTableData(true);
        } else if (id === "refreshBtn") { 
            window.FlightModule.loadTableData(true, true); 
        }
    }
});

window.onload = async () => {
    await loadFlightTranslations(); 
    currentMode = 'departures';
    document.getElementById('depBtn').classList.add('active');
    document.getElementById('arrBtn').classList.remove('active');
    await window.FlightModule.loadTableData(true);
    const nextBtn = document.getElementById('nextBtn');
    if (nextBtn) nextBtn.focus();
};
window.onTVBack = function() { window.location.href = '../index.html'; return true; };
