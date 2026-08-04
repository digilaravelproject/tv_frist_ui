/**
 * Smart TV 2D Spatial Remote D-Pad Navigation Engine
 * Real-time 2D Directional Spatial Classifier with Strict Active Modal Focus Trapping & Complete Keycode Map.
 * Prevents focus leaks to background elements when a modal/popup is open.
 * 100% Wrapped in Try-Catch Guards for Maximum Performance & Stability.
 */
(function () {
    'use strict';

    let currentFocusEl = null;

    // Comprehensive Keycode Map covering Web, Android TV, Tizen, webOS & USB TV Remotes
    const KEYS = {
        LEFT: [37, 21],          // 37: Arrow Left, 21: Android DPAD_LEFT
        UP: [38, 19],            // 38: Arrow Up, 19: Android DPAD_UP
        RIGHT: [39, 22],         // 39: Arrow Right, 22: Android DPAD_RIGHT
        DOWN: [40, 20],          // 40: Arrow Down, 20: Android DPAD_DOWN
        ENTER: [13, 66, 23],     // 13: Enter, 66: Numpad Enter, 23: Android DPAD_CENTER / OK Button
        BACK: [10009, 27, 4, 8], // 10009: Tizen Back, 27: ESC, 4: Android KEYCODE_BACK, 8: Backspace
        HOME: [36, 3, 172, 461, 170] // 36: Home, 3: Android KEYCODE_HOME, 172/461: TV Home (18=Alt removed — browser modifier key)
    };

    function isKey(keyCode, keyGroup) {
        return Array.isArray(keyGroup) ? keyGroup.includes(keyCode) : keyGroup === keyCode;
    }

    /**
     * Get currently active Modal Overlay element if any is visible
     */
    function getActiveModal() {
        try {
            return document.querySelector('.tv-overlay:not(.hidden), .subpage-overlay:not(.hidden), .tv-offline-modal-overlay:not([style*="display: none"])');
        } catch (e) {
            return null;
        }
    }

    /**
     * Get all visible focusable elements, strictly restricted to Active Modal if open
     */
    function getVisibleFocusables() {
        try {
            const activeModal = getActiveModal();
            const searchRoot = activeModal || document;

            return Array.from(searchRoot.querySelectorAll('.focusable')).filter(el => {
                try {
                    const style = window.getComputedStyle(el);
                    const rect = el.getBoundingClientRect();
                    return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
                } catch (e) {
                    return false;
                }
            });
        } catch (err) {
            console.error('[TVNavigation] getVisibleFocusables error:', err);
            return [];
        }
    }

    /**
     * Set active spatial focus on a target element (with strict Modal Focus Lock)
     */
    function setFocus(targetEl) {
        try {
            if (!targetEl) return;

            // Strict Modal Lock: If a popup/modal is open, NEVER allow focusing background elements!
            const activeModal = getActiveModal();
            if (activeModal && !activeModal.contains(targetEl)) {
                const modalFocusable = activeModal.querySelector('.focusable');
                if (modalFocusable) {
                    targetEl = modalFocusable;
                } else {
                    return;
                }
            }

            // Remove .focused from all elements across the entire document
            document.querySelectorAll('.focused').forEach(el => {
                el.classList.remove('focused');
            });

            currentFocusEl = targetEl;
            currentFocusEl.classList.add('focused');

            if (document.activeElement !== currentFocusEl) {
                currentFocusEl.focus();
            }

            currentFocusEl.scrollIntoView({
                behavior: 'smooth',
                block: 'nearest',
                inline: 'nearest'
            });
        } catch (err) {
            console.error('[TVNavigation] setFocus error:', err);
        }
    }

    /**
     * Calculate bounding box center coordinates
     */
    function getCenter(rect) {
        return {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2
        };
    }

    /**
     * 2D Directional Spatial Classifier
     */
    function findNextElement(direction) {
        try {
            const focusables = getVisibleFocusables();
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

                    let isValid = false;
                    let distance = Infinity;

                    switch (direction) {
                        case 'UP':
                            if (dy < -2) {
                                isValid = true;
                                distance = Math.abs(dy) * 0.7 + Math.abs(dx) * 0.3;
                            }
                            break;
                        case 'DOWN':
                            if (dy > 2) {
                                isValid = true;
                                distance = Math.abs(dy) * 0.7 + Math.abs(dx) * 0.3;
                            }
                            break;
                        case 'LEFT':
                            if (dx < -2) {
                                isValid = true;
                                distance = Math.abs(dx) * 0.7 + Math.abs(dy) * 0.3;
                            }
                            break;
                        case 'RIGHT':
                            if (dx > 2) {
                                isValid = true;
                                distance = Math.abs(dx) * 0.7 + Math.abs(dy) * 0.3;
                            }
                            break;
                    }

                    if (isValid && distance < minDistance) {
                        minDistance = distance;
                        bestCandidate = el;
                    }
                } catch (e) {}
            });

            return bestCandidate;
        } catch (err) {
            console.error('[TVNavigation] findNextElement error:', err);
            return null;
        }
    }

    /**
     * Master D-Pad Remote Control Event Handler
     */
    function handleKeyDown(e) {
        try {
            const key = e.keyCode || e.which;
            let nextEl = null;

            if (isKey(key, KEYS.UP)) {
                nextEl = findNextElement('UP');
                if (nextEl) setFocus(nextEl);
                e.preventDefault();
            } else if (isKey(key, KEYS.DOWN)) {
                nextEl = findNextElement('DOWN');
                if (nextEl) setFocus(nextEl);
                e.preventDefault();
            } else if (isKey(key, KEYS.LEFT)) {
                nextEl = findNextElement('LEFT');
                if (nextEl) setFocus(nextEl);
                e.preventDefault();
            } else if (isKey(key, KEYS.RIGHT)) {
                nextEl = findNextElement('RIGHT');
                if (nextEl) setFocus(nextEl);
                e.preventDefault();
            } else if (isKey(key, KEYS.ENTER)) {
                if (currentFocusEl) {
                    currentFocusEl.click();
                }
                e.preventDefault();
            } else if (isKey(key, KEYS.BACK)) {
                const activeOverlay = getActiveModal();
                if (activeOverlay) {
                    if (activeOverlay.id === 'tv-offline-modal') {
                        window.TVModal.hideNotice();
                    } else {
                        activeOverlay.classList.add('hidden');
                    }
                    const firstNav = document.querySelector('.sidebar-nav-list .focusable') || document.querySelector('.grid-tile-card') || document.querySelector('.focusable');
                    if (firstNav) setFocus(firstNav);
                } else {
                    window.history.back();
                }
                e.preventDefault();
            } else if (isKey(key, KEYS.HOME)) {
                const targetIndex = window.location.pathname.includes('/pages/') ? '../index.html' : 'index.html';
                window.location.href = targetIndex;
                e.preventDefault();
            }
        } catch (err) {
            console.error('[TVNavigation] handleKeyDown error:', err);
        }
    }

    window.TVNavigation = {
        init: function () {
            try {
                document.removeEventListener('keydown', handleKeyDown);
                document.addEventListener('keydown', handleKeyDown);

                document.addEventListener('focusin', (e) => {
                    try {
                        const activeModal = getActiveModal();
                        if (activeModal && e.target && !activeModal.contains(e.target)) {
                            const modalFocusable = activeModal.querySelector('.focusable');
                            if (modalFocusable) setFocus(modalFocusable);
                            return;
                        }
                        if (e.target && e.target.classList && e.target.classList.contains('focusable') && e.target !== currentFocusEl) {
                            setFocus(e.target);
                        }
                    } catch (err) {}
                });

                setTimeout(() => {
                    try {
                        const activeModal = getActiveModal();
                        const initialTarget = (activeModal ? activeModal.querySelector('.focusable') : null) ||
                                              document.querySelector('.grid-tile-card') ||
                                              document.querySelector('.sidebar-nav-list .focusable') ||
                                              document.querySelector('.focusable');
                        if (initialTarget) setFocus(initialTarget);
                    } catch (err) {}
                }, 200);
            } catch (err) {
                console.error('[TVNavigation] init error:', err);
            }
        },

        refresh: function () {
            try {
                setTimeout(() => {
                    const activeModal = getActiveModal();
                    const initialTarget = (activeModal ? activeModal.querySelector('.focusable') : null) ||
                                          document.querySelector('.grid-tile-card') ||
                                          document.querySelector('.sidebar-nav-list .focusable') ||
                                          document.querySelector('.focusable');
                    if (initialTarget) setFocus(initialTarget);
                }, 50);
            } catch (err) {
                console.error('[TVNavigation] refresh error:', err);
            }
        }
    };

    document.addEventListener('DOMContentLoaded', () => {
        try {
            window.TVNavigation.init();
        } catch (err) {
            console.error('[TVNavigation] DOMContentLoaded error:', err);
        }
    });
})();
