/**
 * Redesigned Luxury Languages Page Logic (Grid Navigation & Dynamic Offline Fallback)
 */
document.addEventListener('DOMContentLoaded', function () {
    let configObj = null;

    // 1. Immediately render languages grid so UI loads instantly without network lag
    populateLanguages();

    // 2. Fetch config and init slider in background
    if (window.TVCore && typeof window.TVCore.fetchHotelConfig === 'function') {
        window.TVCore.fetchHotelConfig().then(config => {
            if (!TVCore.checkPlanExpiredRedirect(config)) {
                configObj = config;
                TVCore.initBackgroundSlider(config);
            }
        }).catch(e => console.warn("Hotel config background load:", e));
    }

    function populateLanguages() {
        const container = document.getElementById('langList');
        if (!container) return;
        container.innerHTML = '';
        const currentLang = localStorage.getItem('selectedLangFile') || 'english.json';

        // Complete 21 Language Fallback Array for 100% Offline Capability
        const fallbackLangs = [
            { "name": "English", "file": "english.json", "code": "EN" },
            { "name": "हिंदी", "file": "hindi.json", "code": "HI" },
            { "name": "मराठी", "file": "marathi.json", "code": "MR" },
            { "name": "कोंकणी", "file": "konkani.json", "code": "GOM" },
            { "name": "ગુજરાતી", "file": "gujrati.json", "code": "GU" },
            { "name": "বাংলা", "file": "bengali.json", "code": "BN" },
            { "name": "ਪੰਜਾਬੀ", "file": "punjabi.json", "code": "PA" },
            { "name": "অসমীয়া", "file": "assamese.json", "code": "AS" },
            { "name": "ಕನ್ನಡ", "file": "kannada.json", "code": "KN" },
            { "name": "தமிழ்", "file": "tamil.json", "code": "TA" },
            { "name": "తెలుగు", "file": "telugu.json", "code": "TE" },
            { "name": "മലയാളം", "file": "malayalam.json", "code": "ML" },
            { "name": "Français", "file": "french.json", "code": "FR" },
            { "name": "Deutsch", "file": "german.json", "code": "DE" },
            { "name": "Español", "file": "spanish.json", "code": "ES" },
            { "name": "Português", "file": "portuguese.json", "code": "PT" },
            { "name": "Русский", "file": "russian.json", "code": "RU" },
            { "name": "简体中文", "file": "chinese.json", "code": "ZH" },
            { "name": "עִברִית", "file": "hebrew.json", "code": "HE" },
            { "name": "اردو", "file": "urdu.json", "code": "UR" },
            { "name": "عربي", "file": "arabic.json", "code": "AR" }
        ];

        function renderGrid(langs) {
            container.innerHTML = '';
            const cols = 3;
            const total = langs.length;

            langs.forEach((lang, index) => {
                const card = document.createElement('div');
                card.className = 'lang-card-item' + (lang.file === currentLang ? ' selected' : '');
                card.tabIndex = 0;
                card.dataset.file = lang.file;
                card.id = 'lang_' + index;

                const code = lang.code || lang.file.substring(0, 2).toUpperCase();

                card.innerHTML = `
                    <div style="display:flex; align-items:center; gap:12px;">
                        <span class="lang-radio"><span class="lang-radio-dot"></span></span>
                        <span class="lang-name-native">${lang.name}</span>
                    </div>
                    <span class="lang-badge">${code}</span>
                `;

                // Calculate D-Pad 2D Grid Mapping (Up, Down, Left, Right)
                const row = Math.floor(index / cols);
                const col = index % cols;

                // Left navigation
                if (col > 0) {
                    card.setAttribute('data-nav-left', 'lang_' + (index - 1));
                }
                // Right navigation
                if (col < cols - 1 && index + 1 < total) {
                    card.setAttribute('data-nav-right', 'lang_' + (index + 1));
                }
                // Up navigation
                if (row > 0) {
                    card.setAttribute('data-nav-up', 'lang_' + (index - cols));
                }
                // Down navigation
                if (index + cols < total) {
                    card.setAttribute('data-nav-down', 'lang_' + (index + cols));
                } else {
                    // Last row down goes to Apply button
                    card.setAttribute('data-nav-down', 'applyBtn');
                }

                // D-Pad Focus & Mouse Hover listeners
                card.addEventListener('mouseenter', function () {
                    this.focus();
                });

                card.addEventListener('focus', function () {
                    document.querySelectorAll('.lang-card-item, .btn').forEach(b => b.classList.remove('active-focus'));
                    this.classList.add('active-focus');
                    
                    // Smooth scroll container to bring item fully in view
                    const parent = container;
                    const itemTop = this.offsetTop - parent.offsetTop;
                    const itemBottom = itemTop + this.offsetHeight;
                    const parentTop = parent.scrollTop;
                    const parentBottom = parentTop + parent.clientHeight;

                    if (itemTop < parentTop) {
                        parent.scrollTo({ top: itemTop - 10, behavior: 'smooth' });
                    } else if (itemBottom > parentBottom) {
                        parent.scrollTo({ top: itemBottom - parent.clientHeight + 10, behavior: 'smooth' });
                    }
                });
                card.addEventListener('blur', function () {
                    this.classList.remove('active-focus');
                });

                // Selection click
                card.addEventListener('click', function (e) {
                    e.preventDefault();
                    document.querySelectorAll('.lang-card-item').forEach(el => el.classList.remove('selected'));
                    this.classList.add('selected');
                });

                container.appendChild(card);
            });

            // Action Buttons Navigation Mapping
            const applyBtn = document.getElementById('applyBtn');
            const cancelBtn = document.getElementById('cancelBtn');

            if (applyBtn && cancelBtn) {
                applyBtn.setAttribute('data-nav-right', 'cancelBtn');
                applyBtn.setAttribute('data-nav-up', 'lang_' + (total - 1));

                cancelBtn.setAttribute('data-nav-left', 'applyBtn');
                cancelBtn.setAttribute('data-nav-up', 'lang_' + (total - 1));

                cancelBtn.addEventListener('click', function (e) {
                    e.preventDefault();
                    if (window.TVNavigation && typeof window.TVNavigation.goBack === 'function') {
                        window.TVNavigation.goBack();
                    } else {
                        window.location.href = 'index.html';
                    }
                });

                applyBtn.addEventListener('click', function (e) {
                    e.preventDefault();
                    const selected = document.querySelector('.lang-card-item.selected');
                    if (selected) {
                        const file = selected.dataset.file;
                        localStorage.setItem('selectedLangFile', file);

                        if (window.flutterBridge && typeof window.flutterBridge.setLanguage === 'function') {
                            window.flutterBridge.setLanguage(file).then(function () {
                                window.location.href = 'index.html';
                            }).catch(function () {
                                window.location.href = 'index.html';
                            });
                            return;
                        }

                        if (window.AndroidBridge && typeof window.AndroidBridge.setLanguage === 'function') {
                            window.AndroidBridge.setLanguage(file);
                        }
                        window.location.href = 'index.html';
                    }
                });
            }

            // Register spatial navigation & focus selected item
            if (window.TVNavigation && typeof window.TVNavigation.markDirty === 'function') {
                window.TVNavigation.markDirty();
            }

            setTimeout(function () {
                var targetLang = container.querySelector('.lang-card-item.selected') || container.querySelector('.lang-card-item');
                if (targetLang) {
                    targetLang.focus();
                    targetLang.classList.add('active-focus');
                }
            }, 100);
        }

        // Try fetching online/local json with complete 21 language fallback safety
        fetch('languages/languages.json?t=' + Date.now())
            .then(res => res.json())
            .then(data => {
                const langs = (data && data.available_languages && data.available_languages.length > 0)
                    ? data.available_languages
                    : fallbackLangs;
                renderGrid(langs);
            })
            .catch(e => {
                console.warn("Using offline complete fallback languages:", e);
                renderGrid(fallbackLangs);
            });
    }
});
