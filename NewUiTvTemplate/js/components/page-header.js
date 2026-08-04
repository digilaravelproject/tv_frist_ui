/**
 * Shared TV Page Header Component — DRY Reusable
 * Injects: ← BACK button + Hotel Logo (from data.json) + Live Clock
 * Usage: Add <div id="page-header"></div> to any page and include this script
 */
(function () {
    'use strict';

    /* ── Render HTML into #page-header ──────────────────────────── */
    function renderHeader() {
        const container = document.getElementById('page-header');
        if (!container) return;

        container.innerHTML = `
            <header class="tv-page-header">
                <div class="tph-left">
                    <button class="tph-back-btn focusable" id="btn-back" tabindex="0"
                        onclick="window.history.back()">
                        <span class="tph-back-arrow">←</span>
                        <span class="tph-back-label">BACK</span>
                    </button>
                </div>
                <div class="tph-center">
                    <img id="hotel-logo-img" src="" alt="Hotel Logo" class="tph-logo" style="display:none;">
                </div>
                <div class="tph-right">
                    <div class="tph-clock-badge">
                        <span class="tph-pulse-dot"></span>
                        <span id="live-clock" class="tph-clock-text">--:-- --</span>
                    </div>
                </div>
            </header>
        `;
    }

    /* ── Live Clock ──────────────────────────────────────────────── */
    function startClock() {
        function tick() {
            try {
                const el = document.getElementById('live-clock');
                if (!el) return;
                const now  = new Date();
                const h    = now.getHours() % 12 || 12;
                const m    = String(now.getMinutes()).padStart(2, '0');
                const s    = String(now.getSeconds()).padStart(2, '0');
                const ampm = now.getHours() >= 12 ? 'PM' : 'AM';
                const day  = now.toLocaleDateString('en-US', {
                    weekday: 'short', month: 'short', day: 'numeric'
                });
                el.textContent = `${h}:${m}:${s} ${ampm} | ${day}`;
            } catch (e) { }
        }
        tick();
        setInterval(tick, 1000);
    }

    /* ── Load Logo from data.json via APIService ─────────────────── */
    function loadLogo() {
        try {
            const isSubpage = window.location.pathname.includes('/pages/');
            const basePath  = isSubpage ? '../' : './';

            const bindLogo = (d) => {
                try {
                    const logoImg = document.getElementById('hotel-logo-img');
                    if (!logoImg) return;
                    const logoUrl = d && d.hotel && d.hotel.media && d.hotel.media.logo_image
                        ? d.hotel.media.logo_image : '';
                    if (logoUrl) {
                        if (window.APIService && typeof window.APIService.bindImageWithCache === 'function') {
                            window.APIService.bindImageWithCache(logoImg, logoUrl, basePath + 'images/logo.png');
                        } else {
                            logoImg.src = logoUrl;
                            logoImg.style.display = 'block';
                            logoImg.onerror = () => { logoImg.style.display = 'none'; };
                        }
                    }
                } catch (e) { }
            };

            // Try APIService first, fallback to direct fetch
            if (window.APIService && typeof window.APIService.fetchData === 'function') {
                window.APIService.fetchData(bindLogo);
            } else {
                fetch(basePath + 'data.json')
                    .then(r => r.json())
                    .then(json => { if (json && json.data) bindLogo(json.data); })
                    .catch(() => { });
            }
        } catch (e) { }
    }

    /* ── Init ─────────────────────────────────────────────────────── */
    function init() {
        renderHeader();
        startClock();
        // Defer logo load until api.js is ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', loadLogo);
        } else {
            // Small delay to allow api.js to register APIService
            setTimeout(loadLogo, 100);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
