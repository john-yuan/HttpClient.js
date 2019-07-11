var isPlainObject = require('x-common-utils/isPlainObject');
var isFunction = require('x-common-utils/isFunction');
var hasOwn = Object.prototype.hasOwnProperty;

/**
 * The function to add custom parsers to the instance of `Response` or `ResponseError`.
 *
 * @param {Response|ResponseError} target The target to add the custome parsers.
 * @param {RequestOptions} options The request options.
 * @param {string} optionName The option name the parsers container.
 */
function addCustomParser(target, options, optionName) {
    var parsers = options[optionName];
    var name;
    var parser;

    if (isPlainObject(parsers)) {
        for (name in parsers) {
            if (hasOwn.call(parsers, name)) {
                parser = parsers[name];
                if (isFunction(parser)) {
                    if (name in target) {
                        throw new Error('"' + name + '" cannot be a name of parser');
                    }
                    target[name] = parser;
                }
            }
        }
    }
}

module.exports = addCustomParser;
