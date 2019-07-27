var ResponseError = require('./ResponseError');
var inherits = require('../shared/inherits');
var addMixin = require('../shared/addMixin');

/**
 * @class
 * @param {string} code The error code.
 * @param {JSONPRequest} request The JSONP request.
 */
function JSONPResponseError(code, request) {
    ResponseError.call(this, code, request);
    addMixin(this, request.options, 'jsonpResponseErrorMixin');
}

inherits(ResponseError, JSONPResponseError);

module.exports = JSONPResponseError;
