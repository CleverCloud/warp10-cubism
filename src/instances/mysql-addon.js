module.exports = (() => {
  const _ = require("lodash");
  const defaultPlugins = require("../plugins/defaults.js");
  const mysqlPlugins = ["mysql_active_connections"];

  return {
    global: [].concat(defaultPlugins.globalAddons).concat(mysqlPlugins),
    advanced: [].concat(defaultPlugins.advanced)
  };
})();
