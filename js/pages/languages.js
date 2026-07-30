/**
 * Languages Page Logic
 */
document.addEventListener('DOMContentLoaded', function() {
    let configObj = null;

    // Fetch config and init slider
    TVCore.fetchHotelConfig().then(config => {
        if (!TVCore.checkPlanExpiredRedirect(config)) {
            configObj = config;
            TVCore.initBackgroundSlider(config);
            populateLanguages();
        }
    });

    function populateLanguages() {
        const container = document.getElementById('langList');
        if (!container) return;
        container.innerHTML = '';
        const currentLang = localStorage.getItem('selectedLangFile') || 'english.json';

        // Fallback languages data if local file fetch is blocked
        const fallbackLangs = [
            { "name": "English", "file": "english.json" },
            { "name": "हिंदी", "file": "hindi.json" },
            { "name": "मराठी", "file": "marathi.json" },
            { "name": "ગુજરાતી", "file": "gujrati.json" },
            { "name": "বাংলা", "file": "bengali.json" },
            { "name": "ਪੰਜਾਬੀ", "file": "punjabi.json" },
            { "name": "ಕನ್ನಡ", "file": "kannada.json" },
            { "name": "தமிழ்", "file": "tamil.json" },
            { "name": "తెలుగు", "file": "telugu.json" },
            { "name": "മലയാളം", "file": "malayalam.json" }
        ];

        function renderList(langs) {
            container.innerHTML = '';
            langs.forEach((lang, index) => {
                const btn = document.createElement('div');
                btn.className = 'lang-item' + (lang.file === currentLang ? ' selected' : '');
                btn.tabIndex = 0;
                btn.dataset.file = lang.file;
                btn.dataset.id = 'lang_' + index;
                btn.id = 'lang_' + index;
                btn.innerHTML = `
                    <span>${lang.name}</span>
                    <span class="tick">✔</span>
                `;
                
                // Grid navigation mapping (vertically stacked)
                if (index > 0) {
                    btn.setAttribute('data-nav-up', 'lang_' + (index - 1));
                }
                if (index < langs.length - 1) {
                    btn.setAttribute('data-nav-down', 'lang_' + (index + 1));
                } else {
                    btn.setAttribute('data-nav-down', 'applyBtn'); // Last item goes to Apply
                }
                
                btn.addEventListener('focus', function() {
                    document.querySelectorAll('.lang-item, .btn').forEach(b => b.classList.remove('active-focus'));
                    this.classList.add('active-focus');
                });
                btn.addEventListener('blur', function() {
                    this.classList.remove('active-focus');
                });
                btn.addEventListener('click', function(e) {
                    e.preventDefault();
                    document.querySelectorAll('.lang-item').forEach(el => el.classList.remove('selected'));
                    this.classList.add('selected');
                });
                btn.addEventListener('keydown', function(e) {
                    if (e.key === 'Enter' || e.keyCode === 13) {
                        this.click();
                    }
                });
                
                container.appendChild(btn);
            });

            // Auto-focus the selected or first language item after rendering
            if (window.TVNavigation && typeof window.TVNavigation.markDirty === 'function') {
                window.TVNavigation.markDirty();
            }
            var targetLang = container.querySelector('.lang-item.selected') || container.querySelector('.lang-item');
            if (targetLang) {
                targetLang.focus();
                targetLang.classList.add('active-focus');
            }

            // Set up focus wrapping for action buttons
            const applyBtn = document.getElementById('applyBtn');
            const cancelBtn = document.getElementById('cancelBtn');
            
            if (applyBtn && cancelBtn) {
                applyBtn.setAttribute('data-nav-right', 'cancelBtn');
                applyBtn.setAttribute('data-nav-up', 'lang_' + (langs.length - 1));
                
                cancelBtn.setAttribute('data-nav-left', 'applyBtn');
                cancelBtn.setAttribute('data-nav-up', 'lang_' + (langs.length - 1));
                
                cancelBtn.addEventListener('click', function(e) {
                    e.preventDefault();
                    TVNavigation.goBack();
                });

                applyBtn.addEventListener('click', function(e) {
                    e.preventDefault();
                    const selected = document.querySelector('.lang-item.selected');
                    if (selected) {
                        const file = selected.dataset.file;
                        localStorage.setItem('selectedLangFile', file);

                        if (window.flutterBridge && typeof window.flutterBridge.setLanguage === 'function') {
                            window.flutterBridge.setLanguage(file).then(function() {
                                window.location.href = 'index.html';
                            }).catch(function() {
                                window.location.href = 'index.html';
                            });
                            return;
                        }

                        // Sync with Android Bridge if exists
                        if (window.AndroidBridge && typeof window.AndroidBridge.setLanguage === 'function') {
                            window.AndroidBridge.setLanguage(file);
                        }
                        window.location.href = 'index.html';
                    }
                });
            }
        }

        // Try fetch with fallback safety
        fetch('admin/languages.json?t=' + Date.now())
            .then(res => res.json())
            .then(data => {
                const langs = (data && data.available_languages && data.available_languages.length > 0) 
                    ? data.available_languages 
                    : fallbackLangs;
                renderList(langs);
            })
            .catch(e => {
                console.error("Error loading languages.json, using fallback:", e);
                renderList(fallbackLangs);
            });
    }
});
