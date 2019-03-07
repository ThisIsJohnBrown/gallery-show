var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', function (req, res, next) {
  res.render('index', {
    title: 'Camera Dashboard',
    scripts: [
      'index.js'
    ],
    name: 'index'
  });
});

router.get('/video', function (req, res, next) {
  res.render('video', {
    title: 'Gallery Video',
    scripts: [
      'video.js'
    ],
    name: 'video'
  });
});

router.get('/upload', function (req, res, next) {
  res.render('upload', {
    title: 'Gallery Upload',
    scripts: [
      'upload.js'
    ],
    name: 'upload'
  });
});

module.exports = router;
