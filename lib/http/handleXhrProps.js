var isPlainObject = require('x-common-utils/isPlainObject');
var hasOwn = Object.prototype.hasOwnProperty;

/**
 * The function to hanlde XMLHttpRequest properties.
 *
 * @param {XMLHttpRequest} xhr The instance of `XMLHttpRequest`.
 * @param {RequestOptions} options The request options.
 */
function handleXhrProps(xhr, options) {
    var prop;
    var xhrProps = options.xhrProps;

    if (options.cors) {
        xhr.withCredentials = true;
    }

    if (isPlainObject(xhrProps)) {
        for (prop in xhrProps) {
            if (hasOwn.call(xhrProps, prop)) {
                xhr[prop] = xhrProps[prop];
            }
        }
    }
}

module.exports = handleXhrProps;
