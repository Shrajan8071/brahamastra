const timeElement = document.getElementById('time');
const ampmElement = document.getElementById('ampm');
const controlsBar = document.getElementById('controls-bar');
const lockBtn = document.getElementById('lock-btn');
const lockIconLocked = document.getElementById('lock-icon-locked');
const lockIconUnlocked = document.getElementById('lock-icon-unlocked');
const fullscreenBtn = document.getElementById('fullscreen-btn');
const fullscreenIcon = document.getElementById('fullscreen-icon');
const exitFullscreenIcon = document.getElementById('exit-fullscreen-icon');
const toastElement = document.getElementById('toast');
const body = document.body;

// State management
let wakeLock = null;
let isStayAwakeEnabled = true; // Default ON
let controlsTimeout = null;
let toastTimeout = null;

// Fallback media elements
let hiddenVideo = null;
let canvasStream = null;
let canvasInterval = null;
let audioCtx = null;

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

updateClock();
setInterval(updateClock, 1000);

// ── Controls Visibility & Auto-Hide ───────────────────────

function showControls() {
    body.classList.add('show-controls');
    clearTimeout(controlsTimeout);
    controlsTimeout = setTimeout(() => {
        body.classList.remove('show-controls');
    }, 3500);
}

window.addEventListener('mousemove', showControls);
window.addEventListener('touchstart', showControls, { passive: true });
window.addEventListener('keydown', showControls);
window.addEventListener('click', showControls);

// ── Toast Notifications ──────────────────────────────────

function showToast(message) {
    if (!toastElement) return;
    toastElement.textContent = message;
    toastElement.classList.add('show');
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
        toastElement.classList.remove('show');
    }, 3000);
}

// ── Fullscreen Support (Cross-browser / WebKit) ─────────

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
    // Re-ensure wake lock after entering/exiting fullscreen
    ensureWakeLock();
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
    ensureWakeLock();
}

document.addEventListener('fullscreenchange', onFullscreenChange);
document.addEventListener('webkitfullscreenchange', onFullscreenChange);

// ── Stay-Awake Multi-Layer System ─────────────────────────

// Layer 1: Native Wake Lock API
async function requestNativeWakeLock() {
    if (!isStayAwakeEnabled || document.visibilityState !== 'visible') return false;
    if ('wakeLock' in navigator) {
        try {
            if (wakeLock !== null) return true; // Already active
            wakeLock = await navigator.wakeLock.request('screen');
            wakeLock.addEventListener('release', () => {
                console.log('Native wake lock released by OS');
                wakeLock = null;
                // Auto-reacquire immediately if still enabled & visible
                if (isStayAwakeEnabled && document.visibilityState === 'visible') {
                    setTimeout(requestNativeWakeLock, 300);
                }
            });
            console.log('Native Screen Wake Lock acquired');
            return true;
        } catch (err) {
            console.warn('Native Screen Wake Lock error:', err.message);
        }
    }
    return false;
}

// Layer 2: Canvas Video Stream Fallback (iOS Safari / Mobile support)
const SILENT_MP4 = 'data:video/mp4;base64,AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAAIZnJlZQAAAAhtZGF0AAAA1m1vb3YAAABsbXZoZAAAAAAAAAAAAAAAAAAAA+gAAAAAAAEAAAEAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIAAAAYdHJhawAAAFx0a2hkAAAAAwAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAABAbWRpYQAAACBtZGhkAAAAAAAAAAAAAAAAAAAoAAAAAAAAVcQAAAAAAC1oZGxyAAAAAAAAAAB2aWRlAAAAAAAAAAAAAAAAVmlkZW9IYW5kbGVyAAAAdm1pbmYAAAAUdm1oZAAAAAEAAAAAAAAAAAAAACRkaW5mAAAAHGRyZWYAAAAAAAAAAQAAAAx1cmwgAAAAAQAAADZzdGJsAAAAGnN0c2QAAAAAAAAAAQAAAAphdmMxAAAAAAAAAABoc3R0cwAAAAAAAAAAAAAUc3RzegAAAAAAAAAAAAAAAAAAFHN0Y28AAAAAAAAAAA==';

function setupVideoFallback() {
    if (hiddenVideo) return;

    hiddenVideo = document.createElement('video');
    hiddenVideo.setAttribute('playsinline', '');
    hiddenVideo.setAttribute('webkit-playsinline', 'true');
    hiddenVideo.setAttribute('muted', '');
    hiddenVideo.setAttribute('loop', '');
    hiddenVideo.setAttribute('autoplay', '');
    hiddenVideo.muted = true;
    hiddenVideo.playsInline = true;

    // Canvas capture stream for continuous video activity
    try {
        const dummyCanvas = document.createElement('canvas');
        dummyCanvas.width = 16;
        dummyCanvas.height = 16;
        const ctx = dummyCanvas.getContext('2d');
        let toggle = false;

        canvasInterval = setInterval(() => {
            if (!isStayAwakeEnabled) return;
            toggle = !toggle;
            ctx.fillStyle = toggle ? '#000000' : '#000001';
            ctx.fillRect(0, 0, 16, 16);
        }, 1000);

        if (dummyCanvas.captureStream) {
            canvasStream = dummyCanvas.captureStream(5);
            hiddenVideo.srcObject = canvasStream;
        } else {
            hiddenVideo.src = SILENT_MP4;
        }
    } catch (e) {
        hiddenVideo.src = SILENT_MP4;
    }

    hiddenVideo.style.position = 'fixed';
    hiddenVideo.style.top = '-10px';
    hiddenVideo.style.left = '-10px';
    hiddenVideo.style.width = '2px';
    hiddenVideo.style.height = '2px';
    hiddenVideo.style.opacity = '0.01';
    hiddenVideo.style.pointerEvents = 'none';

    document.body.appendChild(hiddenVideo);
}

function playVideoFallback() {
    if (!isStayAwakeEnabled) return;
    if (!hiddenVideo) setupVideoFallback();
    if (hiddenVideo && hiddenVideo.paused) {
        hiddenVideo.play().then(() => {
            console.log('Video keep-awake loop active');
        }).catch(err => {
            console.warn('Video keep-awake play pending user gesture:', err.message);
        });
    }
}

function stopVideoFallback() {
    if (hiddenVideo) {
        hiddenVideo.pause();
        hiddenVideo.removeAttribute('src');
        hiddenVideo.srcObject = null;
        if (hiddenVideo.parentNode) hiddenVideo.parentNode.removeChild(hiddenVideo);
        hiddenVideo = null;
    }
    if (canvasInterval) {
        clearInterval(canvasInterval);
        canvasInterval = null;
    }
}

// Layer 3: Web Audio Silent Keep-Alive Context
function startAudioKeepAlive() {
    if (!isStayAwakeEnabled) return;
    try {
        if (!audioCtx) {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (AudioContextClass) {
                audioCtx = new AudioContextClass();
                // Create silent buffer loop
                const buffer = audioCtx.createBuffer(1, 44100, 44100);
                const source = audioCtx.createBufferSource();
                source.buffer = buffer;
                source.loop = true;
                source.connect(audioCtx.destination);
                source.start(0);
            }
        }
        if (audioCtx && audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
    } catch (e) {
        console.warn('AudioContext keep-alive error:', e);
    }
}

function stopAudioKeepAlive() {
    if (audioCtx) {
        try {
            audioCtx.close();
        } catch (e) {}
        audioCtx = null;
    }
}

// Master Wake Lock activation function
async function ensureWakeLock() {
    if (!isStayAwakeEnabled) return;

    // Try native API
    await requestNativeWakeLock();

    // Also run Video & Audio fallbacks for iOS / Safari protection
    setupVideoFallback();
    playVideoFallback();
    startAudioKeepAlive();
}

function releaseAllWakeLocks() {
    if (wakeLock) {
        try {
            wakeLock.release();
        } catch (e) {}
        wakeLock = null;
    }
    stopVideoFallback();
    stopAudioKeepAlive();
}

// ── UI Lock Button Toggle ────────────────────────────────

function updateLockUI() {
    if (isStayAwakeEnabled) {
        lockBtn.classList.add('locked');
        lockIconLocked.style.display = 'block';
        lockIconUnlocked.style.display = 'none';
        lockBtn.setAttribute('title', 'Screen Lock: ALWAYS ON (iPad will not sleep)');
    } else {
        lockBtn.classList.remove('locked');
        lockIconLocked.style.display = 'none';
        lockIconUnlocked.style.display = 'block';
        lockBtn.setAttribute('title', 'Screen Lock: DISABLED');
    }
}

lockBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    isStayAwakeEnabled = !isStayAwakeEnabled;
    updateLockUI();

    if (isStayAwakeEnabled) {
        ensureWakeLock();
        showToast('Screen Lock: ON 🔒 (iPad will stay awake)');
    } else {
        releaseAllWakeLocks();
        showToast('Screen Lock: OFF 🔓');
    }
});

// Initialize UI
updateLockUI();

// ── User Interaction & Health Check Triggers ──────────────

function onUserInteraction() {
    if (isStayAwakeEnabled) {
        ensureWakeLock();
    }
}

window.addEventListener('click', onUserInteraction);
window.addEventListener('touchstart', onUserInteraction, { passive: true });
window.addEventListener('pointerdown', onUserInteraction, { passive: true });

// Page Visibility Change Listener
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && isStayAwakeEnabled) {
        ensureWakeLock();
    }
});

// Periodic Health Check (Runs every 8 seconds to prevent iOS sleep drops)
setInterval(() => {
    if (isStayAwakeEnabled && document.visibilityState === 'visible') {
        if (!wakeLock && 'wakeLock' in navigator) {
            requestNativeWakeLock();
        }
        if (hiddenVideo && hiddenVideo.paused) {
            playVideoFallback();
        }
        if (audioCtx && audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
    }
}, 8000);

// Auto-start on load
ensureWakeLock();

