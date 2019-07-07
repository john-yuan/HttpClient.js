/**
 * @param {Express} app
 */
function init(app) {
    app.get('/http/get/gretting/text', function (req, res) {
        res.send('Hello');
    });

    app.get('/http/get/gretting/json', function (req, res) {
        res.json({
            text: 'Hello'
        });
    });
}

exports.init = init;
