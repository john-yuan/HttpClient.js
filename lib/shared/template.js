var T_STR = 1;
var T_EXP = 2;

/**
 * A simple template function
 *
 * @example
 * // Rreturns '/post/1'
 * template('/post/{ post.id }', { post: { id: 1 } })
 *
 * @param {string} template The template text.
 * @param {Object.<string, *>} data The data object.
 * @param {TemplateOptions} options The template options.
 * @returns {string} Returns the compiled text.
 */
function template(template, data, options) {
    // Treat null (null == undefined) as empty string.
    var templ = template == null ? '' : (template + '');
    var model = data || {};
    var opts = options || {};
    var start = opts.start || '{';
    var end = opts.end || '}';
    var encode = opts.encode || encodeURIComponent;
    var result = parse(templ, start, end, function (expr) {
        var first = expr.charAt(0);
        var second = expr.charAt(1);
        var raw = false;

        if (first === '-' && second === ' ') {
            raw = true;
            expr = expr.substr(2);
        }

        expr = expr.replace(/^\s+|\s+$/g, '');

        return {
            type: T_EXP,
            text: expr,
            raw: raw
        };
    });

    var render = compile(result, encode);

    try {
        return render(model);
    } catch (e) {
        throw new Error('Compile Error:\n\n' + template + '\n\n' + e.message);
    }
}

/**
 * Compile the result of `parse` to a function.
 *
 * @param {Object.<string, *>[]} result The abstract syntax tree.
 * @param {(str: string) => string} encode The function to encode the string.
 * @returns {(model: Object.<string, *>) => string} Returns a function that compile data to string.
 */
function compile(result, encode) {
    var fn;
    var line;
    var lines = [];
    var i = 0;
    var l = result.length;

    lines.push('var __o=[]');
    lines.push('with(__s){');

    for ( ; i < l; ++i) {
        line = result[i];

        if (line.type === T_STR) {
            lines.push('__o.push(' + JSON.stringify(line.text) + ')');
        } else if (line.type === T_EXP && line.text) {
            if (line.raw) {
                lines.push('__o.push(' + line.text + ')');
            } else {
                lines.push('__o.push(__e(' + line.text + '))');
            }
        }
    }

    lines.push('}');
    lines.push('return __o.join("")');

    fn = new Function('__s', '__e', lines.join('\n'));

    return function (model) {
        return fn(model, function (val) {
            return (val === null || val === undefined) ? '' : encode(val + '');
        });
    };
}

/**
 * The function to parse the template string.
 *
 * @param {string} template The template string to parse.
 * @param {string} openingTag The opening tag, for example `{{`.
 * @param {string} closingTag The closing tag, for example `}}`.
 * @param {(expr: string) => Object.<string, *>} handleExpr The function to handle each expression.
 * @returns {Object.<string, *>[]} Returns the parsed result.
 */
function parse(template, openingTag, closingTag, handleExpr) {
    var res;
    var templ = template;
    var regOpeningTag = createRegExp(openingTag);
    var regClosingTag = createRegExp(closingTag);
    var ERR_UNEXPECTED_END = 'Unexpected end';
    var type = T_STR;
    var strCache = [];
    var expCache = [];
    var output = [];

    /**
     * Create a `RegExp` for the given tag.
     *
     * @param {string} tag The tag to create a `RegExp`.
     * @returns {RegExp} Returns an instance of `RegExp`.
     */
    function createRegExp(tag) {
        var regChars = /[\\|{}()[\].*+?^$]/g;
        var escapedTag = tag.replace(regChars, function (char) {
            return '\\' + char;
        });
        return new RegExp('(\\\\*)' + escapedTag);
    }

    /**
     * Flush the text in `strCache` into `output` and reset `strCache`.
     */
    function flushStr() {
        output.push({
            type: T_STR,
            text: strCache.join('')
        });
        strCache = [];
    }

    /**
     * Flush the text in `expCache` into `output` and reset `expCache`.
     */
    function flushExp() {
        output.push(handleExpr(expCache.join('')));
        expCache = [];
    }

    /**
     * Check whether the tag is escaped. If it is, put is to the cache.
     *
     * @param {Object.<string, *>} res The result of `RegExp#exec`.
     * @param {string} tag The tag to escape.
     * @param {string[]} cache The array to save escaped text.
     * @returns {boolean} Returns `true` on it is NOT escaped.
     */
    function esc(res, tag, cache) {
        var slashes = res[1] || '';
        var count = slashes.length;

        if (count % 2 === 0) {
            if (count) {
                cache.push(slashes.substr(count / 2));
            }
            return true;
        } else {
            if (count > 1) {
                cache.push(slashes.substr((count + 1) / 2));
            }
            cache.push(tag);
            return false;
        }
    }

    while (templ.length) {
        if (type === T_STR) {
            res = regOpeningTag.exec(templ);
            if (res) {
                strCache.push(templ.substr(0, res.index));
                templ = templ.substr(res.index + res[0].length);
                if (esc(res, openingTag, strCache)) {
                    flushStr();
                    type = T_EXP;
                    if (!templ) {
                        throw new Error(ERR_UNEXPECTED_END);
                    }
                }
            } else {
                strCache.push(templ);
                flushStr();
                templ = '';
            }
        } else { // if (type === T_EXP)
            res = regClosingTag.exec(templ);
            if (res) {
                expCache.push(templ.substr(0, res.index));
                templ = templ.substr(res.index + res[0].length);
                if (esc(res, closingTag, expCache)) {
                    flushExp();
                    type = T_STR;
                }
            } else {
                throw new Error(ERR_UNEXPECTED_END);
            }
        }
    }

    return output;
}

/**
 * @typedef {Object.<string, *>} TemplateOptions
 * @property {string} [start] The start tag of the template, default is `{`.
 * @property {string} [end] The end tag of the template, default is `}`.
 * @property {(value: string) => string} [encode] The function to encode the string, default is `encodeURIComponent`.
 */

module.exports = template;
