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
        let timeout = 0;

        if (req.query && req.query.timeout) {
            timeout = +req.query.timeout || 0;
        }
        if (timeout > 0) {
            setTimeout(function () {
                res.send({
                    timeout: timeout,
                    method: req.method,
                    query: req.query,
                    path: req.path,
                    headers: req.headers,
                    body: req.body
                });
            }, timeout);
        } else {
            res.send({
                timeout: 0,
                method: req.method,
                query: req.query,
                path: req.path,
                headers: req.headers,
                body: req.body
            });
        }
    });
}

exports.defineServices = defineServices;
