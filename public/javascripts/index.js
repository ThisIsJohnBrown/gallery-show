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

var exampleSocket = new WebSocket("ws://localhost:8080", "protocolOne");
exampleSocket.onmessage = function (e) {
    const data = JSON.parse(e.data)
    if (data.event == 'camData') {
        streamImage.src = 'data:image/png;base64,' + data.data.substr(2, data.data.length - 3);
    } else if (data.event == 'shapeData') {
        areas = data.data;
    }
    // context.drawImage('data:image/png;base64,' + data.camData.substr(2, data.camData.length - 3), 0, 0);
    // imgStream.setAttribute('src', 'data:image/png;base64,' + data.camData.substr(2, data.camData.length - 3));
}

let areas = [];
let currentArea = -1;

drawPoints = () => {
    for (let area of areas) {
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
            context.fillStyle = `rgba(${area.rgb.join(', ')}, .3)`;
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
    context.drawImage(streamImage, 0, 0);
    drawPoints();
    window.requestAnimationFrame(draw);
}

draw();