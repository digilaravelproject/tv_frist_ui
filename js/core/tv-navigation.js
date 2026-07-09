/**
 * Smart TV Spatial Navigation Engine & Key Handling
 * 
 * Handles ArrowUp, ArrowDown, ArrowLeft, ArrowRight, and Enter/OK events 
 * to navigate between actionable HTML elements (buttons, links, inputs, cards).
 * Fully compatible with standard browsers, Android TV, Tizen, and webOS keycodes.
 */
(function() {
    'use strict';

    // Focusable selector for actionable elements
    var FOCUSABLE_SELECTOR = 'button, a, input, select, textarea, [tabindex="0"], .lang-item, .icon-item, .num-btn, .list-item, .package-item, .key-btn, .side-btn, .btn-act, .hdmi-list-row, .model-name-text, .test-btn-inline';

    var rectCache = { dirty: true, elements: [], rects: [] };

    function markCacheDirty() {
        rectCache.dirty = true;
    }

    // Invalidate cache on scroll, resize, or DOM changes
    window.addEventListener('scroll', markCacheDirty, { passive: true });
    window.addEventListener('resize', markCacheDirty, { passive: true });
    if (typeof MutationObserver !== 'undefined') {
        var obs = new MutationObserver(markCacheDirty);
        obs.observe(document.documentElement, { childList: true, subtree: true, attributes: true });
    }

    function isVisible(el) {
        var style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
        var parentOverlay = el.closest('.overlay-fullscreen, .overlay-container, #appsOverlay');
        if (parentOverlay) {
            var os = window.getComputedStyle(parentOverlay);
            if (os.display === 'none' || os.visibility === 'hidden') return false;
        }
        var rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
    }

    window.TVNavigation = {
        getFocusableElements: function() {
            if (!rectCache.dirty) return rectCache.elements;
            var elements = document.querySelectorAll(FOCUSABLE_SELECTOR);
            var focusables = [];
            var rects = [];
            for (var i = 0; i < elements.length; i++) {
                var el = elements[i];
                if (el.disabled || el.tabIndex === -1) continue;
                if (!isVisible(el)) continue;
                focusables.push(el);
                rects.push(el.getBoundingClientRect());
            }
            rectCache.elements = focusables;
            rectCache.rects = rects;
            rectCache.dirty = false;
            return focusables;
        },

        getRects: function() {
            if (rectCache.dirty) {
                this.getFocusableElements();
            }
            return rectCache.rects;
        },

        getCenter: function(rect) {
            return {
                x: rect.left + rect.width / 2,
                y: rect.top + rect.height / 2
            };
        },

        goBack: function() {
            // If running inside an iframe, close the subpage in the parent window instead of nesting
            if (window.parent && window.parent !== window && typeof window.parent.closeSubPage === 'function') {
                window.parent.closeSubPage();
                return;
            }
            
            // Global Back Navigation Handler
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
            var focusables = this.getFocusableElements();
            
            if (!focusables.length) return;

            // If nothing is focused, default focus to the first available element
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

            // Check for explicit grid mapping (data-nav-right, data-nav-left, etc.)
            var overrideId = active.getAttribute('data-nav-' + direction);
            if (overrideId) {
                var overrideTarget = document.getElementById(overrideId);
                if (overrideTarget) {
                    overrideTarget.focus();
                    return;
                }
            }
            
            // Check if page implements custom override function
            if (typeof window.onTVNavigate === 'function') {
                if (window.onTVNavigate(direction, active)) {
                    return; // Page handled it
                }
            }

            var activeRect = active.getBoundingClientRect();
            var activeCenter = this.getCenter(activeRect);
            var rects = this.getRects();

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
                    // Distance formula weighting straight movement over orthogonal deviation
                    var distance = dStraight + (dOrthogonal * 3);
                    if (distance < minDistance) {
                        minDistance = distance;
                        bestCandidate = candidate;
                    }
                }
            }

            if (bestCandidate) {
                bestCandidate.focus();
                
                // Add active-focus class for styled highlighting
                var prevActive = document.querySelector('.active-focus');
                if (prevActive) prevActive.classList.remove('active-focus');
                bestCandidate.classList.add('active-focus');
                
                bestCandidate.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
            }
        },
        
        handleInitialFocus: function() {
            var focusables = TVNavigation.getFocusableElements();
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

    // Centralized Universal Keycode Mapping for Smart TVs (Android TV, Tizen, webOS, Apple TV, Panasonic, standard PCs)
    var Keys = {
        UP: [38, 19, 29460, 65362],        // ArrowUp, Android TV Up, Tizen/WebOS Up
        DOWN: [40, 20, 29461, 65364],      // ArrowDown, Android TV Down, Tizen/WebOS Down
        LEFT: [37, 21, 29462, 65361],      // ArrowLeft, Android TV Left
        RIGHT: [39, 22, 29463, 65363],     // ArrowRight, Android TV Right
        ENTER: [13, 23, 66, 29443, 160],   // Enter/OK: standard Enter, Android TV DPAD_CENTER, webOS/Tizen Enter
        BACK: [8, 461, 4, 10009, 10182, 27, 220, 166] // Backspace, webOS back, Android TV back, Tizen back, Tizen exit, Escape, Roku back/bracket, browser back
    };

    function matchesKey(keyCode, keyName, eventKey) {
        var list = Keys[keyName] || [];
        if (list.indexOf(keyCode) !== -1) return true;
        if (eventKey) {
            var ek = eventKey.toLowerCase();
            if (keyName === 'UP' && (ek === 'arrowup' || ek === 'up')) return true;
            if (keyName === 'DOWN' && (ek === 'arrowdown' || ek === 'down')) return true;
            if (keyName === 'LEFT' && (ek === 'arrowleft' || ek === 'left')) return true;
            if (keyName === 'RIGHT' && (ek === 'arrowright' || ek === 'right')) return true;
            if (keyName === 'ENTER' && (ek === 'enter' || ek === 'ok')) return true;
            if (keyName === 'BACK' && (ek === 'backspace' || ek === 'escape' || ek === 'back' || ek === 'browserback')) return true;
        }
        return false;
    }

    // Global Key Down Listener
    window.addEventListener('keydown', function(e) {
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
        
        // Global Back Navigation Handler
        if (matchesKey(keyCode, 'BACK', e.key)) {
            e.preventDefault();
            
            // Allow page to handle back key specifically (e.g., closing overlays)
            if (typeof window.onTVBack === 'function') {
                if (window.onTVBack()) return;
            }
            
            if (!isIndex) {
                TVNavigation.goBack();
            }
            return;
        }
        
        var direction = null;

        // Map D-pad and arrow key events using universal keys
        if (matchesKey(keyCode, 'LEFT', e.key)) {
            direction = 'left';
        } else if (matchesKey(keyCode, 'RIGHT', e.key)) {
            direction = 'right';
        } else if (matchesKey(keyCode, 'UP', e.key)) {
            direction = 'up';
        } else if (matchesKey(keyCode, 'DOWN', e.key)) {
            direction = 'down';
        } else if (matchesKey(keyCode, 'ENTER', e.key)) {
            direction = 'enter';
        }

        if (direction) {
            if (direction === 'enter') {
                var active = document.activeElement;
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
                // If the page defines a custom navigation handler, let it handle the event.
                if (typeof window.onTVNavigate === 'function') {
                    if (window.onTVNavigate(direction, active)) {
                        return;
                    }
                }
                
                // On index page, the horizontal carousel handles ArrowLeft/Right itself, unless overlay is open.
                if (isIndex && !window.__appsOverlayOpen && (direction === 'left' || direction === 'right')) {
                    return; // Let home.js handle horizontal movement
                }
                e.preventDefault();
                TVNavigation.navigate(direction);
            }
        }
        
        // Number keys for generic usage (e.g. settings numpad)
        if (keyCode >= 48 && keyCode <= 57) {
            if (typeof window.onTVNumberKey === 'function') {
                window.onTVNumberKey(e.key || String.fromCharCode(keyCode));
            }
        }
    });



    // Global focus and blur listeners to automatically sync active-focus class
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

    // Auto-focus logic when the DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            setTimeout(TVNavigation.handleInitialFocus, 150);
        });
    } else {
        setTimeout(TVNavigation.handleInitialFocus, 150);
    }
})();
