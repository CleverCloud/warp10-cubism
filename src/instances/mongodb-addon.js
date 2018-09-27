module.exports = (() => {
  const _ = require("lodash");
  const defaultPlugins = require("../plugins/defaults.js");
  const mongodbGlobalPlugins = ["mongodb_open_connections", "mongodb_queries"];

  return {
    global: [].concat(defaultPlugins.global).concat(mongodbGlobalPlugins),
    advanced: [].concat(defaultPlugins.advanced)
  };
})();
