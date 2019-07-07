var api = require('./api');
var server = require('./server');
var watcher = require('./watcher');
var app = server.start(function () {
    console.log('');
    watcher.watch();
});

api.init(app);
