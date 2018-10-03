module.exports = (() => {
  const _ = require("lodash");
  const defaultPlugins = require("../plugins/defaults.js");

  return {
    global: [].concat(defaultPlugins.global),
    advanced: [].concat(defaultPlugins.advanced)
  };
})();
