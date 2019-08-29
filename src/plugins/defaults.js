module.exports = (() => {
  const _ = require("lodash");
  const cpu = require("./cpu.js");
  const cpuKeys = Object.keys(cpu);

  const defaultPlugins = ["cpu", "ram", "net"];
  const defaultAdvancedPlugins = [].concat(defaultPlugins).concat(cpuKeys);

  return {
    global: defaultPlugins,
    advanced: defaultAdvancedPlugins
  };
})();
