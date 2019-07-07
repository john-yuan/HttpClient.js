var isFunction = require('x-common-utils/isFunction');
var isAbsoluteURL = require('x-common-utils/isAbsoluteURL');
var isPlainObject = require('x-common-utils/isPlainObject');

/**
 * The function to build request url.
 *
 * 1. Add baseURL if needed.
 * 2. Compile url if needed.
 * 3. Compile query string if needed.
 *
 * @param {RequestOptions} options The request options.
 * @returns {string} Returns the final url string.
 */
function buildURL(options) {
    var url = (typeof options.url === 'string') ? options.url : '';
    var baseURL = options.baseURL;
    var param = options.param;
    var query = options.query;
    var compileURL = options.compileURL;
    var encodeQueryString = options.encodeQueryString;
    var array;

    // If the url is not absolute url and the baseURL is defined,
    // prepend the baseURL to the url.
    if (!isAbsoluteURL(url)) {
        if (typeof baseURL === 'string') {
            url = baseURL + url;
        }
    }

    // Compile the url if needed.
    if (isPlainObject(param) && isFunction(compileURL)) {
        url = compileURL(url, param, options);
    }

    // Compile the query string.
    if (isPlainObject(query) && isFunction(encodeQueryString)) {
        query = encodeQueryString(query, options);
        array = url.split('#'); // There may be something hash string in the url.
        url = array[0];

        if (url.indexOf('?') > -1) {
            // Check whether the url is ending with a `&`.
            if (/&+$/.test(url)) {
                url = url + query;
            } else {
                url = url + '&' + query;
            }
        } else {
            url = url + '?' + query;
        }

        array[0] = url;
        url = array.join('#');
    }

    return url;
}

module.exports = buildURL;
