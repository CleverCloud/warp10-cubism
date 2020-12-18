module.exports = (() => {
  const _ = require("lodash");
  const defaultPlugins = require("../plugins/defaults.js");

  return {
    global: [].concat(defaultPlugins.globalAddons),
    advanced: [].concat(defaultPlugins.advanced)
  };
})();
