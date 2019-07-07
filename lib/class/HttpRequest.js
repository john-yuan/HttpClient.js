var Requeset = require('./Request');
var constants = require('../constants');
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
 * Represents an http request.
 *
 * @class
 * @extends {Requeset}
 * @param {RequestOptions} options The request options.
 * @param {RequestSuccessCallback} onsuccess The callback to call on success.
 * @param {RequestErrorCallback} onerror The callback to call on error.
 */
function HttpRequest(options, onsuccess, onerror) {
    var xhr;
    var content;
    var url;

    // Call the super constructor.
    Requeset.call(this, constants.HTTP_REQUEST, options, onsuccess, onerror);

    // Call `options.handleOptions` to handle options.
    handleOptions(options);

    this.xhr = xhr = options.createXHR.call(null, options);
    content = handleRequestBody(options);
    url = buildURL(options);

    // Set properties to the xhr.
    handleXhrProps(xhr, options);

    // Call onXhrCreated.
    callXhrHook(options.onXhrCreated, xhr, options);

    // Add event listeners. This function must overwrite the `cancel` method of this `HttpRequest` instance to cancel
    // this http request.
    addEventListeners(this);

    // Open the request.
    xhr.open(options.method || 'GET', url, true, options.username, options.password);

    // Call onXhrOpened.
    callXhrHook(options.onXhrOpened, xhr, options);

    // Hanlde headers.
    handleHeaders(xhr, options);

    // Send the content to the server.
    xhr.send(content);

    // Call onXhrSent.
    callXhrHook(options.onXhrSent, xhr, options);

    // Call onRequestCreated
    callRequestCreatedCallback(options, this);
}

inherits(HttpRequest, Requeset);

module.exports = HttpRequest;
