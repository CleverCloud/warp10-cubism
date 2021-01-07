const plugins = {};

plugins.redis_active_connections = {
  id: "redis_active_connections",
  serverDelay: 60e3,
  key: "redis",
  subkeys: [{ key: "clients" }]
};

module.exports = plugins;