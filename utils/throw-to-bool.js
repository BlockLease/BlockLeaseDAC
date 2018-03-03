'use strict';

/**
 * Catch any thrown value and return false instead
 **/
module.exports = async function throwToBool(fn, ...args) {
  let thrown = false;
  try {
    await fn(...args);
  } catch (err) {
    thrown = true;
  } finally {
    return !thrown;
  }
};
