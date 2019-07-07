var isPlainObject = require('x-common-utils/isPlainObject');

/**
 * Represents response error.
 *
 * @constructor
 * @param {string} code The error code.
 * @param {Request} request The request.
 */
function ResponseError(code, request) {
    var options = request ? request.options : {};
    var errorMessages = options.errorMessages;
    var message;

    code = code || 'ERR_UNKNOWN';

    if (isPlainObject(errorMessages)) {
        if (errorMessages[code]) {
            message = errorMessages[code];
        }
    }

    if (!message) {
        message = 'Unknown error ' + code;
    }

    if (request) {
        request.errorCode = code;
    }

    this.code = code;
    this.request = request || null;
    this.message = message;
}

module.exports = ResponseError;
