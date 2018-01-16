module.exports = (() => {
  const defaultPlugins = require("../plugins/defaults.js");
  const javaGlobalPlugins = ["java_memory_used", "java_memory_used_compat"];

  return {
    global: [].concat(defaultPlugins.global).concat(javaGlobalPlugins),
    advanced: [].concat(defaultPlugins.advanced)
  };
})();
