const urlParams = new URLSearchParams(window.location.search);
const id = parseInt(urlParams.get('id'), 10);
let currentVisual = { perc: 0 }
let currentTween;
let flash = null;

let socket;

initSocket = () => {
    socket = new WebSocket(`ws://${window.location.hostname}:8080`, "protocolOne");

    socket.onopen = () => {
        socket.send(JSON.stringify({
            event: "videoConnectInfo",
            data: {
                camera: false,
                videoId: id
            }
        }))
    }

    socket.onclose = () => {
        setTimeout(initSocket, 3000);
    }

    socket.onmessage = function (e) {
        const data = JSON.parse(e.data);
        console.log(data.event);
        if (data.event == 'videoPause') {
            if (data.data.videoId === id) {
                // videoElem.pause();
                currentTween = TweenLite.to(currentVisual, 1, {
                    perc: 0, onUpdate: () => {
                        videoElem.style.opacity = currentVisual.perc;
                        videoElem.volume = currentVisual.perc;
                    }, onComplete: () => {
                        videoElem.pause();
                    }
                })
            }
        } else if (data.event == 'videoPlay') {
            if (data.data.videoId === id) {
                playVideo();
                currentTween = TweenLite.to(currentVisual, 1, {
                    perc: 1, onUpdate: () => {
                        videoElem.style.opacity = currentVisual.perc;
                        videoElem.volume = currentVisual.perc;
                    }
                })
            }
        } else if (data.event == 'flashScreen') {
            if (data.data.id === id) {
                if (!flash) {
                    let screen = document.getElementsByClassName('js-screen')[0];
                    screen.classList.add('flash');
                    flash = setTimeout(removeFlash, 400);
                }
            }
        }
    }
}

let removeFlash = () => {
    let screen = document.getElementsByClassName('js-screen')[0];
    screen.classList.remove('flash');
    flash = null;
}

initSocket();

let videoElem = document.getElementsByClassName('js-video')[0]
async function playVideo() {
    try {
        await videoElem.play();
    } catch (err) {
        console.log(err, err.name);
    }
}

var video = document.getElementsByClassName('js-video')[0];
var source = document.createElement('source');

source.setAttribute('src', `/videos/video-${id}.mp4?${(new Date()).getTime()}`);

video.appendChild(source);