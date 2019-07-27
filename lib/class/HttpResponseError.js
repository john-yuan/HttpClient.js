var ResponseError = require('./ResponseError');
var inherits = require('../shared/inherits');
var addMixin = require('../shared/addMixin');

/**
 * @class
 * @param {string} code The error code.
 * @param {HttpRequest} request The http request.
 */
function HttpResponseError(code, request) {
    ResponseError.call(this, code, request);
    addMixin(this, request.options, 'httpResponseErrorMixin');
}

inherits(HttpResponseError, ResponseError);

module.exports = HttpResponseError;
