/**
 * Smart TV 2D Spatial Remote D-Pad Navigation Engine
 * Real-time 2D Euclidean Distance Classifier for UP, DOWN, LEFT, RIGHT, ENTER, and BACK key navigation.
 * Auto-scrolls focused items into view smoothly.
 * Wrapped in strict try-catch handlers for 100% crash prevention.
 */
(function() {
    'use strict';

    let currentFocusEl = null;

    function getVisibleFocusableElements() {
        try {
            return Array.from(document.querySelectorAll('.focusable')).filter(el => {
                try {
                    const style = window.getComputedStyle(el);
                    const rect = el.getBoundingClientRect();
                    return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
                } catch (e) {
                    return false;
                }
            });
        } catch (err) {
            console.error('[TVNavigation] getVisibleFocusableElements error:', err);
            return [];
        }
    }

    function setFocus(targetEl) {
        try {
            if (!targetEl) return;

            // Remove .focused class from all elements across the entire page
            document.querySelectorAll('.focused').forEach(el => {
                try {
                    el.classList.remove('focused');
                } catch (e) {}
            });

            currentFocusEl = targetEl;
            currentFocusEl.classList.add('focused');
            
            if (document.activeElement !== currentFocusEl) {
                currentFocusEl.focus();
            }

            // Scroll focused element into view smoothly if inside scrollable container
            currentFocusEl.scrollIntoView({
                behavior: 'smooth',
                block: 'nearest',
                inline: 'nearest'
            });
        } catch (err) {
            console.error('[TVNavigation] setFocus error:', err);
        }
    }

    function getCenter(rect) {
        try {
            return {
                x: rect.left + rect.width / 2,
                y: rect.top + rect.height / 2
            };
        } catch (err) {
            return { x: 0, y: 0 };
        }
    }

    function findNextElement(direction) {
        try {
            const focusables = getVisibleFocusableElements();
            if (focusables.length === 0) return null;
            if (!currentFocusEl || !focusables.includes(currentFocusEl)) {
                return focusables[0];
            }

            const currentRect = currentFocusEl.getBoundingClientRect();
            const currentCenter = getCenter(currentRect);

            let bestCandidate = null;
            let minDistance = Infinity;

            focusables.forEach(el => {
                try {
                    if (el === currentFocusEl) return;

                    const rect = el.getBoundingClientRect();
                    const center = getCenter(rect);

                    const dx = center.x - currentCenter.x;
                    const dy = center.y - currentCenter.y;

                    let isValidDirection = false;
                    let distance = Infinity;

                    switch (direction) {
                        case 'UP':
                            if (dy < -5) {
                                isValidDirection = true;
                                distance = Math.sqrt(dx * dx * 2 + dy * dy);
                            }
                            break;
                        case 'DOWN':
                            if (dy > 5) {
                                isValidDirection = true;
                                distance = Math.sqrt(dx * dx * 2 + dy * dy);
                            }
                            break;
                        case 'LEFT':
                            if (dx < -5) {
                                isValidDirection = true;
                                distance = Math.sqrt(dx * dx + dy * dy * 2);
                            }
                            break;
                        case 'RIGHT':
                            if (dx > 5) {
                                isValidDirection = true;
                                distance = Math.sqrt(dx * dx + dy * dy * 2);
                            }
                            break;
                    }

                    if (isValidDirection && distance < minDistance) {
                        minDistance = distance;
                        bestCandidate = el;
                    }
                } catch (e) {
                    console.warn('[TVNavigation] candidate evaluation error:', e);
                }
            });

            return bestCandidate;
        } catch (err) {
            console.error('[TVNavigation] findNextElement error:', err);
            return null;
        }
    }

    function handleKeyDown(e) {
        try {
            const key = e.keyCode || e.which;

            const KEY_LEFT = 37;
            const KEY_UP = 38;
            const KEY_RIGHT = 39;
            const KEY_DOWN = 40;
            const KEY_ENTER = 13;
            const KEY_BACK = 10009;
            const KEY_ESC = 27;

            let nextEl = null;

            switch (key) {
                case KEY_UP:
                    nextEl = findNextElement('UP');
                    if (nextEl) setFocus(nextEl);
                    e.preventDefault();
                    break;
                case KEY_DOWN:
                    nextEl = findNextElement('DOWN');
                    if (nextEl) setFocus(nextEl);
                    e.preventDefault();
                    break;
                case KEY_LEFT:
                    nextEl = findNextElement('LEFT');
                    if (nextEl) setFocus(nextEl);
                    e.preventDefault();
                    break;
                case KEY_RIGHT:
                    nextEl = findNextElement('RIGHT');
                    if (nextEl) setFocus(nextEl);
                    e.preventDefault();
                    break;
                case KEY_ENTER:
                    if (currentFocusEl) {
                        currentFocusEl.click();
                    }
                    e.preventDefault();
                    break;
                case KEY_BACK:
                case KEY_ESC:
                    const activeOverlay = document.querySelector('.tv-overlay:not(.hidden), .subpage-overlay:not(.hidden)');
                    if (activeOverlay) {
                        activeOverlay.classList.add('hidden');
                        const firstNav = document.querySelector('.sidebar-nav-list .focusable');
                        if (firstNav) setFocus(firstNav);
                    } else {
                        window.history.back();
                    }
                    e.preventDefault();
                    break;
            }
        } catch (err) {
            console.error('[TVNavigation] handleKeyDown error:', err);
        }
    }

    window.TVNavigation = {
        init: function() {
            try {
                document.addEventListener('keydown', handleKeyDown);
                document.addEventListener('focusin', function(e) {
                    try {
                        if (e.target && e.target.classList && e.target.classList.contains('focusable') && e.target !== currentFocusEl) {
                            setFocus(e.target);
                        }
                    } catch (err) {
                        console.error('[TVNavigation] focusin event error:', err);
                    }
                });
                setTimeout(() => {
                    try {
                        const initialTarget = document.querySelector('.grid-tile-card') || 
                                              document.querySelector('.sidebar-nav-list .focusable') || 
                                              document.querySelector('.focusable');
                        if (initialTarget) setFocus(initialTarget);
                    } catch (err) {
                        console.error('[TVNavigation] delayed focus init error:', err);
                    }
                }, 200);
            } catch (err) {
                console.error('[TVNavigation] init error:', err);
            }
        },
        refresh: function() {
            try {
                const initialTarget = document.querySelector('.tv-overlay:not(.hidden) .focusable') || 
                                      document.querySelector('.sidebar-nav-list .focusable') || 
                                      document.querySelector('.focusable');
                if (initialTarget) setFocus(initialTarget);
            } catch (err) {
                console.error('[TVNavigation] refresh error:', err);
            }
        }
    };

    document.addEventListener('DOMContentLoaded', function() {
        try {
            window.TVNavigation.init();
        } catch (err) {
            console.error('[TVNavigation] DOMContentLoaded error:', err);
        }
    });
})();
