var isPlainObject = require('x-common-utils/isPlainObject');
var isFunction = require('x-common-utils/isFunction');
var hasOwn = require('./hasOwn');

/**
 * The function to add custom mixins to the instance of `Response` or `ResponseError`.
 *
 * @param {Response|ResponseError} target The target to add the custome mixins.
 * @param {RequestOptions} options The request options.
 * @param {string} optionName The option name the mixins container.
 */
function addMixin(target, options, optionName) {
    var mixins = options[optionName];
    var name;
    var mixin;

    if (isPlainObject(mixins)) {
        for (name in mixins) {
            if (hasOwn.call(mixins, name)) {
                mixin = mixins[name];
                if (isFunction(mixin)) {
                    if (name in target) {
                        throw new Error('mixin name conflict "' + name + '"');
                    }
                    target[name] = mixin;
                }
            }
        }
    }
}

module.exports = addMixin;
