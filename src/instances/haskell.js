module.exports = (() => {
  const defaultPlugins = require("../plugins/defaults.js");
  const haskellGlobalPlugins = ["haskell_memory_used", "haskell_wai_request_count"];

  return {
    global: [].concat(defaultPlugins.global).concat(haskellGlobalPlugins),
    advanced: [].concat(defaultPlugins.advanced)
  };
})();
