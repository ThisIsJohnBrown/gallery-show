const urlParams = new URLSearchParams(window.location.search);
const id = parseInt(urlParams.get('id'), 10);
let currentVisual = { perc: 0 }
let currentTween;

let socket = new WebSocket(`ws://${window.location.hostname}:8080`, "protocolOne");
socket.onopen = () => {
    socket.send(JSON.stringify({
        event: "connectInfo",
        data: {
            camera: false,
            videoId: id
        }
    }))
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
    }
}

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