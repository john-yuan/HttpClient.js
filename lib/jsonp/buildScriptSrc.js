var buildURL = require('../shared/buildURL');

/**
 * Build the JSONP script src.
 *
 * @param {RequestOptions} options The request opitons.
 * @param {string} callbackName The callback name of the JSONP.
 * @return {string} Returns the script src.
 */
function buildScriptSrc(options, callbackName) {
    // var username = options.username;
    // var password = options.password;
    // var link;
    var query = options.query;
    var key = options.jsonp;
    var url;

    if (!query) {
        query = {};
        options.query = query;
    }

    query[key] = callbackName;
    url = buildURL(options);

    return url;
}

module.exports = buildScriptSrc;
