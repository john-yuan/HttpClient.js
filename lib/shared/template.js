/**
 * A simple template function
 *
 * @example
 * // Rreturns '/post/1'
 * template('/post/{ post.id }', { post: { id: 1 } })
 *
 * @param {string} template The template text.
 * @param {Object.<string, string>} data The data object.
 * @param {TemplateOptions} options The template options.
 * @returns {string} Returns the compiled text.
 */
function template(template, data, options) {
    var templ = template + '';
    var model = data || {};
    var opts = options || {};
    var start = opts.start || '{';
    var end = opts.end || '}';
    var encode = opts.encode || encodeURIComponent;

    return compile(templ, start, end, function (key) {
        return read(model, key, encode);
    });
}

/**
 * Read the value (cast to string) in the `data` with the given `key`. If the key is start with `- ` (`-` and space),
 * the `- ` will be removed from the key and the value will not be urlencoded. Otherwise the value will be urlencoded.
 *
 * @param {Object.<string, *>} data The object keeps the data.
 * @param {string} key The property path to access.
 * @param {(value: string) => string} encode The function to encode the value.
 * @returns {string} Returns the value.
 */
function read(data, key, encode) {
    var first = key.charAt(0);
    var second = key.charAt(1);
    var raw = false;

    // {- raw }
    if (first === '-' && second === ' ') {
        raw = true;
        key = key.substr(2);
    }

    key = key.replace(/^\s+|\s+$/g, '');

    if (key.charAt(0) !== '[') {
        key = '.' + key;
    }

    var fn = new Function('d', 'return d' + key);
    var value = fn(data) + '';

    if (!raw) {
        value = encode(value);
    }

    return value;
}

/**
 * Compile the template.
 *
 * @param {string} template The template to compile.
 * @param {string} startTag The start tag.
 * @param {string} endTag The end tag.
 * @param {(expr: string) => string} parse The function to parse the expression.
 * @returns {string} Return the compiled string.
 */
function compile(template, startTag, endTag, parse) {
    var i = 0;
    var l = template.length;
    var sl = startTag.length;
    var el = endTag.length;
    var output = [];
    var exprbuffer = [];
    var T_STR = 1;
    var T_EXP = 2;
    var type = T_STR;

    /**
     * Get the char in `template` at the given position.
     *
     * @param {numner} [index] The index to read, if it is not set, `i` is used.
     * @returns {string} Returns the char.
     */
    var charAt = function (index) {
        return template.charAt(index || i);
    };

    /**
     * Escape the tag.
     *
     * @param {string} tag The tag to escape.
     * @param {string[]} buffer The buffer to put the char.
     */
    var esc = function (tag, buffer) {
        var c;
        var m = tag.length;
        var s = '\\';

        while (1) {
            c = charAt(i);
            if (c === s) {
                c = charAt(++i);
                if (c === s) {
                    buffer.push(s);
                    ++i;
                } else if (isWord(tag)) {
                    buffer.push(tag);
                    i += m;
                } else {
                    buffer.push(s);
                    break;
                }
            } else {
                break;
            }
        }
    };

    /**
     * Check whether the next input is the word.
     *
     * @param {string} word The word to check.
     * @returns {number} Returns `1` on yes, otherwise `0` is returned.
     */
    var isWord = function (word) {
        var k = 0;
        var j = i;
        var m = word.length;

        while (k < m && j < l) {
            if (word.charAt(k) !== template.charAt(j)) return 0;
            ++k;
            ++j;
        }

        return 1;
    };

    /**
     * Flush the expr to the output and reset the expr buffer.
     */
    var flushExpr = function () {
        output.push(parse(exprbuffer.join('')));
        exprbuffer = [];
    };

    while (i < l) {
        if (type === T_STR) {
            esc(startTag, output);
            if (isWord(startTag)) {
                type = T_EXP;
                i += sl;
            } else {
                output.push(charAt(i));
                i += 1;
            }
        } else if (type === T_EXP) {
            esc(endTag, exprbuffer);
            if (isWord(endTag)) {
                type = T_STR;
                i += el;
                flushExpr();
            } else {
                exprbuffer.push(charAt(i));
                i += 1;
            }
        }
    }

    if (type === T_EXP) {
        throw new Error('unexpected end');
    }

    return output.join('');
}

/**
 * @typedef {Object.<string, *>} TemplateOptions
 * @property {string} [start] The start tag of the template, default is `{`.
 * @property {string} [end] The end tag of the template, default is `}`.
 * @property {(value: string) => string} [encode] The function to encode the value, default is `encodeURIComponent`.
 */

module.exports = template;
