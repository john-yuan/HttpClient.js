/**
 * JSONPResponse module.
 *
 * @module class/JSONPResponse
 */

var Response = require('./Response');
var inherits = require('../shared/inherits');
var addCustomParser = require('../shared/addCustomParser');

/**
 * The JSONPResponse class.
 *
 * @class
 * @param {JSONRequest} request The http request.
 */
function JSONPResponse(request) {
    Response.call(this, request);
    addCustomParser(this, request.options, 'jsonpResponseParser');
}

inherits(JSONPResponse, Response);

module.exports = JSONPResponse;
