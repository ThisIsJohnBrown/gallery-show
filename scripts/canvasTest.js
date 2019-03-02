const { createCanvas, loadImage, Image } = require('canvas')
const canvas = createCanvas(1280, 720)
const ctx = canvas.getContext('2d')
const fs = require('fs')
const PNG = require('pngjs').PNG
const pixelmatch = require('pixelmatch');
const argv = require('yargs').argv

var nodewebcam = require("node-webcam");
var opts = {
    width: 640,
    height: 480,
    quality: 10,
    delay: 0,
    saveShots: false,
    output: "jpeg",
    device: false,
    callbackReturn: "base64",
    verbose: false
};

var webcam = nodewebcam.create(opts);

const points = [
    [
        [30, 30],
        [canvas.width - 30, 30],
        [canvas.width - 80, 200],
        [80, 200]
    ],
    [
        [30, canvas.height - 30],
        [canvas.width - 30, canvas.height - 30],
        [canvas.width - 80, canvas.height - 150],
        [80, canvas.height - 150],
    ]
]

let baselinesSaved = 0;
let baselineRawData;

let diffsChecked = 0;
let diffs = [];

baselineSaved = () => {
    baselinesSaved++;
    if (baselinesSaved < points.length) {
        baselineInit();
    }
}

baselineInit = () => {
    maskCanvas(baselinesSaved);

    const stream = canvas.createPNGStream();
    const out = fs.createWriteStream(__dirname + `/baseline-${baselinesSaved}.png`)
    stream.pipe(out)
    out.on('finish', () => baselineSaved())
}

diffEvaluated = () => {
    diffsChecked++;
    if (diffsChecked < points.length) {
        diffInit();
    } else {
        console.log(diffs);
        init();
    }
}

diffInit = () => {

    maskCanvas(diffsChecked);

    compare(diffsChecked);


}

maskCanvas = (id) => {
    var img = new Image();
    img.src = baselineRawData;

    ctx.globalCompositeOperation = 'source-over';

    ctx.drawImage(img, 0, 0)

    var maskCanvas = createCanvas(canvas.width, canvas.height)
    // Ensure same dimensions
    maskCanvas.width = canvas.width;
    maskCanvas.height = canvas.height;
    var maskCtx = maskCanvas.getContext('2d');

    // This color is the one of the filled shape
    maskCtx.fillStyle = "black";
    // Fill the mask
    maskCtx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);
    // Set xor operation
    maskCtx.globalCompositeOperation = 'xor';
    // Draw the shape you want to take out
    maskCtx.moveTo(points[id][0][0], points[id][0][1]);
    maskCtx.lineTo(points[id][1][0], points[id][1][1]);
    maskCtx.lineTo(points[id][2][0], points[id][2][1]);
    maskCtx.lineTo(points[id][3][0], points[id][3][1]);
    maskCtx.lineTo(points[id][0][0], points[id][0][1]);
    maskCtx.fill();

    // Draw mask on the image, and done !
    ctx.drawImage(maskCanvas, 0, 0);
}

compare = (id) => {
    let img1 = canvas.createPNGStream().pipe(new PNG()).on('parsed', () => {
        let img2 = fs.createReadStream(`scripts/baseline-${id}.png`).pipe(new PNG()).on('parsed', () => {
            var diff = new PNG({ width: img1.width, height: img1.height });

            var numDiffPixels = pixelmatch(img1.data, img2.data, diff.data, img1.width, img1.height, { threshold: 0.1 });
            diffs.push([numDiffPixels / calcPolygonArea(points[id])]);
            diff.pack().pipe(fs.createWriteStream(`scripts/diff-${id}.png`));
            diffEvaluated();
        });
    });

    // const stream = canvas.createPNGStream();
    // const out = fs.createWriteStream(__dirname + `/diff-${diffsChecked}.png`)
    // stream.pipe(out)
    // out.on('finish', () => diffEvaluated())
}

function calcPolygonArea(vertices) {
    var total = 0;

    for (var i = 0, l = vertices.length; i < l; i++) {
        var addX = vertices[i][0];
        var addY = vertices[i == vertices.length - 1 ? 0 : i + 1][1];
        var subX = vertices[i == vertices.length - 1 ? 0 : i + 1][0];
        var subY = vertices[i][1];

        total += (addX * addY * 0.5);
        total -= (subX * subY * 0.5);
    }

    return Math.abs(total);
}

let lastTime = (new Date()).getTime();

init = () => {
    const currTime = (new Date()).getTime();
    console.log(currTime - lastTime);
    lastTime = currTime;

    baselinesSaved = 0;
    baselineRawData;

    diffsChecked = 0;
    diffs = [];

    nodewebcam.capture("test_picture", opts, function (err, data) {
        baselineRawData = data;
        init();
        // if (argv.initial) {
        //     baselineInit();
        // } else {
        //     diffInit();
        // }
    });
}

init();