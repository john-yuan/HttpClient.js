/**
 * HttpResponse module.
 *
 * @module class/HttpResponse
 */

var Response = require('./Response');
var inherits = require('../shared/inherits');
var addCustomMixin = require('../shared/addCustomMixin');

/**
 * The HttpResponse class.
 *
 * @class
 * @param {HttpRequest} request The http request.
 */
function HttpResponse(request) {
    Response.call(this, request);
    addCustomMixin(this, request.options, 'httpResponseMixin');
}

inherits(HttpResponse, Response);

module.exports = HttpResponse;
