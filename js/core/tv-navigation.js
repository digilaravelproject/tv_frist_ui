/**
 * Smart TV Spatial Navigation Engine & Key Handling (Refactored & Modularized)
 * 
 * Handles ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Enter/OK, Back/Return, and Numeric inputs.
 * Fully compatible with standard browsers, Android TV, Tizen, webOS, and external keyboards.
 */
(function() {
    'use strict';

    // Focusable selector for actionable elements
    var FOCUSABLE_SELECTOR = 'button, a, input, select, textarea, [tabindex="0"], .lang-item, .icon-item, .num-btn, .list-item, .package-item, .key-btn, .side-btn, .btn-act, .hdmi-list-row, .model-name-text, .test-btn-inline';

    /**
     * 1. KeycodeManager: Encapsulates remote control and keyboard mappings
     */
    var KeycodeManager = {
        Keys: {
            UP: [38, 19, 29460, 65362],
            DOWN: [40, 20, 29461, 65364],
            LEFT: [37, 21, 29462, 65361],
            RIGHT: [39, 22, 29463, 65363],
            ENTER: [13, 23, 66, 29443, 160, 108],
            BACK: [8, 461, 4, 10009, 10182, 27, 220]
        },

        matchesKey: function(keyCode, keyName, eventKey) {
            var list = this.Keys[keyName] || [];
            if (list.indexOf(keyCode) !== -1) return true;
            if (eventKey) {
                var ek = eventKey.toLowerCase();
                if (keyName === 'UP' && (ek === 'arrowup' || ek === 'up')) return true;
                if (keyName === 'DOWN' && (ek === 'arrowdown' || ek === 'down')) return true;
                if (keyName === 'LEFT' && (ek === 'arrowleft' || ek === 'left')) return true;
                if (keyName === 'RIGHT' && (ek === 'arrowright' || ek === 'right')) return true;
                if (keyName === 'ENTER' && (ek === 'enter' || ek === 'ok' || ek === 'select' || ek === 'accept')) return true;
                if (keyName === 'BACK' && (ek === 'backspace' || ek === 'escape' || ek === 'back' || ek === 'browserback' || ek === 'goback' || ek === 'xf86back')) return true;
            }
            return false;
        },

        getDigit: function(keyCode, eventKey) {
            // Guard: prevent standard control keys on keyboard from conflicting with native Android TV keycodes
            if (eventKey === 'Tab' || eventKey === 'Backspace' || eventKey === 'Enter') return null;

            if (keyCode >= 48 && keyCode <= 57) return String(keyCode - 48);
            if (keyCode >= 96 && keyCode <= 105) return String(keyCode - 96);
            if (keyCode >= 7 && keyCode <= 16) return String(keyCode - 7);
            if (eventKey && /^\d$/.test(eventKey)) return eventKey;
            return null;
        }
    };

    /**
     * 2. CacheManager: Manages cache of focusable elements and bounding rects
     */
    var CacheManager = {
        cache: { dirty: true, elements: [], rects: [] },

        markDirty: function() {
            this.cache.dirty = true;
        },

        init: function() {
            var self = this;
            var markDirtyBound = self.markDirty.bind(self);
            
            window.addEventListener('scroll', markDirtyBound, { passive: true });
            window.addEventListener('resize', markDirtyBound, { passive: true });
            
            if (typeof MutationObserver !== 'undefined') {
                var obs = new MutationObserver(function(mutations) {
                    for (var i = 0; i < mutations.length; i++) {
                        var m = mutations[i];
                        if (m.type === 'childList') {
                            self.markDirty();
                            break;
                        }
                        // Focus toggles change 'class' attribute. Ignore to prevent layout thrashing
                        if (m.type === 'attributes' && m.attributeName !== 'class') {
                            self.markDirty();
                            break;
                        }
                    }
                });
                obs.observe(document.documentElement, {
                    childList: true,
                    subtree: true,
                    attributes: true,
                    attributeFilter: ['style', 'disabled', 'tabindex', 'hidden']
                });
            }
        },

        isVisible: function(el) {
            var style = window.getComputedStyle(el);
            if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
            
            var parentOverlay = el.closest('.overlay-fullscreen, .overlay-container, #appsOverlay');
            if (parentOverlay) {
                var os = window.getComputedStyle(parentOverlay);
                if (os.display === 'none' || os.visibility === 'hidden') return false;
            }
            
            var rect = el.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0;
        },

        getFocusableElements: function() {
            if (!this.cache.dirty) return this.cache.elements;
            
            var elements = document.querySelectorAll(FOCUSABLE_SELECTOR);
            var focusables = [];
            var rects = [];
            
            for (var i = 0; i < elements.length; i++) {
                var el = elements[i];
                if (el.disabled || el.tabIndex === -1) continue;
                if (!this.isVisible(el)) continue;
                focusables.push(el);
                rects.push(el.getBoundingClientRect());
            }
            
            this.cache.elements = focusables;
            this.cache.rects = rects;
            this.cache.dirty = false;
            return focusables;
        },

        getRects: function() {
            if (this.cache.dirty) {
                this.getFocusableElements();
            }
            return this.cache.rects;
        }
    };

    /**
     * 3. FocusEngine: Bounding calculations & spatial movement operations
     */
    var FocusEngine = {
        getCenter: function(rect) {
            return {
                x: rect.left + rect.width / 2,
                y: rect.top + rect.height / 2
            };
        },

        goBack: function() {
            // Iframe prevention: notify parent page to close the subframe overlay instead of nesting
            if (window.parent && window.parent !== window && typeof window.parent.closeSubPage === 'function') {
                window.parent.closeSubPage();
                return;
            }

            var isIndex = window.location.pathname.indexOf('index.html') !== -1 || window.location.pathname.split('/').pop() === '';
            if (!isIndex) {
                var isSubfolder = window.location.pathname.indexOf('/travel/') !== -1 || 
                                    window.location.pathname.indexOf('/amenities/') !== -1 || 
                                    window.location.pathname.indexOf('/city/') !== -1 || 
                                    window.location.pathname.indexOf('/hotel_info/') !== -1 || 
                                    window.location.pathname.indexOf('/weather/') !== -1 || 
                                    window.location.pathname.indexOf('/flights/') !== -1;
                if (isSubfolder) {
                    window.location.href = "../index.html";
                } else {
                    window.location.href = "index.html";
                }
            }
        },

        navigate: function(direction) {
            var active = document.activeElement;
            var focusables = CacheManager.getFocusableElements();
            if (!focusables.length) return;

            // Default focus if nothing is focused
            if (!active || active === document.body || focusables.indexOf(active) === -1) {
                var isIndex = window.location.pathname.indexOf('index.html') !== -1 || window.location.pathname.split('/').pop() === '';
                if (isIndex) {
                    var allIcons = document.querySelectorAll('.icon-item');
                    if (allIcons.length > 3) {
                        allIcons[3].focus();
                        return;
                    }
                }
                focusables[0].focus();
                return;
            }

            // D-pad override attribute mapping
            var overrideId = active.getAttribute('data-nav-' + direction);
            if (overrideId) {
                var overrideTarget = document.getElementById(overrideId);
                if (overrideTarget) {
                    overrideTarget.focus();
                    return;
                }
            }

            // Custom navigate override
            if (typeof window.onTVNavigate === 'function') {
                if (window.onTVNavigate(direction, active)) {
                    return;
                }
            }

            var activeRect = active.getBoundingClientRect();
            var activeCenter = this.getCenter(activeRect);
            var rects = CacheManager.getRects();

            var bestCandidate = null;
            var minDistance = Infinity;

            for (var i = 0; i < focusables.length; i++) {
                var candidate = focusables[i];
                if (candidate === active) continue;

                var rect = rects[i];
                var center = this.getCenter(rect);

                var dStraight = 0;
                var dOrthogonal = 0;
                var isValid = false;

                switch (direction) {
                    case 'left':
                        isValid = center.x < activeCenter.x;
                        dStraight = activeCenter.x - center.x;
                        dOrthogonal = Math.abs(activeCenter.y - center.y);
                        break;
                    case 'right':
                        isValid = center.x > activeCenter.x;
                        dStraight = center.x - activeCenter.x;
                        dOrthogonal = Math.abs(activeCenter.y - center.y);
                        break;
                    case 'up':
                        isValid = center.y < activeCenter.y;
                        dStraight = activeCenter.y - center.y;
                        dOrthogonal = Math.abs(activeCenter.x - center.x);
                        break;
                    case 'down':
                        isValid = center.y > activeCenter.y;
                        dStraight = center.y - activeCenter.y;
                        dOrthogonal = Math.abs(activeCenter.x - center.x);
                        break;
                }

                if (isValid) {
                    // Straight movement weighted higher than orthogonal dev
                    var distance = dStraight + (dOrthogonal * 3);
                    if (distance < minDistance) {
                        minDistance = distance;
                        bestCandidate = candidate;
                    }
                }
            }

            if (bestCandidate) {
                bestCandidate.focus();
                
                var prevActive = document.querySelector('.active-focus');
                if (prevActive) prevActive.classList.remove('active-focus');
                bestCandidate.classList.add('active-focus');
                
                bestCandidate.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
            }
        },

        handleInitialFocus: function() {
            var focusables = CacheManager.getFocusableElements();
            if (focusables.length && (document.activeElement === document.body || !document.activeElement)) {
                var isIndex = window.location.pathname.indexOf('index.html') !== -1 || window.location.pathname.split('/').pop() === '';
                if (isIndex) {
                    var allIcons = document.querySelectorAll('.icon-item');
                    if (allIcons.length > 3) {
                        allIcons[3].focus();
                    } else if (allIcons.length > 0) {
                        allIcons[0].focus();
                    }
                } else {
                    focusables[0].focus();
                }
            }
        }
    };

    /**
     * 4. NavigationController: Handlers, event throttle and event listeners
     */
    var NavigationController = {
        lastDirectionTime: 0,

        init: function() {
            var self = this;
            
            // Central event key listeners
            window.addEventListener('keydown', function(e) {
                var active = document.activeElement;
                var expiredOverlay = document.getElementById('planExpiredOverlay');
                if (expiredOverlay && expiredOverlay.style.display === 'flex') {
                    e.preventDefault();
                    return;
                }
                
                if (typeof window.onTVKeyDown === 'function') {
                    if (window.onTVKeyDown(e)) return;
                }

                var isIndex = window.location.pathname.indexOf('index.html') !== -1 || window.location.pathname.split('/').pop() === '';
                var keyCode = e.keyCode || e.which;

                // Back Action
                if (KeycodeManager.matchesKey(keyCode, 'BACK', e.key)) {
                    var handled = false;
                    if (typeof window.onTVBack === 'function') {
                        if (window.onTVBack()) {
                            handled = true;
                        }
                    }
                    if (!handled && !isIndex) {
                        FocusEngine.goBack();
                        handled = true;
                    }
                    if (handled) {
                        e.preventDefault();
                        
                        // Visual feedback: highlight the DEL button if present (e.g. settings numpad)
                        var delBtn = document.querySelector('.num-btn[data-val="DEL"]');
                        if (delBtn) {
                            delBtn.focus();
                        }
                    }
                    return;
                }

                var direction = null;
                if (KeycodeManager.matchesKey(keyCode, 'LEFT', e.key)) direction = 'left';
                else if (KeycodeManager.matchesKey(keyCode, 'RIGHT', e.key)) direction = 'right';
                else if (KeycodeManager.matchesKey(keyCode, 'UP', e.key)) direction = 'up';
                else if (KeycodeManager.matchesKey(keyCode, 'DOWN', e.key)) direction = 'down';
                else if (KeycodeManager.matchesKey(keyCode, 'ENTER', e.key)) direction = 'enter';

                if (direction) {
                    // Accidental repeat/double-click throttle
                    if (direction !== 'enter') {
                        var nowDir = Date.now();
                        if (nowDir - self.lastDirectionTime < 120) {
                            e.preventDefault();
                            return;
                        }
                        self.lastDirectionTime = nowDir;
                    }

                    if (direction === 'enter') {
                        if (active && active !== document.body) {
                            e.preventDefault();
                            var now = Date.now();
                            var last = parseInt(active.getAttribute('data-last-click') || '0', 10);
                            if (now - last > 300) {
                                active.setAttribute('data-last-click', now.toString());
                                active.click();
                            }
                        }
                    } else {
                        if (typeof window.onTVNavigate === 'function') {
                            if (window.onTVNavigate(direction, active)) {
                                return;
                            }
                        }
                        if (isIndex && !window.__appsOverlayOpen && (direction === 'left' || direction === 'right')) {
                            return;
                        }
                        e.preventDefault();
                        FocusEngine.navigate(direction);
                    }
                }

                // Number Inputs
                var digit = KeycodeManager.getDigit(keyCode, e.key);
                if (digit !== null) {
                    // Visual feedback: find the corresponding number button and focus/highlight it
                    var btn = document.querySelector('.num-btn[data-val="' + digit + '"]');
                    if (btn) {
                        btn.focus();
                    }

                    if (typeof window.onTVNumberKey === 'function') {
                        window.onTVNumberKey(digit);
                    }
                }
            });

            // Focus and Blur active style class synchronization
            document.addEventListener('focus', function(e) {
                var focusables = document.querySelectorAll('.active-focus');
                for (var i = 0; i < focusables.length; i++) {
                    focusables[i].classList.remove('active-focus');
                }
                e.target.classList.add('active-focus');
            }, true);

            document.addEventListener('blur', function(e) {
                e.target.classList.remove('active-focus');
            }, true);

            // Sync mouse hover with TV focus
            document.addEventListener('mouseover', function(e) {
                var el = e.target.closest(FOCUSABLE_SELECTOR);
                if (el && document.activeElement !== el) {
                    el.focus();
                }
            });

            // Auto-focus triggers
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', function() {
                    setTimeout(FocusEngine.handleInitialFocus, 150);
                });
            } else {
                setTimeout(FocusEngine.handleInitialFocus, 150);
            }
        }
    };

    // Initialize systems
    try {
        if (window.tizen && window.tizen.tvinputdevice && window.tizen.tvinputdevice.registerKey) {
            window.tizen.tvinputdevice.registerKey("Return");
        }
    } catch(e) {
        console.warn("Failed to register Tizen Return key:", e);
    }
    CacheManager.init();
    NavigationController.init();

    // Expose standard API for backward compatibility
    window.TVNavigation = {
        getFocusableElements: CacheManager.getFocusableElements.bind(CacheManager),
        getRects: CacheManager.getRects.bind(CacheManager),
        getCenter: FocusEngine.getCenter.bind(FocusEngine),
        goBack: FocusEngine.goBack.bind(FocusEngine),
        navigate: FocusEngine.navigate.bind(FocusEngine),
        handleInitialFocus: FocusEngine.handleInitialFocus.bind(FocusEngine)
    };
})();
