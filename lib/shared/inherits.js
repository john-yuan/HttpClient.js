/**
 * Make `SubClass` extend `SuperClass`.
 *
 * @param {Function} SubClass The sub class constructor.
 * @param {Function} SuperClass The super class constructor.
 */
function inherits(SubClass, SuperClass) {
    var F = function() {};

    F.prototype = SuperClass.prototype;

    SubClass.prototype = new F();
    SubClass.prototype.constructor = SubClass;
}

module.exports = inherits;
