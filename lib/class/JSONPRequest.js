var Request = require('./Request');
var constants = require('../shared/constants');
var inherits = require('../shared/inherits');
var handleOptions = require('../shared/handleOptions');
var callRequestCreatedCallback = require('../shared/callRequestCreatedCallback');
var addEventListeners = require('../jsonp/addEventListeners');
var buildCallbackName = require('../jsonp/buildCallbackName');
var handleScriptCors = require('../jsonp/handleScriptCors');
var buildScriptSrc = require('../jsonp/buildScriptSrc');

/**
 * Represents an jsonp request.
 *
 * @class
 * @extends {Request}
 * @param {RequestOptions} options The request options.
 * @param {RequestSuccessCallback} onsuccess The callback to call on success.
 * @param {RequestErrorCallback} onerror The callback to call on error.
 */
function JSONPRequest(options, onsuccess, onerror) {
    var src;
    var script;
    var callbackName;
    var containerNode;

    Request.call(this, constants.JSONP_REQUEST, options, onsuccess, onerror);

    // Call `options.handleOptions` to handle options.
    handleOptions(options);

    script = this.script = options.createScript.call(null, options);
    containerNode = options.jsonpContainerNode.call(null, options);
    callbackName = buildCallbackName(options);
    src = buildScriptSrc(options, callbackName);

    // Set the src attribute.
    script.setAttribute('src', src);

    // Handle `options.cors`
    handleScriptCors(script, options);

    // Add event listeners
    addEventListeners(this, callbackName);

    // Inject the script node
    containerNode.appendChild(script);

    // Call onRequestCreated
    callRequestCreatedCallback(options, this);
}

inherits(JSONPRequest, Request);

module.exports = JSONPRequest;
