const timeElement = document.getElementById('time');
const ampmElement = document.getElementById('ampm');
const fullscreenBtn = document.getElementById('fullscreen-btn');
const fullscreenIcon = document.getElementById('fullscreen-icon');
const exitFullscreenIcon = document.getElementById('exit-fullscreen-icon');
const body = document.body;

let wakeLock = null;
let controlsTimeout;
let noSleepVideo = null;

// ── Clock ────────────────────────────────────────────────

function updateClock() {
    const now = new Date();
    let hours = now.getHours();
    const minutes = now.getMinutes();
    const seconds = now.getSeconds();

    const ampm = hours >= 12 ? 'PM' : 'AM';

    hours = hours % 12;
    hours = hours ? hours : 12;

    const minutesStr = String(minutes).padStart(2, '0');
    const secondsStr = String(seconds).padStart(2, '0');

    timeElement.textContent = `${hours} : ${minutesStr} : ${secondsStr}`;
    ampmElement.textContent = ampm;
}

// Update every second for seconds display
updateClock();
setInterval(updateClock, 1000);

// ── Controls visibility ──────────────────────────────────

function showControls() {
    body.classList.add('show-controls');
    clearTimeout(controlsTimeout);
    controlsTimeout = setTimeout(() => {
        body.classList.remove('show-controls');
    }, 3000);
}

window.addEventListener('mousemove', showControls);
window.addEventListener('touchstart', showControls);
window.addEventListener('keydown', showControls);
window.addEventListener('click', showControls);

// ── Fullscreen (with webkit prefix for Safari) ───────────

function getFullscreenElement() {
    return document.fullscreenElement || document.webkitFullscreenElement;
}

function toggleFullscreen() {
    if (!getFullscreenElement()) {
        const el = document.documentElement;
        if (el.requestFullscreen) {
            el.requestFullscreen().catch(err => {
                console.log('Fullscreen error:', err.message);
            });
        } else if (el.webkitRequestFullscreen) {
            el.webkitRequestFullscreen();
        }
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        }
    }
}

fullscreenBtn.addEventListener('click', toggleFullscreen);

function onFullscreenChange() {
    if (getFullscreenElement()) {
        fullscreenIcon.style.display = 'none';
        exitFullscreenIcon.style.display = 'block';
    } else {
        fullscreenIcon.style.display = 'block';
        exitFullscreenIcon.style.display = 'none';
    }
}

document.addEventListener('fullscreenchange', onFullscreenChange);
document.addEventListener('webkitfullscreenchange', onFullscreenChange);

// ── Screen Wake Lock ─────────────────────────────────────
// Strategy:
//   1. Try the native Wake Lock API (works on most desktop browsers & some mobile)
//   2. If native API isn't available or fails, fall back to a silent video loop
//      (the proven "NoSleep" technique — works reliably on iOS/iPadOS)
//
// Wake lock is always active when the page is visible, not tied to fullscreen,
// because iPadOS doesn't support the Fullscreen API at all.

async function requestWakeLock() {
    // Try native API first
    if ('wakeLock' in navigator) {
        try {
            wakeLock = await navigator.wakeLock.request('screen');
            wakeLock.addEventListener('release', () => {
                console.log('Native wake lock released');
                wakeLock = null;
            });
            console.log('Native wake lock active');
            return; // Success — no need for fallback
        } catch (err) {
            console.warn('Native wake lock failed:', err);
        }
    }

    // Fallback: silent video loop (NoSleep technique for iOS/iPadOS)
    enableNoSleepVideo();
}

function releaseWakeLock() {
    if (wakeLock) {
        try {
            wakeLock.release();
        } catch (err) {
            console.error('Error releasing wake lock:', err);
        }
        wakeLock = null;
    }
    disableNoSleepVideo();
}

// ── NoSleep video fallback ───────────────────────────────
// A tiny silent MP4 played in a loop prevents iOS from sleeping.
// This is the same technique used by the widely-adopted NoSleep.js library.

const SILENT_MP4 = 'data:video/mp4;base64,AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAAIZnJlZQAAAAhtZGF0AAAA1m1vb3YAAABsbXZoZAAAAAAAAAAAAAAAAAAAA+gAAAAAAAEAAAEAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIAAAAYdHJhawAAAFx0a2hkAAAAAwAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAABAbWRpYQAAACBtZGhkAAAAAAAAAAAAAAAAAAAoAAAAAAAAVcQAAAAAAC1oZGxyAAAAAAAAAAB2aWRlAAAAAAAAAAAAAAAAVmlkZW9IYW5kbGVyAAAAdm1pbmYAAAAUdm1oZAAAAAEAAAAAAAAAAAAAACRkaW5mAAAAHGRyZWYAAAAAAAAAAQAAAAx1cmwgAAAAAQAAADZzdGJsAAAAGnN0c2QAAAAAAAAAAQAAAAphdmMxAAAAAAAAAABoc3R0cwAAAAAAAAAAAAAUc3RzegAAAAAAAAAAAAAAAAAAFHN0Y28AAAAAAAAAAA==';

function enableNoSleepVideo() {
    if (noSleepVideo) return; // Already running

    noSleepVideo = document.createElement('video');
    noSleepVideo.setAttribute('playsinline', '');
    noSleepVideo.setAttribute('muted', '');
    noSleepVideo.setAttribute('loop', '');
    noSleepVideo.muted = true;
    noSleepVideo.src = SILENT_MP4;

    // Hide it completely
    noSleepVideo.style.position = 'fixed';
    noSleepVideo.style.top = '-1px';
    noSleepVideo.style.left = '-1px';
    noSleepVideo.style.width = '1px';
    noSleepVideo.style.height = '1px';
    noSleepVideo.style.opacity = '0';
    noSleepVideo.style.pointerEvents = 'none';

    document.body.appendChild(noSleepVideo);

    noSleepVideo.play().then(() => {
        console.log('NoSleep video fallback active');
    }).catch(err => {
        console.warn('NoSleep video play failed (needs user gesture):', err);
    });
}

function disableNoSleepVideo() {
    if (noSleepVideo) {
        noSleepVideo.pause();
        noSleepVideo.remove();
        noSleepVideo = null;
        console.log('NoSleep video fallback stopped');
    }
}

// ── Activate wake lock on page load & visibility change ──

// Request on first user interaction (needed for autoplay policy on iOS)
function onFirstInteraction() {
    requestWakeLock();
    window.removeEventListener('click', onFirstInteraction);
    window.removeEventListener('touchstart', onFirstInteraction);
}

window.addEventListener('click', onFirstInteraction);
window.addEventListener('touchstart', onFirstInteraction);

// Also try immediately (works on desktop / secure contexts)
requestWakeLock();

// Re-acquire when the page becomes visible again
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
        requestWakeLock();
    }
});
