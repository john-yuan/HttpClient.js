/**
 * JSONPResponse module.
 *
 * @module class/JSONPResponse
 */

var Response = require('./Response');
var inherits = require('../shared/inherits');
var addCustomMixin = require('../shared/addCustomMixin');

/**
 * The JSONPResponse class.
 *
 * @class
 * @param {JSONRequest} request The http request.
 */
function JSONPResponse(request) {
    Response.call(this, request);
    addCustomMixin(this, request.options, 'jsonpResponseMixin');
}

inherits(JSONPResponse, Response);

module.exports = JSONPResponse;
