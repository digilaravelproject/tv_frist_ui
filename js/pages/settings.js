/**
 * Settings Page Logic (Login PIN)
 */
document.addEventListener('DOMContentLoaded', function() {
    let currentPin = "";
    let maskedPin = ["*", "*", "*", "*", "*", "*"];
    let isProcessing = false;

    // Load background slider via TVCore
    TVCore.init();

    function updateDisplay() {
        const disp = document.getElementById('passDisplay');
        if (disp) {
            disp.innerText = maskedPin.join("");
        }
    }

    function addDigit(digit) {
        if (currentPin.length < 6 && !isProcessing) {
            const index = currentPin.length;
            currentPin += digit;
            maskedPin[index] = digit;
            updateDisplay();

            setTimeout(() => {
                if (currentPin.length > index) {
                    maskedPin[index] = "*";
                    updateDisplay();
                }
            }, 700);

            if (currentPin.length === 6) {
                isProcessing = true;
                setTimeout(checkPin, 800);
            }
        }
    }

    function handleDel() {
        if (currentPin.length > 0 && !isProcessing) {
            currentPin = currentPin.slice(0, -1);
            maskedPin[currentPin.length] = "*";
            updateDisplay();
        }
    }

    function checkPin() {
        const d = new Date();
        const correct = String(d.getFullYear()).slice(-2) +
            String(d.getMonth() + 1).padStart(2, '0') +
            String(d.getDate()).padStart(2, '0');

        if (currentPin === correct) {
            window.location.href = 'advanced.html';
        } else {
            const disp = document.getElementById('passDisplay');
            if (disp) {
                disp.innerText = "ERROR";
                disp.style.color = "#ff4444";
            }

            setTimeout(() => {
                currentPin = "";
                maskedPin = ["*", "*", "*", "*", "*", "*"];
                if (disp) disp.style.color = "var(--house-gold)";
                updateDisplay();
                isProcessing = false;
            }, 1500);
        }
    }

    // Expose hooks for TVNavigation
    window.onTVNumberKey = function(key) {
        addDigit(key);
    };

    window.onTVNavigate = function(direction, activeElement) {
        const buttons = Array.from(document.querySelectorAll('.num-btn'));
        const index = buttons.indexOf(activeElement);
        
        if (index === -1) return false;

        if (direction === "right") {
            if ((index + 1) % 3 !== 0) {
                buttons[index + 1].focus();
                return true;
            }
        } else if (direction === "left") {
            if (index % 3 !== 0) {
                buttons[index - 1].focus();
                return true;
            }
        } else if (direction === "down") {
            if (index + 3 < buttons.length) {
                buttons[index + 3].focus();
                return true;
            }
        } else if (direction === "up") {
            if (index - 3 >= 0) {
                buttons[index - 3].focus();
                return true;
            }
        }
        return false;
    };

    // Attach focus, blur, and click listeners to num-btns
    document.querySelectorAll('.num-btn').forEach(btn => {
        btn.addEventListener('focus', function() {
            // Focus aane par baki buttons se active class hatayein aur ispe lagayein
            document.querySelectorAll('.num-btn').forEach(b => b.classList.remove('active-focus'));
            this.classList.add('active-focus');
        });
        btn.addEventListener('blur', function() {
            // Focus hatne par class remove karein
            this.classList.remove('active-focus');
        });
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            const val = this.dataset.val;
            if (val === "DEL") {
                handleDel();
            } else if (val === "ESC") {
                TVNavigation.goBack();
            } else if (!isNaN(val)) {
                addDigit(val);
            }
        });
    });

    // Set initial focus on Settings page keypad
    var firstBtn = document.querySelector('.num-btn');
    if (firstBtn) {
        if (window.TVNavigation && typeof window.TVNavigation.markDirty === 'function') {
            window.TVNavigation.markDirty();
        }
        firstBtn.focus();
        firstBtn.classList.add('active-focus');
    }

    history.pushState(null, '', location.href);
    window.onpopstate = () => TVNavigation.goBack();
});
