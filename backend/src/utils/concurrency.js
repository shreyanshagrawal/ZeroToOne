/**
 * Executes a restricted pool of concurrent promises to prevent overwhelming 
 * OS constraints like EMFILE (Too many open files) or memory caps.
 *
 * @param {number} poolLimit - Maximum parallel executions
 * @param {Array} array - Items to iterate over
 * @param {Function} iteratorFn - Async function to apply to each item
 * @returns {Promise<Array>}
 */
const asyncPool = async (poolLimit, array, iteratorFn) => {
  const ret = [];
  const executing = [];
  for (const item of array) {
    const p = Promise.resolve().then(() => iteratorFn(item, array));
    ret.push(p);

    if (poolLimit <= array.length) {
      const e = p.then(() => executing.splice(executing.indexOf(e), 1));
      executing.push(e);
      if (executing.length >= poolLimit) {
        await Promise.race(executing);
      }
    }
  }
  return Promise.all(ret);
};

/**
 * Cleanly strips text comments out of JS/TS and Python code
 * to prevent false-positive occurrences in Regex AST fallback parsing.
 */
const stripComments = (content, ext) => {
  if (ext === '.py') {
    // Exclude # style line comments but preserve string literals broadly
    return content.replace(/#.*$/gm, '');
  } else if (['.js', '.jsx', '.ts', '.tsx', '.vue'].includes(ext)) {
    // Exclude // style and /* */ style block comments
    return content.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
  }
  return content;
};

module.exports = { asyncPool, stripComments };
