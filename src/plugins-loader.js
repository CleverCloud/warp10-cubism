module.exports = (() => {
  const _ = require("lodash");
  const allConfigurations = require("./plugins/all.js");
  const Loader = {};

  Loader.loadInstancePlugins = (app) => {
    const instanceType = Loader.getInstanceType(app);
    let instancePlugins = [];

    try{
      instancePlugins = require(`./instances/${instanceType}.js`);
    } catch(e){
      throw new Error(`Couldn't find ${instanceType} instance type: ${e.message}`);
    }

    return instancePlugins;
  };

  Loader.globalPlugins = (resource) => {
    return Loader.loadPluginConfiguration(Loader.loadInstancePlugins(resource).global);
  };

  Loader.advancedPlugins = (resource) => {
    return Loader.loadPluginConfiguration(Loader.loadInstancePlugins(resource).advanced);
  };

  Loader.getInstanceType = (resource) => {
    return resource.instanceType;
  };

  Loader.loadPluginConfiguration = (plugins) => {
    return _.map(plugins, p => {
      if(!_.has(allConfigurations, p)){
        throw new Error(`Missing plugin configuration for plugin ${p}`);
      }

      return allConfigurations[p];
    })
  };

  Loader.loadDefault = (metric) => {
    const splitted = metric.split('.');
    return {
      id: "custom",
      key: `${_.first(splitted)}`,
      subkeys: [{key: splitted.slice(1).join('.')}]
    };
  };

  return Loader;
})();
