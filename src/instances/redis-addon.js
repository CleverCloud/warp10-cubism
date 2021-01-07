module.exports = (() => {
  const _ = require("lodash");
  const defaultPlugins = require("../plugins/defaults.js");
  const redisPlugins = ["redis_active_connections"];

  return {
    global: [].concat(defaultPlugins.global).concat(redisPlugins),
    advanced: [].concat(defaultPlugins.advanced)
  };
})();
