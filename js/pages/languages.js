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

        fetch('admin/languages.json?t=' + Date.now())
            .then(res => res.json())
            .then(data => {
                const langs = data.available_languages || [];
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
                    if (index > 0) btn.setAttribute('data-nav-up', 'lang_' + (index - 1));
                    if (index < langs.length - 1) btn.setAttribute('data-nav-down', 'lang_' + (index + 1));
                    else btn.setAttribute('data-nav-down', 'applyBtn'); // Last item goes to Apply
                    
                    btn.addEventListener('focus', function() {
                        document.querySelectorAll('.lang-item').forEach(b => b.classList.remove('active-focus'));
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
                    
                    container.appendChild(btn);
                });

                // Auto-focus the first language item after rendering
                var firstLang = container.querySelector('.lang-item');
                if (firstLang) {
                    if (window.TVNavigation && typeof window.TVNavigation.markDirty === 'function') {
                        window.TVNavigation.markDirty();
                    }
                    firstLang.focus();
                    firstLang.classList.add('active-focus');
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
                            // Sync with Android Bridge if exists
                            if (window.AndroidBridge && typeof window.AndroidBridge.setLanguage === 'function') {
                                window.AndroidBridge.setLanguage(file);
                            }
                            window.location.href = 'index.html';
                        }
                    });
                }
            })
            .catch(e => console.error("Error loading languages.json:", e));
    }
});
