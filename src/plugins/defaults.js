module.exports = (() => {
  const _ = require("lodash");
  const cpu = require("./cpu.js");
  const cpuKeys = Object.keys(cpu);

  const defaultPlugins = ["cpu", "ram", "net"];
  const defaultPluginsAddons = [].concat(defaultPlugins).concat(["disk"]);
  const defaultAdvancedPlugins = [].concat(defaultPlugins).concat(cpuKeys);

  return {
    global: defaultPlugins,
    globalAddons: defaultPluginsAddons,
    advanced: defaultAdvancedPlugins
  };
})();
