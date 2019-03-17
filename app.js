const createError = require('http-errors');
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const sassMiddleware = require('node-sass-middleware');
const fs = require('fs');
const util = require("util");

const indexRouter = require('./routes/index');
const usersRouter = require('./routes/users');

const app = express();
var multer = require('multer')

const WebSocket = require('ws');

const { spawn } = require('child_process');

// sudo nmap -sP 192.168.7.0/24 | awk '/^Nmap/{ip=$NF}/B8:27:EB/{print ip}'
const process = spawn('sh', ['-c', "nmap -sP 192.168.7.0/24"]);

// sh -c nmap -sP 192.168.7.0/24 | awk '/^Nmap/{ip=$NF}/B8:27:EB/{print ip}'

// const nmap = spawn('nmap', ['-sP', '192.168.7.0/24']);
// const awk = spawn('awk', ["'/^Nmap/{ip=$NF}/B8:27:EB/{print ip}'"]);
// nmap.stdout.pipe(awk.stdin);

// const ips = spawn('nmap', ['-sP', '192.168.7.0/24', '|', 'awk', "'/^Nmap/{ip=$NF}/B8:27:EB/{print ip}'"]);

let ipString = '';

process.stdout.on('data', (data) => {
  ipString += data.toString();
  // console.log(`stdout: ${}`);
  // const dataString = data.toString();
  // const dataParts = dataString.toString().split('Nmap scan report for ')
  // dataParts.slice(1).forEach((part) => {
  //   console.log(part.split('\n')[0]);
  // })

});

process.on('close', (data) => {
  console.log(ipString);

  const regex = /[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}/gm;
  var results = ipString.match(regex);
  console.log(results);
});

process.stderr.on('data', (data) => {
  console.log(`stderr: ${data}`);
});

let shapeData = JSON.parse(fs.readFileSync('shape_config.json'))
let currentMovement = [];

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
    clientNoContextTakeover: true, // Defaults to negotiated value.
    serverNoContextTakeover: true, // Defaults to negotiated value.
    serverMaxWindowBits: 10, // Defaults to negotiated value.
    // Below options specified as default values.
    concurrencyLimit: 10, // Limits zlib concurrency for perf.
    threshold: 1024 // Size (in bytes) below which messages
    // should not be compressed.
  }
});

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
    } else if (data.event === 'connectInfo') {
      const keys = Object.keys(data.data)
      keys.forEach((key) => {
        this[key] = data.data[key];
      })
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
      currentMovement = data.data.movement
    }
    wss.clients.forEach(function each(client) {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        if (data.event === 'camUpdate' && client.camera === false) {
          let moveData = updatedMovement[client.videoId];
          if (moveData.event) {
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

var storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'public/videos/')
  },
  filename: function (req, file, cb) {
    cb(null, 'video-' + req.body.id + '.mp4')
  }
})

var upload = multer({
  storage: storage,
  fileFilter: function (req, file, cb) {
    if (file.mimetype !== 'video/mp4') {
      req.fileValidationError = 'goes wrong on the mimetype';
      return cb(null, false, new Error('goes wrong on the mimetype'));
    }
    cb(null, true);

  }
})

app.post('/uploadFile', upload.single('video'), function (req, res, next) {
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



module.exports = app;