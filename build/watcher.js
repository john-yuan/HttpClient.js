var watcher = require('@john-yuan/dev-browserify-watcher');

var watch = function () {
    watcher.watch({
        entry: 'lib/index.js',
        output: 'dist/HttpClient.js',
        paths: 'lib/**/*.js',
        browserifyOptions: {
            standalone: 'HttpClient',
            debug: true,
            detectGlobals: false,
            plugin: [ 'bundle-collapser/plugin' ]
        }
    });
};

exports.watch = watch;
