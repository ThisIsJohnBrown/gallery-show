const width = 640;
const height = 480;

const canvas = document.getElementsByClassName('js-canvas')[0];
const context = canvas.getContext('2d');
let streamImage = new Image();
streamImage.onload = function () {
    // context.drawImage(streamImage, 0, 0);
    // drawPoints();
};
const imgStream = document.getElementsByClassName('js-stream')[0]

canvas.width = width;
canvas.height = height;
activeAreas = [false, false, false, false];
noImage = false;

var exampleSocket = new WebSocket(`ws://${window.location.hostname}:8080`, "protocolOne");
exampleSocket.onmessage = function (e) {
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
        areas = data.data;
    }
    // context.drawImage('data:image/png;base64,' + data.camData.substr(2, data.camData.length - 3), 0, 0);
    // imgStream.setAttribute('src', 'data:image/png;base64,' + data.camData.substr(2, data.camData.length - 3));
}

let areas = [];
let currentArea = -1;

drawPoints = () => {
    for (const [i, area] of areas.entries()) {
        const points = area.points;
        if (points.length !== 0) {
            context.beginPath();
            context.moveTo(points[0][0], points[0][1]);
            points.map((point, i) => {
                if (i > 0) {
                    context.lineTo(point[0], point[1]);
                }
            })
            context.lineTo(points[0][0], points[0][1]);
            context.strokeStyle = `rgba(${area.rgb.join(', ')}, 1)`;
            context.stroke();
            context.fillStyle = `rgba(${area.rgb.join(', ')}, ${activeAreas[i] ? .5 : .1})`;
            context.fill();
            context.closePath();
        }
    }

}

canvas.addEventListener("mousedown", (e) => {
    if (currentArea !== -1) {
        areas[currentArea].points.push([e.offsetX, e.offsetY])
    }
});

let drawButtons = document.getElementsByClassName('js-draw-button');
for (let button of drawButtons) {
    button.addEventListener('mousedown', (e) => {
        currentArea = parseInt(e.target.dataset.id, 10);
        areas[currentArea].points = [];
    })
}

let saveButtons = document.getElementsByClassName('js-save-button');
for (let button of saveButtons) {
    button.addEventListener('mousedown', (e) => {
        currentArea = -1;
        exampleSocket.send(JSON.stringify({
            "event": "updateAreas",
            "data": areas
        }));
    })
}

draw = () => {
    context.fillStyle = 'rgb(0, 0, 0)';
    context.fillRect(0, 0, width, height);
    if (!noImage) {
        context.drawImage(streamImage, 0, 0);
    }
    drawPoints();
    window.requestAnimationFrame(draw);
}

draw();