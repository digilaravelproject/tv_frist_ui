/**
 * Hotel Information Page — Smart TV
 * Dynamically populates hotel name, location, description, amenities,
 * emergency contacts, gallery, cover image and clock from data.json.
 */
(function () {
    'use strict';

    /* Clock & Logo handled by shared page-header.js component */

    /* ─── Safe DOM Set ────────────────────────────────────────── */
    function setText(id, value) {
        try { const el = document.getElementById(id); if (el) el.textContent = value || '—'; } catch (e) { }
    }

    /* ─── Build Page from Data ────────────────────────────────── */
    function bindHotelInfo(d) {
        try {
            const hotel = d.hotel || {};
            const media = hotel.media || {};

            // Hotel Name & Location
            setText('hi-hotel-name', hotel.hotel_name);
            setText('hi-hotel-location', hotel.hotel_location ? '📍 ' + hotel.hotel_location : '');

            // Description
            setText('hi-description', hotel.description);

            // Cover Image
            const coverImg = document.getElementById('hi-cover-img');
            if (coverImg && media.cover_image) {
                coverImg.src = media.cover_image;
                coverImg.onerror = () => { coverImg.style.display = 'none'; };
            }

            // Hotel Logo
            const logoImg = document.getElementById('hotel-logo-img');
            if (logoImg && media.logo_image) {
                logoImg.src = media.logo_image;
                logoImg.style.display = 'block';
                logoImg.onerror = () => { logoImg.style.display = 'none'; };
            }

            // Amenities List
            const amenitiesList = document.getElementById('hi-amenities-list');
            if (amenitiesList && Array.isArray(hotel.hotel_amenities)) {
                amenitiesList.innerHTML = hotel.hotel_amenities.map(a =>
                    `<li class="hi-amenity-item"><span class="hi-amenity-dot"></span>${a}</li>`
                ).join('');
            }

            // Emergency Contacts
            const contacts = hotel.emergency_contacts || {};
            const contactsGrid = document.getElementById('hi-contacts-grid');
            if (contactsGrid) {
                const contactMap = [
                    { icon: '🛎️', label: 'Reception', key: 'reception' },
                    { icon: '🍽️', label: 'Dining', key: 'dining' },
                    { icon: '🚑', label: 'Medical SOS', key: 'medical_sos' },
                    { icon: '✉️', label: 'Email', key: 'email' },
                ];
                contactsGrid.innerHTML = contactMap.map(c => `
                    <div class="hi-contact-chip">
                        <span class="hi-contact-icon">${c.icon}</span>
                        <div class="hi-contact-details">
                            <span class="hi-contact-label">${c.label}</span>
                            <span class="hi-contact-value">${contacts[c.key] || '—'}</span>
                        </div>
                    </div>
                `).join('');
            }

            // Gallery Grid — click opens lightbox
            const galleryGrid = document.getElementById('hi-gallery-grid');
            if (galleryGrid && Array.isArray(media.hotel_images)) {
                galleryGrid.innerHTML = media.hotel_images.map((url, i) => `
                    <div class="hi-gallery-img-wrap focusable" tabindex="0" data-index="${i}">
                        <img src="${url}" alt="Hotel Gallery ${i + 1}" loading="lazy" onerror="this.parentElement.style.display='none'">
                    </div>
                `).join('');

                // Store images globally for lightbox
                window._hotelGalleryImages = media.hotel_images;

                // Click/Enter to open lightbox
                galleryGrid.querySelectorAll('.hi-gallery-img-wrap').forEach((wrap) => {
                    wrap.addEventListener('click', () => openLightbox(parseInt(wrap.dataset.index)));
                    wrap.addEventListener('keydown', (e) => {
                        if (e.key === 'Enter' || e.keyCode === 13 || e.keyCode === 23) {
                            openLightbox(parseInt(wrap.dataset.index));
                        }
                    });
                });
            }

            // Background Sliders (optional)
            if (window.APIService && typeof window.APIService.initBgSlider === 'function') {
                const sliders = media.slider_images || media.hotel_images || [];
                window.APIService.initBgSlider(sliders);
            }
        } catch (err) {
            console.error('[HotelInfo] bindHotelInfo error:', err);
        }
    }

    /* ─── Lightbox Slider ──────────────────────────────────────── */
    let _lbIndex = 0;

    function openLightbox(index) {
        try {
            const images = window._hotelGalleryImages || [];
            if (!images.length) return;
            _lbIndex = index || 0;

            const lb = document.getElementById('hi-lightbox');
            if (!lb) return;
            lb.classList.remove('hidden');

            // Build dots
            const dotsEl = document.getElementById('hi-lb-dots');
            if (dotsEl) {
                dotsEl.innerHTML = images.map((_, i) =>
                    `<div class="hi-lb-dot${i === _lbIndex ? ' active' : ''}" data-dot="${i}"></div>`
                ).join('');
                dotsEl.querySelectorAll('.hi-lb-dot').forEach(dot => {
                    dot.addEventListener('click', () => goToSlide(parseInt(dot.dataset.dot)));
                });
            }

            showSlide(_lbIndex);

            // Focus close button first
            setTimeout(() => {
                const closeBtn = document.getElementById('hi-lb-close');
                if (closeBtn) closeBtn.focus();
                if (window.TVNavigation) window.TVNavigation.refresh();
            }, 50);
        } catch (err) {
            console.error('[HotelInfo] openLightbox error:', err);
        }
    }

    function closeLightbox() {
        try {
            const lb = document.getElementById('hi-lightbox');
            if (lb) lb.classList.add('hidden');
            if (window.TVNavigation) window.TVNavigation.refresh();
        } catch (err) {
            console.error('[HotelInfo] closeLightbox error:', err);
        }
    }

    function showSlide(index) {
        try {
            const images = window._hotelGalleryImages || [];
            if (!images.length) return;
            _lbIndex = ((index % images.length) + images.length) % images.length;

            const imgEl = document.getElementById('hi-lb-img');
            const counter = document.getElementById('hi-lb-counter');
            const dotsEl = document.getElementById('hi-lb-dots');

            if (imgEl) {
                imgEl.classList.add('fade-out');
                setTimeout(() => {
                    imgEl.src = images[_lbIndex];
                    imgEl.classList.remove('fade-out');
                }, 200);
            }
            if (counter) counter.textContent = `${_lbIndex + 1} / ${images.length}`;
            if (dotsEl) {
                dotsEl.querySelectorAll('.hi-lb-dot').forEach((d, i) => {
                    d.classList.toggle('active', i === _lbIndex);
                });
            }
        } catch (err) {
            console.error('[HotelInfo] showSlide error:', err);
        }
    }

    function goToSlide(index) { showSlide(index); }
    function nextSlide() { showSlide(_lbIndex + 1); }
    function prevSlide() { showSlide(_lbIndex - 1); }

    function initLightboxControls() {
        try {
            const closeBtn = document.getElementById('hi-lb-close');
            const prevBtn = document.getElementById('hi-lb-prev');
            const nextBtn = document.getElementById('hi-lb-next');

            if (closeBtn) closeBtn.addEventListener('click', closeLightbox);
            if (prevBtn) prevBtn.addEventListener('click', prevSlide);
            if (nextBtn) nextBtn.addEventListener('click', nextSlide);

            // Keyboard/Remote Navigation inside lightbox
            document.addEventListener('keydown', (e) => {
                const lb = document.getElementById('hi-lightbox');
                if (!lb || lb.classList.contains('hidden')) return;

                const key = e.keyCode || e.which;
                // Left Arrow (21) / Right Arrow (22) / Back (4) / Escape (27)
                if (key === 37 || key === 21) { e.preventDefault(); prevSlide(); }
                else if (key === 39 || key === 22) { e.preventDefault(); nextSlide(); }
                else if (key === 27 || key === 4) { e.preventDefault(); closeLightbox(); }
            });
        } catch (err) {
            console.error('[HotelInfo] initLightboxControls error:', err);
        }
    }

    /* ─── Init ────────────────────────────────────────────────── */
    function init() {
        try {
            // Clock & Logo are handled by shared page-header.js component
            initLightboxControls();

            // Use APIService.fetchJSON if available, else direct fetch fallback
            if (window.APIService && typeof window.APIService.fetchJSON === 'function') {
                window.APIService.fetchJSON('../data.json')
                    .then(json => {
                        try {
                            if (json && json.data) bindHotelInfo(json.data);
                            else console.warn('[HotelInfo] data.json has no .data field', json);
                        } catch (e) { console.error('[HotelInfo] bindHotelInfo error:', e); }
                    })
                    .catch(e => console.error('[HotelInfo] fetchJSON error:', e));
            } else {
                // Fallback: load data.json directly
                fetch('../data.json')
                    .then(r => r.json())
                    .then(json => {
                        if (json && json.data) bindHotelInfo(json.data);
                    })
                    .catch(e => console.error('[HotelInfo] data.json fetch error:', e));
            }
        } catch (err) {
            console.error('[HotelInfo] init error:', err);
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        try { init(); } catch (err) { console.error('[HotelInfo] DOMContentLoaded error:', err); }
    });
})();
