/**
 * HttpResponse module.
 *
 * @module class/HttpResponse
 */

var Response = require('./Response');
var inherits = require('../shared/inherits');
var addCustomParser = require('../shared/addCustomParser');

/**
 * The HttpResponse class.
 *
 * @class
 * @param {HttpRequest} request The http request.
 */
function HttpResponse(request) {
    Response.call(this, request);
    addCustomParser(this, request.options, 'httpResponseParser');
}

inherits(HttpResponse, Response);

module.exports = HttpResponse;
