var nodewebcam = require("node-webcam");
var opts = {
    width: 640,
    height: 480,
    quality: 10,
    delay: 0,
    saveShots: true,
    output: "png",
    device: false,
    callbackReturn: "buffer",
    verbose: false
};


//Creates webcam instance

var webcam = nodewebcam.create(opts);

webcam.capture("test_picture", function (err, data) { });