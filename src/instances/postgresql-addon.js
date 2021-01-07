module.exports = (() => {
  const _ = require("lodash");
  const defaultPlugins = require("../plugins/defaults.js");
  const pg_plugins = ["postgresql_active_connections"];

  return {
    global: [].concat(defaultPlugins.globalAddons).concat(pg_plugins),
    advanced: [].concat(defaultPlugins.advanced)
  };
})();
