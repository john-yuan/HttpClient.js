var builder = require('@john-yuan/dev-browserify-builder');

builder.build('lib/class/HttpClient.js', 'dist/HttpClient.min.js', {
    standalone: 'HttpClient',
    debug: false,
    detectGlobals: false,
    plugin: [ 'bundle-collapser/plugin' ]
}, {
    compress: {
        drop_console: true
    }
});
