var Request = require('./Request');
var constants = require('../shared/constants');
var inherits = require('../shared/inherits');
var buildURL = require('../shared/buildURL');
var handleOptions = require('../shared/handleOptions');
var callRequestCreatedCallback = require('../shared/callRequestCreatedCallback');
var addEventListeners = require('../http/addEventListeners');
var handleXhrProps = require('../http/handleXhrProps');
var handleHeaders = require('../http/handleHeaders');
var handleRequestBody = require('../http/handleRequestBody');
var callXhrHook = require('../http/callXhrHook');

/**
 * http request.
 *
 * @class
 * @extends {Request}
 * @param {RequestOptions} options The request options.
 * @param {RequestSuccessCallback} onsuccess The callback to call on success.
 * @param {RequestErrorCallback} onerror The callback to call on error.
 */
function HttpRequest(options, onsuccess, onerror) {
    var xhr;
    var body;
    var url;

    // Call the super constructor.
    Request.call(this, constants.HTTP_REQUEST, options, onsuccess, onerror);

    // Call `options.handleOptions` to handle options.
    handleOptions(options);

    xhr = this.xhr = options.createXHR.call(null, options);
    body = handleRequestBody(options);
    url = buildURL(options);

    // Set properties to the xhr.
    handleXhrProps(xhr, options);

    // Call onXhrCreated.
    callXhrHook(options.onXhrCreated, xhr, options);

    // Open the request.
    xhr.open(options.method || 'GET', url, true, options.username, options.password);

    // Add event listeners.
    addEventListeners(this);

    // Call onXhrOpened.
    callXhrHook(options.onXhrOpened, xhr, options);

    // Hanlde headers.
    handleHeaders(xhr, options);

    // Send the body to the server.
    xhr.send(body);

    // Call onXhrSent.
    callXhrHook(options.onXhrSent, xhr, options);

    // Call onRequestCreated
    callRequestCreatedCallback(options, this);
}

inherits(HttpRequest, Request);

module.exports = HttpRequest;
