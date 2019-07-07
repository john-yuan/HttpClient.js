/**
 * Define a static member on the given constructor and its prototype
 *
 * @param {Constructor} ctor The constructor to define the static member
 * @param {string} name The name of the static member
 * @param {any} value The value of the static member
 * @throws {Error} Throws error if the name has already existed, or the constructor is not a function
 */
function defineExports(ctor, name, value) {
    if (typeof ctor !== 'function' || !ctor.prototype) {
        throw new Error('The constructor is not a function or its prototype is not an object');
    }

    ctor.exports = ctor.exports || {};

    if (name in ctor.exports) {
        throw new Error('The name "' + name + '" has already existed in the constructor.exports');
    }

    if (ctor.prototype.exports && ctor.prototype.exports !== ctor.exports) {
        throw new Error('The name "exports" has already existed in the constructor.prototype');
    } else {
        ctor.prototype.exports = ctor.exports;
    }

    ctor.exports[name] = value;
}

module.exports = defineExports;
