module.exports = (() => {
  const _ = require("lodash");
  const defaultPlugins = require("../plugins/defaults.js");
  const esGlobalPlugins = ["elasticsearch_status_code"];

  return {
    global: [].concat(defaultPlugins.global).concat(esGlobalPlugins),
    advanced: [].concat(defaultPlugins.advanced)
  };
})();