var bodyParser = require('body-parser');


/**
 * Define services for testing.
 *
 * @param {Express} app An instance of Express.
 */
function defineServices(app) {
    // parse application/x-www-form-urlencoded
    app.use(bodyParser.urlencoded({ extended: false }))

    // parse application/json
    app.use(bodyParser.json())


    app.get('/api/get/greeting', function (req, res) {
        res.send({
            message: 'hello'
        });
    });

    app.post('/api/post/greeting', function (req, res) {
        res.send({
            message: 'hello'
        });
    });

    app.all('/api/all/echo*', function (req, res) {
        res.send({
            method: req.method,
            query: req.query,
            path: req.path,
            headers: req.headers,
            body: req.body
        });
    });
}

exports.defineServices = defineServices;
