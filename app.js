const createError = require('http-errors');
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const sassMiddleware = require('node-sass-middleware');
const fs = require('fs');
const util = require("util");
var async = require('async');
var lame = require('lame');
var debug = require('debug')('newserver:server');
var http = require('http');

// let shapeData = JSON.parse(fs.readFileSync('/home/pi/gallery-show/shape_config.json'));
let shapeData = JSON.parse(fs.readFileSync('shape_config.json'));
let currentMovement = [];

// var audioOptions = {
//   channels: 2,
//   bitDepth: 16,
//   sampleRate: 44100,
//   mode: lame.STEREO
// };


// var song = 'public/audio/background.mp3';

// function playStream(input, options) {
//   var decoder = lame.Decoder();
//   options = options || {};
//   var v = new volume();
//   if (options.volume) {
//     v.setVolume(options.volume);
//   }
//   var speaker = new Speaker(audioOptions);
//   // speaker.on('finish', function () {
//   //   console.log('finish!');
//   //   if (options.loop) {
//   //     console.log('loop');
//   //     // i want to restart here
//   //     start();
//   //   }
//   // });
//   function start() {
//     //input.pos = 0;
//     console.dir(input);
//     v.pipe(speaker);
//     decoder.pipe(v);
//     input.pipe(decoder);
//   }
//   start();

//   return v;
// }

// var inputStream = fs.createReadStream(song);

// let v = playStream(inputStream, {
//   volume: 1,
//   loop: true
// });

// setSound = () => {
//   // console.log('setSound: ', currentMovement.length, v.volume);
//   if (v.volume >= 0 && currentMovement.length === 0) {
//     v.setVolume(v.volume - .01);
//   } else if (v.volume < 1 && currentMovement.length > 0) {
//     v.setVolume(v.volume + .01);
//   }
//   setTimeout(setSound, 30);
// }

// setSound();

const indexRouter = require('./routes/index');
const usersRouter = require('./routes/users');

const app = express();
var multer = require('multer')

const WebSocket = require('ws');

// const process = spawn('sh', ['-c', "nmap -sP 192.168.7.0/24"]);
// let ipString = '';
// process.stdout.on('data', (data) => {
//   ipString += data.toString();

// });
// process.on('close', (data) => {
//   console.log(ipString);

//   const regex = /[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}/gm;
//   var results = ipString.match(regex);
//   console.log(results);
// });
// process.stderr.on('data', (data) => {
//   console.log(`stderr: ${data}`);
// });

const wss = new WebSocket.Server({
  port: 8080,
  perMessageDeflate: {
    zlibDeflateOptions: {
      // See zlib defaults.
      chunkSize: 1024,
      memLevel: 7,
      level: 3
    },
    zlibInflateOptions: {
      chunkSize: 10 * 1024
    },
    // Other options settable:
    clientNoContextTakeover: true,// Defaults to negotiated value.
    serverNoContextTakeover: true,// Defaults to negotiated value.
    serverMaxWindowBits: 10,// Defaults to negotiated value.
    // Below options specified as default values.
    concurrencyLimit: 10,// Limits zlib concurrency for perf.
    threshold: 1024// Size (in bytes) below which messages
    // should not be compressed.
  }
});

let videoIps = {};

updateIps = () => {
  // console.log(Object.keys(videoIps));
  wss.clients.forEach(function each(client) {
    client.send(JSON.stringify({
      event: 'updateIps',
      data: Object.keys(videoIps)
    }))
  });
}

wss.on('connection', function connection(ws) {
  console.log('user found!')



  ws.send(JSON.stringify({
    event: "shapeData",
    data: shapeData
  }))

  ws.on('message', function incoming(rawData) {
    const data = JSON.parse(rawData);
    let updatedMovement = [{}, {}, {}, {}];
    if (data.event === 'updateAreas') {
      shapeData = data.data;
      fs.writeFileSync('shape_config.json', JSON.stringify(shapeData))
    } else if (data.event === 'flashScreen') {
      console.log(data.data.id);
    } else if (data.event === 'videoConnectInfo') {
      const keys = Object.keys(data.data)
      keys.forEach((key) => {
        this[key] = data.data[key];
      })

      const regex = /[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}/gm;
      var ip = this._socket.remoteAddress.match(regex);
      if (ip.length) {
        videoIps[ip[0]] = this;
      }
      updateIps();
    } else if (data.event === 'camUpdate') {
      for (let i = 0; i < shapeData.length; i++) {
        const inNew = data.data.movement.indexOf(i) !== -1;
        const inOld = currentMovement.indexOf(i) !== -1;
        if (inNew && !inOld) {
          updatedMovement[i] = {
            videoId: i,
            event: 'videoPlay'
          };
        } else if (inOld && !inNew) {
          updatedMovement[i] = {
            videoId: i,
            event: 'videoPause'
          };
        }
      }
      currentMovement = data.data.movement;

      // if (oldMovements.length === 0 && currentMovements.length > 0) {
      //   fadeInSound();
      // } else if (currentMovements.length === 0 && oldMovements.length > 0) {
      //   fadeOutSound();
      // }
    }
    wss.clients.forEach(function each(client) {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        if (data.event === 'camUpdate' && client.camera === false) {
          let moveData = updatedMovement[client.videoId];
          // console.log(moveData);
          if (moveData) {
            client.send(JSON.stringify({
              event: moveData.event,
              data: {
                videoId: moveData.videoId
              }
            }))
          }
        } else {
          client.send(rawData);
        }
      }
    });
  });
});

// setInterval(() => {
//   wss.clients.forEach(function each(client) {
//     client.send(JSON.stringify({
//       event: 'test',
//       data: {
//         'foo': 'bar'
//       }
//     }))
//   });
// }, 1000);

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'hbs');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(sassMiddleware({
  src: path.join(__dirname, 'public'),
  dest: path.join(__dirname, 'public'),
  indentedSyntax: true, // true = .sass and false = .scss
  sourceMap: true
}));
app.use(express.static(path.join(__dirname, 'public')));

var videoStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'public/videos/')
  },
  filename: function (req, file, cb) {
    cb(null, 'video-' + req.body.id + '.mp4')
  }
})

var audioStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'public/audio/')
  },
  filename: function (req, file, cb) {
    cb(null, 'background.mp3')
  }
})

var videoUpload = multer({
  storage: videoStorage,
  fileFilter: function (req, file, cb) {
    console.log(`uploading a ${file.mimetype} file, video`);
    if (file.mimetype !== 'video/mp4') {
      req.fileValidationError = 'goes wrong on the mimetype';
      return cb(null, false, new Error('goes wrong on the mimetype'));
    }
    wss.clients.forEach(function each(client) {
      client.send(JSON.stringify({
        event: 'newVideoUpload',
        data: {
          id: req.body.id
        }
      }))
    });
    cb(null, true);
  }
})

var audioUpload = multer({
  storage: audioStorage,
  fileFilter: function (req, file, cb) {
    console.log(`uploading a ${file.mimetype} file, audio`);
    if (file.mimetype !== 'audio/mp3') {
      req.fileValidationError = 'goes wrong on the mimetype';
      return cb(null, false, new Error('goes wrong on the mimetype'));
    }
    cb(null, true);
  }
})

app.post('/uploadVideo', videoUpload.single('video'), function (req, res, next) {
  res.redirect(req.headers.referer);
})

app.post('/uploadAudio', audioUpload.single('audio'), function (req, res, next) {
  res.redirect(req.headers.referer);
})

app.use('/', indexRouter);
app.use('/users', usersRouter);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});




function onError(error) {
  if (error.syscall !== 'listen') {
    throw error;
  }

  var bind = typeof port === 'string'
    ? 'Pipe ' + port
    : 'Port ' + port;

  // handle specific listen errors with friendly messages
  switch (error.code) {
    case 'EACCES':
      console.error(bind + ' requires elevated privileges');
      process.exit(1);
      break;
    case 'EADDRINUSE':
      console.error(bind + ' is already in use');
      process.exit(1);
      break;
    default:
      throw error;
  }
}

function onListening() {
  var addr = server.address();
  var bind = typeof addr === 'string'
    ? 'pipe ' + addr
    : 'port ' + addr.port;
  debug('Listening on ' + bind);
}

var port = process.env.PORT || '3000';
app.set('port', port);

var server = http.createServer(app);

server.listen(port);
server.on('error', onError);
server.on('listening', onListening);