var server = require('@john-yuan/dev-server');

var start = function (callback) {
    return server.start({
        port: 4003
    }, callback);
};

exports.start = start;
