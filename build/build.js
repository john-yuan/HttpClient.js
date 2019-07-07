var builder = require('@john-yuan/dev-browserify-builder');

builder.build('lib/index.js', 'dist/HttpClient.min.js', {
    standalone: 'HttpClient',
    debug: false,
    detectGlobals: false
}, {
    compress: {
        drop_console: true
    }
});
