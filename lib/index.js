var HttpClient = require('./class/HttpClient');
var merge = require('x-common-utils/merge');
var isFunction = require('x-common-utils/isFunction');
var isPlainObject = require('x-common-utils/isPlainObject');
var QS = require('x-query-string');
var isAbsoluteURL = require('x-common-utils/isAbsoluteURL');
var defineExports = require('./shared/defineExports');
var createDefaultOptions = require('./shared/createDefaultOptions');
var constants = require('./shared/constants');
var template = require('./shared/template');
var uuid = require('./shared/uuid');
var noop = require('./shared/noop');
var inherits = require('./shared/inherits');
var CancelController = require('./class/CancelController');
var HttpRequest = require('./class/HttpRequest');
var HttpResponse = require('./class/HttpResponse');
var HttpResponseError = require('./class/HttpResponseError');
var JSONPRequest = require('./class/JSONPRequest');
var JSONPResponse = require('./class/JSONPResponse');
var JSONPResponseError = require('./class/JSONPResponseError');
var Request = require('./class/Request');
var Response = require('./class/Response');
var ResponseError = require('./class/ResponseError');

defineExports(HttpClient, 'constants', merge({}, constants));

defineExports(HttpClient, 'libs', {
    QS: QS
});

defineExports(HttpClient, 'classes', {
    CancelController: CancelController,
    HttpClient: HttpClient,
    HttpRequest: HttpRequest,
    HttpResponse: HttpResponse,
    HttpResponseError: HttpResponseError,
    JSONPRequest: JSONPRequest,
    JSONPResponse: JSONPResponse,
    JSONPResponseError: JSONPResponseError,
    Request: Request,
    Response: Response,
    ResponseError: ResponseError
});

defineExports(HttpClient, 'functions', {
    template: template,
    merge: merge,
    isAbsoluteURL: isAbsoluteURL,
    isFunction: isFunction,
    isPlainObject: isPlainObject,
    uuid: uuid,
    noop: noop,
    inherits: inherits,
    createDefaultOptions: createDefaultOptions
});

module.exports = HttpClient;
