let currentMode = 'departures';
let currentPage = 0;
let flightData = [];
let currentLangData = null; 
const rowsPerPage = 7;
const fixedMaxFlights = 70; 

const navMap = {
    'depBtn':     { left: null,      right: 'arrBtn',     up: null,     down: 'prevBtn' },
    'arrBtn':     { left: 'depBtn',  right: null,         up: null,     down: 'nextBtn' },
    'prevBtn':    { left: null,      right: 'nextBtn',    up: 'depBtn', down: null },
    'nextBtn':    { left: 'prevBtn', right: 'refreshBtn', up: 'arrBtn', down: null },
    'refreshBtn': { left: 'nextBtn', right: null,          up: 'arrBtn', down: null }
};

// --- Translation Logic ---
async function loadFlightTranslations() {
    try {
        const langFile = localStorage.getItem('selectedLangFile') || 'english.json';
        const response = await fetch('admin/languages/' + langFile + '?t=' + Date.now());
        if (response.ok) {
            currentLangData = await response.json();
            applyStaticLabels();
        }
    } catch (e) { console.error("Lang Load Error", e); }
}

function applyStaticLabels() {
    if (!currentLangData) return;
    if (currentLangData.direction === 'rtl') document.body.style.direction = 'rtl';

    // Top Tabs
    document.getElementById('depBtn').innerText = currentLangData.departures || "DEPARTURES";
    document.getElementById('arrBtn').innerText = currentLangData.arrivals || "ARRIVALS";

    // Table Headers
    document.getElementById('th-time').innerText = currentLangData.time || "TIME";
    document.getElementById('th-flight').innerText = currentLangData.flight || "FLIGHT";
    document.getElementById('th-terminal').innerText = currentLangData.terminal || "TERMINAL";
    document.getElementById('th-airline').innerText = currentLangData.airline || "AIRLINE";
    document.getElementById('th-status').innerText = currentLangData.status || "STATUS";
    
    // Footer Buttons
    document.getElementById('prevBtn').innerText = currentLangData.previous || "PREV";
    document.getElementById('nextBtn').innerText = currentLangData.next || "NEXT";
    document.getElementById('refreshBtn').innerText = currentLangData.refresh || "REFRESH NOW";

    // Video Overlay Text
    const loadingText = (currentLangData.messages && currentLangData.messages.loading) || "Updating Flights Data...";
    document.getElementById('sync-text').innerText = loadingText;

    updateHeaderLabel();
}

function updateHeaderLabel() {
    const label = (currentMode === 'departures') 
        ? (currentLangData?.destination || "DESTINATION") 
        : (currentLangData?.origin || "ORIGIN");
    document.getElementById('headerLabel').innerText = label;
}

async function loadTableData(isInitial = true) {
    try {
        const response = await fetch(`data_${currentMode}.json?v=${Date.now()}`);
        let data = await response.json();
        
        flightData = data.filter(f => {
            const airline = f.airline.toLowerCase();
            return !airline.includes("cargo") && !airline.includes("blue dart");
        }).slice(0, fixedMaxFlights);

        updateHeaderLabel();
        if(isInitial) currentPage = 0;
        renderPage();

        // --- FIXED: Last Updated Translation ---
        const lastUpLabel = currentLangData?.last_updated || "Last Refreshed";
        document.getElementById('lastUpdated').innerText = `${lastUpLabel}: ${new Date().toLocaleTimeString()}`;
        
    } catch (e) { console.error("Data load failed", e); }
}

function renderPage() {
    const tableBody = document.getElementById('flightBody');
    const start = currentPage * rowsPerPage;
    const pageData = flightData.slice(start, start + rowsPerPage);

    let html = "";
    pageData.forEach(f => {
        let city = f.city.toUpperCase();
        
        // City Cleaning Logic
        if (city.includes("NEWARK")) city = "NEW YORK";
        if (city.includes("ZAYED") || city.includes("SAYED")) city = "ABU DHABI";
        if (city.includes("MOPA") || city.includes("MANOHAR")) city = "GOA MOPA";
        if (city.includes("DABOLIM")) city = "GOA DABOLIM";
        city = city.split(/ (?:AIRPORT|INTL|INT'L|INTERNATIONAL|INDIRA|RAJIV|CHHATRAPATI|KEMPEGOWDA|NETAJI|SUBHAS|CHAUDHARY|DR\.)/i)[0].trim();
        
        const words = city.split(" ");
        const multiWordCities = ["NEW", "ABU", "LOS", "HONG", "SAN", "ST.", "TEL", "ADDIS", "KUALA", "PORT", "HO", "SHARM"];
        if (words.length > 1 && !multiWordCities.includes(words[0])) city = words[0]; 

        // Status Logic with Translation
        let statusText = (currentLangData?.on_time) || "On Time";
        let statusClass = "status-ontime";
        const timeMatch = f.status.match(/(\d{2}:\d{2})/);

        if (f.status.toLowerCase().includes("cancel")) {
            statusText = (currentLangData?.cancelled) || "Cancelled";
            statusClass = "status-cancelled";
        } else if (timeMatch && timeMatch[0] > f.time) {
            const delayedLabel = (currentLangData?.delayed) || "Delayed";
            statusText = `${delayedLabel} (${timeMatch[0]})`;
            statusClass = "status-delayed";
        }

        let term = f.terminal.toString().toUpperCase();
        if (!term.startsWith("T")) term = "T" + term;

        html += `<tr>
            <td style="color: #ff8c00; font-weight: bold;">${f.time}</td>
            <td><b>${f.flight.substring(0, 7)}</b></td>
            <td style="text-align:center;">${term}</td>
            <td>${f.airline.split('(')[0].trim()}</td>
            <td>${city}</td>
            <td class="${statusClass}">${statusText}</td>
        </tr>`;
    });

    while (html.split('<tr>').length - 1 < 7) {
        html += `<tr style="border:none;"><td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td></tr>`;
    }
    tableBody.innerHTML = html;
}

// Navigation and Sync remain same...
function blinkButton(id) {
    const btn = document.getElementById(id);
    btn.classList.remove('limit-reached');
    void btn.offsetWidth; 
    btn.classList.add('limit-reached');
}

document.addEventListener('keydown', (e) => {
    const id = document.activeElement.id;
    if (!navMap[id]) return;
    if (e.key.startsWith("Arrow")) {
        e.preventDefault();
        const dir = e.key.replace("Arrow", "").toLowerCase();
        const targetId = navMap[id][dir];
        if (targetId) document.getElementById(targetId).focus();
        return;
    }
    if (e.key === "Enter" || e.keyCode === 13) {
        e.preventDefault();
        const totalPages = Math.ceil(flightData.length / rowsPerPage);
        if (id === "nextBtn") {
            if (currentPage < (totalPages - 1)) { currentPage++; renderPage(); } 
            else { blinkButton("nextBtn"); }
        } 
        else if (id === "prevBtn") {
            if (currentPage > 0) { currentPage--; renderPage(); } 
            else { blinkButton("prevBtn"); }
        } 
        else if (id === "depBtn" || id === "arrBtn") {
            currentMode = (id === "depBtn") ? 'departures' : 'arrivals';
            document.getElementById('depBtn').classList.toggle('active', id === "depBtn");
            document.getElementById('arrBtn').classList.toggle('active', id === "arrBtn");
            loadTableData(true);
        } 
        else if (id === "refreshBtn") { triggerFullSync(); }
    }
});

async function triggerFullSync() {
    const overlay = document.getElementById('videoOverlay');
    const video = document.getElementById('syncVideo');
    video.currentTime = 0;
    video.play().then(() => {
        overlay.style.display = 'flex';
        overlay.style.visibility = 'visible';
    }).catch(() => {
        overlay.style.display = 'flex';
        overlay.style.visibility = 'visible';
    });

    try {
        await fetch('update_cache.php');
        await loadTableData(true);
    } catch (e) {}

    setTimeout(() => {
        overlay.style.display = 'none';
        overlay.style.visibility = 'hidden';
        video.pause();
        document.getElementById('refreshBtn').focus();
    }, 4000); 
}

window.onload = () => {
    loadFlightTranslations(); 
    loadTableData();
    const video = document.getElementById('syncVideo');
    video.load();
    setTimeout(() => {
        const nextBtn = document.getElementById('nextBtn');
        if(nextBtn) nextBtn.focus();
    }, 800);
};