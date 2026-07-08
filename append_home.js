
window.onTVKeyDown = function(e) {
    var comingSoon = document.getElementById("comingSoonOverlay");
    if (comingSoon && comingSoon.style.display === "flex") {
        e.preventDefault();
        comingSoon.style.display = "none";
        return true;
    }
    return false;
};

window.onTVBack = function() {
    var appsOverlay = document.getElementById("appsOverlay");
    if (appsOverlay && appsOverlay.classList.contains("show")) {
        closeAppsOverlay();
        window.history.pushState(null, "", window.location.href);
        return true;
    }
    var overlay = document.getElementById("subPageOverlay");
    if (overlay && overlay.style.display === "block") {
        closeSubPage();
        window.history.pushState(null, "", window.location.href);
        return true;
    }
    return false;
};

window.onTVNavigate = function(direction, active) {
    var isIndex = window.location.pathname.indexOf('index.html') !== -1 || window.location.pathname.split('/').pop() === '';
    if (isIndex && !window.__appsOverlayOpen) {
        if (direction === "left") {
            rotate("left");
            return true;
        }
        if (direction === "right") {
            rotate("right");
            return true;
        }
    }
    return false;
};
