const createError = require('http-errors');
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const sassMiddleware = require('node-sass-middleware');
const fs = require('fs');

const indexRouter = require('./routes/index');
const usersRouter = require('./routes/users');

const app = express();

const WebSocket = require('ws');

const { spawn } = require('child_process');

let shapeData = JSON.parse(fs.readFileSync('shape_config.json'))

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
    if (data.event === 'updateAreas') {
      shapeData = data.data;
      fs.writeFileSync('shape_config.json', JSON.stringify(shapeData))
    }
    wss.clients.forEach(function each(client) {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(rawData);
      }
    });
  });
});

const child = spawn('python', ['background.py']);

process.stdin.pipe(child.stdin)

child.stdout.on('data', (data) => {
  console.log(`child stdout:\n${data}`);
});

// setInterval(() => {
//   console.log('broadcasting!');
//   wss.clients.forEach(function each(client) {
//     if (client.readyState === WebSocket.OPEN) {
//       client.send((Math.random() * 3).toFixed(3));
//     }
//   });
// }, 3000)

// view engine setup
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
