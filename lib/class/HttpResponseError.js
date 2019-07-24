var ResponseError = require('./ResponseError');
var inherits = require('../shared/inherits');
var addCustomMixin = require('../shared/addCustomMixin');

/**
 * @class
 * @param {string} code The error code.
 * @param {HttpRequest} request The http request.
 */
function HttpResponseError(code, request) {
    ResponseError.call(this, code, request);
    addCustomMixin(this, request.options, 'httpResponseErrorMixin');
}

inherits(HttpResponseError, ResponseError);

module.exports = HttpResponseError;
