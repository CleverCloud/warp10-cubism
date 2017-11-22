module.exports = (() => {
  const defaultPlugins = require("../plugins/defaults.js");
  const phpGlobalPlugins = ["apache_workers", "apache_req_per_sec"];

  return {
    global: [].concat(defaultPlugins.global).concat(phpGlobalPlugins),
    advanced: [].concat(defaultPlugins.advanced)
  };
})();
