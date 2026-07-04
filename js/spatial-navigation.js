/**
 * Smart TV Spatial Navigation Engine
 * 
 * Handles ArrowUp, ArrowDown, ArrowLeft, ArrowRight, and Enter/OK events 
 * to navigate between actionable HTML elements (buttons, links, inputs, cards).
 * Fully compatible with standard browsers and Android TV WebView keycodes.
 */
(function() {
    'use strict';

    // Focusable selector for actionable elements
    const FOCUSABLE_SELECTOR = 'button, a, input, select, textarea, [tabindex="0"], .lang-item, .icon-item, .num-btn';

    function getFocusableElements() {
        return Array.from(document.querySelectorAll(FOCUSABLE_SELECTOR)).filter(el => {
            if (el.disabled || el.tabIndex === -1) return false;
            
            // Check visibility
            const rect = el.getBoundingClientRect();
            const style = window.getComputedStyle(el);
            return rect.width > 0 && 
                   rect.height > 0 && 
                   style.display !== 'none' && 
                   style.visibility !== 'hidden' &&
                   style.opacity !== '0';
        });
    }

    function getCenter(rect) {
        return {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2
        };
    }

    function navigate(direction) {
        const active = document.activeElement;
        const focusables = getFocusableElements();
        
        if (!focusables.length) return;

        // If nothing is focused, default focus to the first available element
        if (!active || active === document.body || !focusables.includes(active)) {
            const isIndex = window.location.pathname.endsWith('index.html') || window.location.pathname.split('/').pop() === '';
            if (isIndex) {
                const allIcons = document.querySelectorAll('.icon-item');
                if (allIcons.length > 3) {
                    allIcons[3].focus();
                    return;
                }
            }
            focusables[0].focus();
            return;
        }

        const activeRect = active.getBoundingClientRect();
        const activeCenter = getCenter(activeRect);

        let bestCandidate = null;
        let minDistance = Infinity;

        focusables.forEach(candidate => {
            if (candidate === active) return;

            const rect = candidate.getBoundingClientRect();
            const center = getCenter(rect);

            let dStraight = 0;
            let dOrthogonal = 0;
            let isValid = false;

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
                const distance = dStraight + (dOrthogonal * 3);
                if (distance < minDistance) {
                    minDistance = distance;
                    bestCandidate = candidate;
                }
            }
        });

        if (bestCandidate) {
            bestCandidate.focus();
            bestCandidate.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
        }
    }

    // Global Key Down Listener (Supports both standard browser keys and Android TV keycodes)
    window.addEventListener('keydown', function(e) {
        const isIndex = window.location.pathname.endsWith('index.html') || window.location.pathname.split('/').pop() === '';
        const keyCode = e.keyCode || e.which;
        
        let direction = null;

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
                const active = document.activeElement;
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
        const focusables = getFocusableElements();
        if (focusables.length && (document.activeElement === document.body || !document.activeElement)) {
            const isIndex = window.location.pathname.endsWith('index.html') || window.location.pathname.split('/').pop() === '';
            if (isIndex) {
                const allIcons = document.querySelectorAll('.icon-item');
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
        document.addEventListener('DOMContentLoaded', () => setTimeout(handleInitialFocus, 150));
    } else {
        setTimeout(handleInitialFocus, 150);
    }
})();
