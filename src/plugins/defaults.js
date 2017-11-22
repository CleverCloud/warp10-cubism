module.exports = (() => {
  const _ = require("lodash");
  const defaultPlugins = ["cpu", "ram", "net"];
  const defaultAdvancedPlugins = [].concat(defaultPlugins);

  return {
    global: defaultPlugins,
    advanced: defaultAdvancedPlugins
  };
})();
