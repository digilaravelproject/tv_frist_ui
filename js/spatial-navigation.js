/**
 * Smart TV Spatial Navigation Engine
 * 
 * Handles ArrowUp, ArrowDown, ArrowLeft, ArrowRight, and Enter/OK events 
 * to navigate between actionable HTML elements (buttons, links, inputs, cards).
 * Fully compatible with standard browsers, Android TV, Tizen, and webOS keycodes.
 * Built using ES5 syntax for older TV rendering engines.
 */
(function() {
    'use strict';

    // Focusable selector for actionable elements
    var FOCUSABLE_SELECTOR = 'button, a, input, select, textarea, [tabindex="0"], .lang-item, .icon-item, .num-btn';

    function getFocusableElements() {
        var elements = document.querySelectorAll(FOCUSABLE_SELECTOR);
        var focusables = [];
        
        for (var i = 0; i < elements.length; i++) {
            var el = elements[i];
            if (el.disabled || el.tabIndex === -1) continue;
            
            // Check visibility
            var rect = el.getBoundingClientRect();
            var style = window.getComputedStyle(el);
            var isVisible = rect.width > 0 && 
                            rect.height > 0 && 
                            style.display !== 'none' && 
                            style.visibility !== 'hidden' &&
                            style.opacity !== '0';
            
            if (isVisible) {
                focusables.push(el);
            }
        }
        return focusables;
    }

    function getCenter(rect) {
        return {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2
        };
    }

    function navigate(direction) {
        var active = document.activeElement;
        var focusables = getFocusableElements();
        
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

        var activeRect = active.getBoundingClientRect();
        var activeCenter = getCenter(activeRect);

        var bestCandidate = null;
        var minDistance = Infinity;

        for (var i = 0; i < focusables.length; i++) {
            var candidate = focusables[i];
            if (candidate === active) continue;

            var rect = candidate.getBoundingClientRect();
            var center = getCenter(rect);

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
            bestCandidate.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
        }
    }

    // Global Key Down Listener (Supports standard browsers, Android TV, Tizen, and webOS)
    window.addEventListener('keydown', function(e) {
        if (window.__appsOverlayOpen) return;

        var isIndex = window.location.pathname.indexOf('index.html') !== -1 || window.location.pathname.split('/').pop() === '';
        var keyCode = e.keyCode || e.which;
        
        // Global Back Navigation Handler (4 = Android back, 8 = Backspace, 461 = webOS back, 10009 = Tizen back, 10182 = Tizen exit)
        if (keyCode === 8 || keyCode === 461 || keyCode === 4 || keyCode === 10009 || keyCode === 10182 || e.key === 'Backspace' || e.key === 'Escape') {
            if (!isIndex) {
                e.preventDefault();
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
                return;
            }
        }
        
        var direction = null;

        // Map D-pad and arrow key events
        if (keyCode === 37 || keyCode === 21 || e.key === 'ArrowLeft' || e.key === 'Left') {
            direction = 'left';
        } else if (keyCode === 39 || keyCode === 22 || e.key === 'ArrowRight' || e.key === 'Right') {
            direction = 'right';
        } else if (keyCode === 38 || keyCode === 19 || e.key === 'ArrowUp' || e.key === 'Up') {
            direction = 'up';
        } else if (keyCode === 40 || keyCode === 20 || e.key === 'ArrowDown' || e.key === 'Down') {
            direction = 'down';
        } else if (keyCode === 13 || keyCode === 23 || keyCode === 66 || e.key === 'Enter') {
            direction = 'enter';
        }

        if (direction) {
            if (direction === 'enter') {
                var active = document.activeElement;
                if (active && active !== document.body) {
                    e.preventDefault();
                    active.click();
                }
            } else {
                // On index page, the horizontal carousel handles ArrowLeft/Right itself.
                if (isIndex && (direction === 'left' || direction === 'right')) {
                    return; // Let home.js handle horizontal movement
                }
                e.preventDefault();
                navigate(direction);
            }
        }
    });

    // Auto-focus logic when the DOM is ready
    function handleInitialFocus() {
        var focusables = getFocusableElements();
        if (focusables.length && (document.activeElement === document.body || !document.activeElement)) {
            var isIndex = window.location.pathname.indexOf('index.html') !== -1 || window.location.pathname.split('/').pop() === '';
            if (isIndex) {
                var allIcons = document.querySelectorAll('.icon-item');
                // Center item in a 7-slot view is index 3
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

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            setTimeout(handleInitialFocus, 150);
        });
    } else {
        setTimeout(handleInitialFocus, 150);
    }
})();
