const width = 640;
const height = 480;

const canvas = document.getElementsByClassName('js-canvas')[0];
const context = canvas.getContext('2d');
let streamImage = new Image(width, height);
streamImage.onload = function () {
    // context.drawImage(streamImage, 0, 0);
    // drawPoints();
};

canvas.width = width;
canvas.height = height;
activeAreas = [false, false, false, false];
noImage = false;

var socket = new WebSocket(`ws://${window.location.hostname}:8080`, "protocolOne");
socket.onmessage = function (e) {
    const data = JSON.parse(e.data)
    if (data.event == 'camUpdate') {
        if (data.data.camData) {
            noImage = false;
            streamImage.src = 'data:image/png;base64,' + data.data.camData.substr(2, data.data.camData.length - 3);

        } else {
            noImage = true;
        }
        for (let i = 0; i < activeAreas.length; i++) {
            activeAreas[i] = data.data.movement.indexOf(i) === -1 ? false : true;
        }
    } else if (data.event == 'shapeData') {
        if (areas.length === 0) {
            initButtons(data.data);
        }
        areas = data.data;
    }
}

let areas = [];
let currentArea = -1;

drawPoints = () => {
    for (const [i, area] of areas.entries()) {
        const points = area.points;

        if (points.length !== 0) {
            const mid = getCentroid(points);
            context.beginPath();
            context.moveTo(points[0][0] * 2, points[0][1] * 2);
            points.map((point, i) => {
                if (i > 0) {
                    context.lineTo(point[0] * 2, point[1] * 2);
                }
            })
            context.lineTo(points[0][0] * 2, points[0][1] * 2);
            context.lineWidth = 4;
            context.strokeStyle = `rgba(0, 0, 0, 1)`;
            context.stroke();
            context.lineWidth = 2;
            context.strokeStyle = `rgba(255, 255, 255, 1)`;
            context.stroke();
            context.fillStyle = `rgba(255, 255, 255, ${activeAreas[i] ? .5 : .1})`;
            context.fill();
            context.closePath();
            context.fillStyle = 'black';
            context.strokeStyle = 'white';
            context.font = '24px Roboto';
            context.strokeText(i + 1, mid.x * 2 - 12, mid.y * 2);
            context.fillText(i + 1, mid.x * 2 - 12, mid.y * 2);
        }
    }

}

canvas.addEventListener("mousedown", (e) => {
    if (currentArea !== -1) {
        areas[currentArea].points.push([e.offsetX / 2, e.offsetY / 2])
    }
});

initButtons = (areas) => {
    let drawButtons = document.getElementsByClassName('js-draw-button');
    let saveButtons = document.getElementsByClassName('js-save-button');
    areas.forEach((area, i) => {
        // drawButtons[i].style.backgroundColor = `rgba(${area.rgb[0]}, ${area.rgb[1]}, ${area.rgb[2]}, 1)`
        // saveButtons[i].style.backgroundColor = `rgba(${area.rgb[0]}, ${area.rgb[1]}, ${area.rgb[2]}, 1)`
        drawButtons[i].addEventListener('mousedown', (e) => {
            console.log(e);
            if (currentArea !== -1) {
                // socket.send(JSON.stringify({
                //     "event": "updateAreas",
                //     "data": areas
                // }));
            }
            currentArea = parseInt(e.target.dataset.id, 10) - 1;
            areas[currentArea].points = [];
        })
    })
    saveButtons[0].addEventListener('mousedown', (e) => {
        currentArea = -1;
        socket.send(JSON.stringify({
            "event": "updateAreas",
            "data": areas
        }));
    })
}

draw = () => {
    context.fillStyle = 'rgb(0, 0, 0)';
    context.fillRect(0, 0, width, height);
    if (!noImage) {
        context.drawImage(streamImage, 0, 0, 320, 240, 0, 0, width, height);
    }
    drawPoints();
    window.requestAnimationFrame(draw);
}

draw();

var sliders = document.getElementsByClassName('js-mdc-slider');
for (let i = 0; i < sliders.length; i++) {
    slider = sliders[i];
    new mdc.slider.MDCSlider(slider);
}

var updateFlags = document.getElementsByClassName('js-update-flags');
for (let i = 0; i < updateFlags.length; i++) {
    flag = updateFlags[i];
    flag.addEventListener('mousedown', updateFlag, false);
}

function updateFlag(e) {
    let data = {};
    data[e.target.dataset.flag] = true;
    socket.send(JSON.stringify({
        "event": "updateFlags",
        "data": data
    }));
    console.log(data);
}

var fileUploads = document.getElementsByClassName('js-file');
for (let i = 0; i < fileUploads.length; i++) {
    upload = fileUploads[i];
    upload.addEventListener('change', fileChange, false);
}

var audioFileUploads = document.getElementsByClassName('js-audio-file');
for (let i = 0; i < audioFileUploads.length; i++) {
    upload = audioFileUploads[i];
    upload.addEventListener('change', audioFileChange, false);
}

function fileChange(e) {
    const id = getClosest(e.target, '.js-upload-form').dataset.id;
    const progressBar = document.querySelectorAll('.js-progress-bar')[id];
    progressBar.classList.add('mdc-linear-progress--indeterminate')
    const file = e.target.files[0];
    handleFiles(file, id);
}

function audioFileChange(e) {
    const file = e.target.files[0];
    handleAudioFile(file);
}

var videos = document.getElementsByClassName('js-video');
for (let i = 0; i < videos.length; i++) {
    video = videos[i];
    var source = document.createElement('source');
    source.setAttribute('src', `/videos/video-${i}.mp4?${(new Date()).getTime()}`);
    video.appendChild(source);
}

let wrappers = document.getElementsByClassName('js-video-wrapper');

for (let i = 0; i < wrappers.length; i++) {
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        wrappers[i].addEventListener(eventName, preventDefaults, false)
    });
    ['dragenter'].forEach(eventName => {
        wrappers[i].addEventListener(eventName, highlight, false)
    });
    ['dragleave', 'drop'].forEach(eventName => {
        wrappers[i].addEventListener(eventName, unhighlight, false)
    });
    wrappers[i].addEventListener('drop', handleDrop, false)
}

////////////////////////////
//  Flash Screen buttons
////////////////////////////
let flashScreens = document.getElementsByClassName('js-flash-screen');
for (let i = 0; i < flashScreens.length; i++) {
    flashScreens[i].addEventListener('click', flashScreen, false)
}

function flashScreen(e) {
    preventDefaults(e);
    socket.send(JSON.stringify({
        "event": "flashScreen",
        "data": {
            id: parseInt(e.target.dataset.id, 10)
        }
    }));
}

////////////////////////////
//  Reset Screen buttons
////////////////////////////
let resetScreens = document.getElementsByClassName('js-reset-screen');
for (let i = 0; i < resetScreens.length; i++) {
    resetScreens[i].addEventListener('click', resetScreen, false)
}

function resetScreen(e) {
    preventDefaults(e);
    socket.send(JSON.stringify({
        "event": "resetScreen",
        "data": {
            id: parseInt(e.target.dataset.id, 10)
        }
    }));
}

////////////////////////////
//  Toggle Audio buttons
////////////////////////////
let toggleAudios = document.getElementsByClassName('js-toggle-audio');
for (let i = 0; i < toggleAudios.length; i++) {
    toggleAudios[i].addEventListener('click', toggleAudio, false)
}

function toggleAudio(e) {
    preventDefaults(e);
    socket.send(JSON.stringify({
        "event": "toggleAudio",
        "data": {}
    }));
}

////////////////////////////
//  File Upload Handling
////////////////////////////
function handleDrop(e) {
    const dt = e.dataTransfer
    const files = dt.files
    const id = getClosest(e.target, '.js-video-wrapper').dataset.id;
    handleFiles(files[0], id)
}

function handleFiles(file, id) {
    var formData = new FormData();
    var xhr = new XMLHttpRequest();

    formData.append("id", id)
    formData.append("video", file, file.name);
    console.log(formData, id, file.name);
    xhr.open("POST", `http://${window.location.host}/uploadVideo`, true);
    xhr.onloadend = function () {
        console.log('complete!');
        window.location = window.location;
    }

    xhr.send(formData);
}

function handleAudioFile(file) {
    var formData = new FormData();
    var xhr = new XMLHttpRequest();

    formData.append("audio", file, file.name);
    xhr.open("POST", `http://${window.location.host}/uploadAudio`, true);
    xhr.onloadend = function () {
        console.log('complete!');
        window.location = window.location;
    }

    xhr.send(formData);
}

let counter = 0;
function highlight(e) {
    counter++;
    getClosest(e.target, '.js-video-wrapper').classList.add('highlight')
}

function unhighlight(e) {
    counter--;
    if (counter === 0) {
        getClosest(e.target, '.js-video-wrapper').classList.remove('highlight')
    }
}

function preventDefaults(e) {
    e.preventDefault()
    e.stopPropagation()
}

function getCentroid(pts) {
    let points = pts.map(p => p);
    var first = points[0], last = points[points.length - 1];
    if (first[0] != last[0] || first[1] != last[1]) points.push(first);
    var twicearea = 0,
        x = 0, y = 0,
        npoints = points.length,
        p1, p2, f;
    for (var i = 0, j = npoints - 1; i < npoints; j = i++) {
        p1 = points[i]; p2 = points[j];
        f = (p1[1] - first[1]) * (p2[0] - first[0]) - (p2[1] - first[1]) * (p1[0] - first[0]);
        twicearea += f;
        x += (p1[0] + p2[0] - 2 * first[0]) * f;
        y += (p1[1] + p2[1] - 2 * first[1]) * f;
    }
    f = twicearea * 3;
    return { x: x / f + first[0], y: y / f + first[1] };
}

var getClosest = function (elem, selector) {
    if (!Element.prototype.matches) {
        Element.prototype.matches =
            Element.prototype.matchesSelector ||
            Element.prototype.mozMatchesSelector ||
            Element.prototype.msMatchesSelector ||
            Element.prototype.oMatchesSelector ||
            Element.prototype.webkitMatchesSelector ||
            function (s) {
                var matches = (this.document || this.ownerDocument).querySelectorAll(s),
                    i = matches.length;
                while (--i >= 0 && matches.item(i) !== this) { }
                return i > -1;
            };
    }
    for (; elem && elem !== document; elem = elem.parentNode) {
        if (elem.matches(selector)) return elem;
    }
    return null;
};

new mdc.tabBar.MDCTabBar(document.querySelector('.mdc-tab-bar'));