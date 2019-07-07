/**
 * The function to handle `options.cors` setting when sending JSONP requests. If `options.cors` is `true`, the
 * `crossorigin` attribute of the `script` element we using is set to `use-credentials`.
 *
 * @param {HTMLScriptElement} script The script element.
 * @param {RequestOptions} options The request options.
 */
function handleScriptCors(script, options) {
    if (options.cors) {
        script.setAttribute('crossorigin', 'use-credentials');
    }
}

module.exports = handleScriptCors;
