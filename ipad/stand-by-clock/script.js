const timeElement = document.getElementById('time');
const ampmElement = document.getElementById('ampm');
const fullscreenBtn = document.getElementById('fullscreen-btn');
const fullscreenIcon = document.getElementById('fullscreen-icon');
const exitFullscreenIcon = document.getElementById('exit-fullscreen-icon');
const body = document.body;

let controlsTimeout;

function updateClock() {
    const now = new Date();
    let hours = now.getHours();
    let minutes = now.getMinutes();
    
    const ampm = hours >= 12 ? 'PM' : 'AM';
    
    hours = hours % 12;
    hours = hours ? hours : 12; 
    
    const minutesStr = minutes < 10 ? '0' + minutes : minutes;
    
    timeElement.textContent = `${hours} : ${minutesStr}`;
    ampmElement.textContent = ampm;
    
    const seconds = now.getSeconds();
    const milliseconds = now.getMilliseconds();
    const timeToNextMinute = (60 - seconds) * 1000 - milliseconds;
    
    setTimeout(updateClock, timeToNextMinute);
}

updateClock();

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

function toggleFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
            console.log(`Error attempting to enable full-screen mode: ${err.message}`);
        });
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        }
    }
}

fullscreenBtn.addEventListener('click', toggleFullscreen);

document.addEventListener('fullscreenchange', () => {
    if (document.fullscreenElement) {
        fullscreenIcon.style.display = 'none';
        exitFullscreenIcon.style.display = 'block';
    } else {
        fullscreenIcon.style.display = 'block';
        exitFullscreenIcon.style.display = 'none';
    }
});
