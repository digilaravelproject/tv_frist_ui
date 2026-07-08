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
    window.openIptvMenu = function() {
        var box = document.getElementById('packageBox');
        box.querySelectorAll('.package-item').forEach(el => el.remove());
        var xhr = new XMLHttpRequest();
        xhr.open("GET", "admin/iptv_packages.json?t=" + new Date().getTime(), true);
        xhr.onreadystatechange = function() {
            if (xhr.readyState == 4 && xhr.status == 200) {
                var data = JSON.parse(xhr.responseText);
                data.available_packages.forEach(pkg => {
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
                    box.appendChild(div);
                });
                document.getElementById('packageOverlay').style.display = 'flex';
                setTimeout(() => {
                    var first = box.querySelector('.package-item');
                    if (first) first.focus();
                }, 100);
            }
        };
        xhr.send();
    };

    window.openAppMenu = function() {
        var box = document.getElementById('appBox');
        box.querySelectorAll('.package-item').forEach(el => el.remove());
        var xhr = new XMLHttpRequest();
        xhr.open("GET", "admin/tv_apps.json?t=" + new Date().getTime(), true);
        xhr.onreadystatechange = function() {
            if (xhr.readyState == 4 && xhr.status == 200) {
                var data = JSON.parse(xhr.responseText);
                data.available_tv_apps.forEach(app => {
                    var div = document.createElement('div'); 
                    div.className = 'package-item'; 
                    div.tabIndex = 0; 
                    div.innerText = app.name;
                    div.onclick = () => { 
                        currentPkg = app.process; 
                        currentSrc = "TV APP"; 
                        document.getElementById('appOverlay').style.display='none'; 
                        updateUI('btn-tvapp'); 
                    };
                    box.appendChild(div);
                });
                document.getElementById('appOverlay').style.display = 'flex';
                setTimeout(() => {
                    var first = box.querySelector('.package-item');
                    if (first) first.focus();
                }, 100);
            }
        };
        xhr.send();
    };

    window.openHdmiPort = function() {
        var ip = document.getElementById('v-ip').innerText;
        var model = document.getElementById('v-model').innerText.trim();
        var xhr = new XMLHttpRequest();
        xhr.open("GET", "admin/open_hdmi.php?ip=" + ip + "&model=" + model + "&t=" + new Date().getTime(), true);
        xhr.onreadystatechange = function () {
            if (xhr.readyState === 4 && xhr.status === 200) {
                var res = JSON.parse(xhr.responseText);
                var modelsList = res.options || res.available_models;
                if (modelsList) showManualModelMenu(modelsList, model);
            }
        };
        xhr.send();
    };

    function showManualModelMenu(options, detectedModel) {
        var box = document.getElementById('hdmiBox');
        var overlay = document.getElementById('hdmiOverlay');
        box.innerHTML = ''; 

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
        setTimeout(() => { 
            let firstTestBtn = box.querySelector('.test-btn-inline');
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
        if (window.Android && window.Android.getDeviceInfo) {
            try {
                const deviceInfo = JSON.parse(window.Android.getDeviceInfo());
                displayHWData(deviceInfo);
                return;
            } catch (e) {
                console.error("APK Bridge Error, falling back to PHP:", e);
            }
        }

        var xhr = new XMLHttpRequest();
        xhr.open("GET", "admin/identify_device.php?t=" + new Date().getTime(), true);
        xhr.onreadystatechange = function() {
            if (xhr.readyState == 4 && xhr.status == 200) {
                try {
                    var d = JSON.parse(xhr.responseText);
                    displayHWData(d);
                } catch(e) {}
            }
        };
        xhr.send();
    };

    function displayHWData(d) {
        document.getElementById('v-serial').innerText = d.serial || "UNKNOWN";
        document.getElementById('v-ip').innerText = d.ip || "...";
        document.getElementById('v-gateway').innerText = d.gateway || "...";
        document.getElementById('v-mac').innerText = d.mac || "...";
        document.getElementById('v-subnet').innerText = d.subnet || "...";
        document.getElementById('v-dns').innerText = d.DNS || d.dns || "...";
        document.getElementById('v-model').innerText = d.model || "...";
        document.getElementById('v-android').innerText = d.android || d.Andrd || "11"; 
        
        if(d.room && d.room !== "---" && room) room.value = d.room;
        
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
        if (isSaving || room.value.length < 3 || currentSrc == "") return;
        isSaving = true;

        var payload = {
            room: room.value,
            serial: document.getElementById('v-serial').innerText,
            ip: document.getElementById('v-ip').innerText,
            gateway: document.getElementById('v-gateway').innerText,
            mac: document.getElementById('v-mac').innerText,
            subnet: document.getElementById('v-subnet').innerText,
            DNS: document.getElementById('v-dns').innerText,
            model: document.getElementById('v-model').innerText,
            android: document.getElementById('v-android').innerText,
            tv_source: currentSrc,
            package: currentPkg
        };

        var xhr = new XMLHttpRequest();
        xhr.open("POST", "admin/save_configuration.php", true);
        xhr.setRequestHeader("Content-Type", "application/json");

        xhr.onreadystatechange = function() {
            if (xhr.readyState === 4 && xhr.status === 200) {
                localStorage.setItem('roomNo', payload.room);
                localStorage.setItem('deviceSerial', payload.serial);
                localStorage.setItem('deviceIp', payload.ip);
                window.location.href = 'index.html';
            }
        };

        xhr.send(JSON.stringify(payload));
    };

    document.getElementById('androidBtn').onclick = function() {
        if (window.Android && window.Android.openAndroidSettings) {
            window.Android.openAndroidSettings();
        } else {
            console.log("Android Settings Bridge not found. Attempting PHP fallback...");
            var ip = document.getElementById('v-ip').innerText;
            var xhr = new XMLHttpRequest();
            xhr.open("GET", "admin/open_settings.php?ip=" + ip, true);
            xhr.send();
        }
    };

    document.getElementById('exitBtn').onclick = () => TVNavigation.goBack();
    document.getElementById('btn-esc').onclick = () => TVNavigation.goBack();

    window.loadHW();
});
