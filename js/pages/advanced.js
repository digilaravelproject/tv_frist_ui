/**
 * Advanced Configuration Page Logic
 */
document.addEventListener('DOMContentLoaded', function() {
    // Load config and init slider
    TVCore.fetchHotelConfig().then(config => {
        if (!TVCore.checkPlanExpiredRedirect(config)) {
            TVCore.initBackgroundSlider(config);
        }
    });

    var room = document.getElementById('roomNum');
    var currentSrc = ""; 
    var currentPkg = ""; 
    var isSaving = false;

    // Make functions globally available for inline onClick if needed, 
    // or attach them properly. We attach them globally so inline HTML handlers keep working.
    window.openLiveTvInputsPopup = function() {
        var box = document.getElementById('packageBox');
        var header = document.getElementById('pkgHeader');
        if (header) header.textContent = "SELECT TV INPUT SOURCE";
        box.querySelectorAll('.package-item').forEach(el => el.remove());

        function renderInputs(inputsList, selectedPort) {
            box.querySelectorAll('.package-item').forEach(el => el.remove());
            inputsList.forEach(item => {
                var itemPortId = item.id || item.package || item.file || item.name;
                var itemLabel = item.name || item.label || item.model || ("Input " + (item.id || item));
                var isSelected = (selectedPort && (selectedPort === itemPortId || itemLabel.indexOf(selectedPort) !== -1));

                var div = document.createElement('div');
                div.className = 'package-item' + (isSelected ? ' selected' : '');
                div.tabIndex = 0;
                div.setAttribute('data-port-id', itemPortId);

                var textSpan = document.createElement('span');
                textSpan.innerText = itemLabel;
                div.appendChild(textSpan);

                var tickSpan = document.createElement('span');
                tickSpan.className = 'tick';
                tickSpan.innerText = '✔';
                div.appendChild(tickSpan);

                div.onclick = () => {
                    var selectedId = itemPortId;
                    currentPkg = selectedId;
                    currentSrc = itemLabel;
                    localStorage.setItem('selectedLiveTvPort', selectedId);
                    if (window.flutterBridge && typeof window.flutterBridge.savePortPreference === 'function') {
                        try { window.flutterBridge.savePortPreference(selectedId); } catch(e){}
                    }
                    document.getElementById('packageOverlay').style.display = 'none';
                    updateUI('btn-livetv-popup');
                };
                div.onkeydown = (e) => {
                    if (e.key === 'Enter' || e.keyCode === 13) div.click();
                };
                box.appendChild(div);
            });
            document.getElementById('packageOverlay').style.display = 'flex';
            if (window.TVNavigation && typeof window.TVNavigation.markDirty === 'function') {
                window.TVNavigation.markDirty();
            }
            setTimeout(() => {
                var targetToFocus = box.querySelector('.package-item.selected') || box.querySelector('.package-item');
                if (targetToFocus) targetToFocus.focus();
            }, 100);
        }

        const defaultInputs = [
            { "name": "Setup Box (HDMI 1)", "id": "HDMI_1" },
            { "name": "HDMI 2", "id": "HDMI_2" },
            { "name": "AV Input", "id": "AV" },
            { "name": "IPTV Stream", "id": "IPTV" }
        ];

        var savedPortPref = localStorage.getItem('selectedLiveTvPort') || currentPkg || '';

        Promise.all([
            window.flutterBridge && typeof window.flutterBridge.getLiveTvInputs === 'function'
                ? window.flutterBridge.getLiveTvInputs()
                : Promise.resolve(defaultInputs),
            window.flutterBridge && typeof window.flutterBridge.getSelectedLiveTvPort === 'function'
                ? window.flutterBridge.getSelectedLiveTvPort()
                : Promise.resolve({ selectedPort: savedPortPref })
        ]).then(function (results) {
            var ports = (results[0] && results[0].length > 0) ? results[0] : defaultInputs;
            var savedRes = results[1] || {};
            var savedPort = savedRes.selectedPort || savedRes.port || savedPortPref;

            if (!savedPort && ports.length > 0) {
                savedPort = ports[0].id || ports[0].model || ports[0].name || ports[0].label;
            }

            renderInputs(ports, savedPort);
        }).catch(function() {
            renderInputs(defaultInputs, savedPortPref);
        });
    };

    window.openIptvMenu = function() {
        var box = document.getElementById('packageBox');
        box.querySelectorAll('.package-item').forEach(el => el.remove());
        
        function renderPackages(packages) {
            box.querySelectorAll('.package-item').forEach(el => el.remove());
            packages.forEach(pkg => {
                var div = document.createElement('div'); 
                div.className = 'package-item'; 
                div.tabIndex = 0; 
                div.innerText = pkg.name;
                div.onclick = () => { 
                    currentPkg = pkg.file; 
                    currentSrc = "IPTV"; 
                    document.getElementById('packageOverlay').style.display='none'; 
                    updateUI('btn-iptv'); 
                };
                div.onkeydown = (e) => {
                    if (e.key === 'Enter' || e.keyCode === 13) div.click();
                };
                box.appendChild(div);
            });
            document.getElementById('packageOverlay').style.display = 'flex';
            if (window.TVNavigation && typeof window.TVNavigation.markDirty === 'function') {
                window.TVNavigation.markDirty();
            }
            setTimeout(() => {
                var first = box.querySelector('.package-item');
                if (first) first.focus();
            }, 100);
        }

        var fallbackPackages = [
            { "name": "IPTV All Channels", "file": "iptv/all.json" },
            { "name": "IPTV Sports Package", "file": "iptv/sports.json" },
            { "name": "IPTV News & Movies", "file": "iptv/news_movies.json" }
        ];

        var xhr = new XMLHttpRequest();
        xhr.open("GET", "admin/iptv_packages.json?t=" + new Date().getTime(), true);
        xhr.onreadystatechange = function() {
            if (xhr.readyState == 4) {
                if (xhr.status == 200) {
                    try {
                        var data = JSON.parse(xhr.responseText);
                        if (data && data.available_packages && data.available_packages.length > 0) {
                            renderPackages(data.available_packages);
                            return;
                        }
                    } catch (e) {}
                }
                renderPackages(fallbackPackages);
            }
        };
        xhr.onerror = function() {
            renderPackages(fallbackPackages);
        };
        xhr.send();
    };

    window.openAppMenu = function() {
        var box = document.getElementById('appBox');
        box.querySelectorAll('.package-item').forEach(el => el.remove());
        
        function renderApps(apps) {
            box.querySelectorAll('.package-item').forEach(el => el.remove());
            apps.forEach(app => {
                var div = document.createElement('div'); 
                div.className = 'package-item'; 
                div.tabIndex = 0; 
                div.innerText = app.name;
                div.onclick = () => { 
                    currentPkg = app.process || app.package || app.id; 
                    currentSrc = "TV APP"; 
                    document.getElementById('appOverlay').style.display='none'; 
                    updateUI('btn-tvapp'); 
                };
                div.onkeydown = (e) => {
                    if (e.key === 'Enter' || e.keyCode === 13) div.click();
                };
                box.appendChild(div);
            });
            document.getElementById('appOverlay').style.display = 'flex';
            if (window.TVNavigation && typeof window.TVNavigation.markDirty === 'function') {
                window.TVNavigation.markDirty();
            }
            setTimeout(() => {
                var first = box.querySelector('.package-item');
                if (first) first.focus();
            }, 100);
        }

        var fallbackApps = [
            { "name": "YouTube", "process": "com.google.android.youtube.tv" },
            { "name": "Netflix", "process": "com.netflix.ninja" },
            { "name": "Prime Video", "process": "com.amazon.amazonvideo.livingroom" },
            { "name": "Live TV App", "process": "com.google.android.tv" }
        ];

        var xhr = new XMLHttpRequest();
        xhr.open("GET", "admin/tv_apps.json?t=" + new Date().getTime(), true);
        xhr.onreadystatechange = function() {
            if (xhr.readyState == 4) {
                if (xhr.status == 200) {
                    try {
                        var data = JSON.parse(xhr.responseText);
                        if (data && data.available_tv_apps && data.available_tv_apps.length > 0) {
                            renderApps(data.available_tv_apps);
                            return;
                        }
                    } catch (e) {}
                }
                renderApps(fallbackApps);
            }
        };
        xhr.onerror = function() {
            renderApps(fallbackApps);
        };
        xhr.send();
    };

    window.openHdmiPort = function() {
        var ip = document.getElementById('v-ip').innerText;
        var model = document.getElementById('v-model').innerText.trim();
        
        var fallbackOptions = {
            "Generic": {
                "HDMI 1": "com.mediatek.tv.hdmi1",
                "HDMI 2": "com.mediatek.tv.hdmi2",
                "AV Input": "com.mediatek.tv.av"
            }
        };

        // 1. Fetch Dynamic Hardware Ports via Flutter Bridge
        if (window.flutterBridge && typeof window.flutterBridge.getHdmiModels === 'function') {
            try {
                var res = window.flutterBridge.getHdmiModels();
                var p = (res && typeof res.then === 'function') ? res : Promise.resolve(res);
                p.then(function(portsList) {
                    if (portsList) {
                        if (typeof portsList === 'string') {
                            try { portsList = JSON.parse(portsList); } catch(e){}
                        }
                        var formatted = (portsList.options || portsList.available_models || portsList);
                        showManualModelMenu(formatted, model);
                        return;
                    }
                    fetchHdmiFromPhp();
                }).catch(function(err) {
                    console.warn("getHdmiModels bridge call failed:", err);
                    fetchHdmiFromPhp();
                });
                return;
            } catch(err) {
                console.warn("getHdmiModels bridge error:", err);
            }
        }

        fetchHdmiFromPhp();

        function fetchHdmiFromPhp() {
            var xhr = new XMLHttpRequest();
            xhr.open("GET", "admin/open_hdmi.php?ip=" + ip + "&model=" + model + "&t=" + new Date().getTime(), true);
            xhr.onreadystatechange = function () {
                if (xhr.readyState === 4) {
                    if (xhr.status === 200) {
                        try {
                            var res = JSON.parse(xhr.responseText);
                            var modelsList = res.options || res.available_models;
                            if (modelsList) {
                                showManualModelMenu(modelsList, model);
                                return;
                            }
                        } catch (e) {}
                    }
                    showManualModelMenu(fallbackOptions, "HDMI 1");
                }
            };
            xhr.onerror = function() {
                showManualModelMenu(fallbackOptions, "HDMI 1");
            };
            xhr.send();
        }
    };

    function showManualModelMenu(options, detectedModel) {
        var box = document.getElementById('hdmiBox');
        var overlay = document.getElementById('hdmiOverlay');
        box.innerHTML = ''; 

        // Handle flat object or array formats from bridge
        if (options && typeof options === 'object' && !Array.isArray(options)) {
            let firstVal = Object.values(options)[0];
            if (typeof firstVal === 'string') {
                options = { "Hardware Ports": options };
            }
        }

        function createRow(brand, modelName, pkg, isRecommended = false) {
            let row = document.createElement('div');
            row.className = 'hdmi-list-row';
            row.tabIndex = 0;
            
            let displayTitle = isRecommended ? `★ RECOMMENDED: ${brand} (${modelName})` : `${brand} (${modelName})`;
            
            row.innerHTML = `
                <div class="model-name-text" tabindex="0">${displayTitle}</div>
                <button class="test-btn-inline" tabindex="0">TEST</button>
            `;

            const modelLabel = row.querySelector('.model-name-text');
            const testBtn = row.querySelector('.test-btn-inline');

            modelLabel.onclick = (e) => {
                e.stopPropagation();
                confirmSelection(pkg);
            };

            testBtn.onclick = (e) => {
                e.stopPropagation();
                launchSpecificPackage(pkg);
            };
            
            row.onkeydown = (e) => {
                if (e.keyCode === 39) testBtn.focus();
                if (e.keyCode === 37) modelLabel.focus();
                if (e.keyCode === 13) {
                    if (document.activeElement === testBtn) launchSpecificPackage(pkg);
                    else confirmSelection(pkg);
                }
            };

            return row;
        }

        for (let brand in options) {
            if (options[brand][detectedModel]) {
                box.appendChild(createRow(brand, detectedModel, options[brand][detectedModel], true));
            }
        }
        for (let brand in options) {
            for (let modelName in options[brand]) {
                if (modelName !== detectedModel) {
                    box.appendChild(createRow(brand, modelName, options[brand][modelName], false));
                }
            }
        }

        overlay.style.display = 'flex';
        if (window.TVNavigation && typeof window.TVNavigation.markDirty === 'function') {
            window.TVNavigation.markDirty();
        }
        setTimeout(() => { 
            let firstTestBtn = box.querySelector('.test-btn-inline') || box.querySelector('.model-name-text');
            if(firstTestBtn) firstTestBtn.focus(); 
        }, 200);
    }

    function launchSpecificPackage(packageName) {
        var ip = document.getElementById('v-ip').innerText;
        if (ip === "..." || ip === "") return;
        var xhr = new XMLHttpRequest();
        xhr.open("GET", "admin/open_hdmi.php?ip=" + ip + "&package=" + packageName + "&t=" + new Date().getTime(), true);
        xhr.send();
    }

    function confirmSelection(pkg) {
        currentPkg = pkg; 
        currentSrc = "HDMI";
        localStorage.setItem('selectedLiveTvPort', pkg);
        if (window.flutterBridge && typeof window.flutterBridge.savePortPreference === 'function') {
            try { window.flutterBridge.savePortPreference(pkg); } catch(e){}
        }
        document.getElementById('hdmiOverlay').style.display = 'none';
        updateUI('btn-hdmi');
    }

    function updateUI(activeId) {
        document.querySelectorAll('.list-item').forEach(el => el.classList.remove('selected'));
        const activeEl = document.getElementById(activeId);
        if (activeEl) activeEl.classList.add('selected');
        
        const saveBtn = document.getElementById('saveBtn');
        if (saveBtn) {
            saveBtn.blur(); 
            setTimeout(() => saveBtn.focus(), 50);
        }
    }

    window.loadHW = function() {
        // Query Flutter Bridge for live network hardware parameters
        if (window.flutterBridge && typeof window.flutterBridge.identifyDevice === 'function') {
            window.flutterBridge.identifyDevice().then(function(info) {
                var d = (info && info.data) || (info && info.device) || info || {};
                displayHWData({
                    serial: d.serial || d.device_id || d.deviceId || "UNKNOWN",
                    ip: d.ip || d.ip_address || d.ipAddress || "...",
                    gateway: d.gateway || d.gway || "...",
                    mac: d.mac || d.mac_address || d.macAddress || "...",
                    subnet: d.subnet || d.subnet_mask || d.subnetMask || "...",
                    dns: d.dns || d.DNS || "...",
                    model: d.model || "...",
                    android: d.android || d.os_version || d.osVersion || "11",
                    room: d.room || d.room_no || ""
                });
            }).catch(function(err) {
                console.error("Bridge identifyDevice failed:", err);
                loadHWFromConfig();
            });
            return;
        }
        loadHWFromConfig();
    };

    function loadHWFromConfig() {
        TVCore.fetchHotelConfig().then(function(config) {
            if (config && config.device) {
                var d = {
                    serial: config.device.device_id || "UNKNOWN",
                    ip: config.device.ip_address || "...",
                    gateway: config.device.gateway || "...",
                    mac: config.device.mac_address || "...",
                    subnet: config.device.subnet_mask || "...",
                    dns: config.device.dns || "...",
                    model: config.device.model || "...",
                    android: config.device.android_version || config.device.os_version || "11",
                    room: config.device.room_no || ""
                };
                if (config.template && config.template.latest_version) {
                    d.version = config.template.latest_version;
                }
                displayHWData(d);
            }
        });
    }

    function displayHWData(d) {
        document.getElementById('v-serial').innerText = d.serial || "UNKNOWN";
        document.getElementById('v-ip').innerText = d.ip || "...";
        document.getElementById('v-gateway').innerText = d.gateway || "...";
        document.getElementById('v-mac').innerText = d.mac || "...";
        document.getElementById('v-subnet').innerText = d.subnet || "...";
        document.getElementById('v-dns').innerText = d.dns || d.DNS || "...";
        document.getElementById('v-model').innerText = d.model || "...";
        document.getElementById('v-android').innerText = d.android || d.Andrd || "11"; 
        
        // Populate Template Version if present
        var verEl = document.getElementById('v-version');
        if (verEl) {
            verEl.innerText = d.version || "6.0";
        }
        
        if (d.room && d.room !== "---" && room) {
            room.value = d.room;
        }
        
        setTimeout(() => { let k1 = document.getElementById('key1'); if(k1) k1.focus(); }, 300);
    }

    function press(v) {
        if (!room) return;
        if (!isNaN(v) && room.value.length < 3) {
            room.value += v;
            if (room.value.length == 3) setTimeout(function(){ document.getElementById('btn-iptv').focus(); }, 200);
        } else if (v == 'DEL') {
            room.value = room.value.slice(0, -1);
        }
    }

    document.querySelectorAll('.key-btn').forEach(function(b) {
        if(b.dataset.val) b.onclick = function(e) { e.preventDefault(); press(b.dataset.val); };
        b.addEventListener('focus', function() {
            document.querySelectorAll('.active-focus').forEach(el => el.classList.remove('active-focus'));
            this.classList.add('active-focus');
        });
        b.addEventListener('blur', function() {
            this.classList.remove('active-focus');
        });
    });

    // Custom KeyDown Logic mapped into TVNavigation
    window.onTVNumberKey = function(key) {
        press(key);
    };
    
    window.onTVBack = function() {
        // Hide overlays if they are open
        const overlays = ['.overlay-container', '.overlay-fullscreen'];
        let closedOverlay = false;
        overlays.forEach(selector => {
            document.querySelectorAll(selector).forEach(overlay => {
                if (window.getComputedStyle(overlay).display !== 'none') {
                    overlay.style.display = 'none';
                    closedOverlay = true;
                }
            });
        });
        if (closedOverlay) return true;
        return false;
    };

    window.onTVKeyDown = function(e) {
        var code = e.keyCode || e.which;
        var active = document.activeElement;

        if (code == 8) { press('DEL'); return true; }
        
        if (code == 13 && active && (
            active.classList.contains('list-item') || 
            active.classList.contains('package-item') || 
            active.classList.contains('hdmi-list-row') ||
            active.classList.contains('model-name-text') || 
            active.classList.contains('test-btn-inline')
        )) { 
            e.preventDefault();
            e.stopImmediatePropagation();
            e.stopPropagation();
            active.click(); 
            return true;
        }
        return false;
    };

    // Advanced overrides for directional nav
    window.onTVNavigate = function(direction, active) {
        // Add specific handling for AndroidBtn/RefreshBtn layout
        if (active.id === 'androidBtn') {
            if (direction === 'down') { document.getElementById('refreshBtn').focus(); return true; }
            if (direction === 'left') { document.getElementById('key1').focus(); return true; }
        } else if (active.id === 'refreshBtn') {
            if (direction === 'up') { document.getElementById('androidBtn').focus(); return true; }
            if (direction === 'left') { document.getElementById('key1').focus(); return true; }
            if (direction === 'down') { document.getElementById('saveBtn').focus(); return true; }
        }
        return false; // let default tv-navigation handle it
    };

    document.getElementById('saveBtn').onclick = function() {
        if (isSaving || room.value.length < 3) return; // Allow save if room is selected
        isSaving = true;
        var selectedPortId = currentPkg || currentSrc || "HDMI";
        var payload = {
            room: room.value,
            serial: document.getElementById('v-serial').innerText,
            ip: document.getElementById('v-ip').innerText,
            mac: document.getElementById('v-mac').innerText,
            model: document.getElementById('v-model').innerText,
            tv_source: currentSrc || "HDMI",
            package: currentPkg
        };

        // Save selected Live TV port locally
        localStorage.setItem('selectedLiveTvPort', selectedPortId);
        localStorage.setItem('roomNo', payload.room);

        // Notify Flutter Bridge of port preference
        if (window.flutterBridge && typeof window.flutterBridge.savePortPreference === 'function') {
            try { window.flutterBridge.savePortPreference(selectedPortId); } catch(e){}
        }

        if (window.flutterBridge && window.flutterBridge.saveDeviceConfig) {
            window.flutterBridge.saveDeviceConfig(payload).then(function() {
                window.location.href = 'index.html';
            }).catch(function() {
                window.location.href = 'index.html';
            });
            return;
        }

        var xhr = new XMLHttpRequest();
        xhr.open("POST", "admin/save_configuration.php", true);
        xhr.setRequestHeader("Content-Type", "application/json");

        xhr.onreadystatechange = function() {
            if (xhr.readyState === 4 && xhr.status === 200) {
                localStorage.setItem('deviceSerial', payload.serial);
                localStorage.setItem('deviceIp', payload.ip);
                window.location.href = 'index.html';
            }
        };

        xhr.send(JSON.stringify(payload));
    };

    document.getElementById('androidBtn').onclick = function() {
        if (window.flutterBridge && window.flutterBridge.openSettings) {
            window.flutterBridge.openSettings();
        } else if (window.Android && window.Android.openAndroidSettings) {
            window.Android.openAndroidSettings();
        } else {
            console.log("Android Settings Bridge not found. Attempting PHP fallback...");
            var ip = document.getElementById('v-ip').innerText;
            var xhr = new XMLHttpRequest();
            xhr.open("GET", "admin/open_settings.php?ip=" + ip, true);
            xhr.send();
        }
    };

    var refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
        refreshBtn.onclick = function() {
            window.loadHW();
        };
    }

    document.getElementById('exitBtn').onclick = () => TVNavigation.goBack();
    document.getElementById('btn-esc').onclick = () => TVNavigation.goBack();

    window.loadHW();
});
