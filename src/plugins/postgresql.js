const plugins = {};

plugins.postgresql_active_connections = {
  id: "postgresql_active_connections",
  serverDelay: 60e3,
  key: "postgresql",
  subkeys: [{ key: "active_connections" }]
};

module.exports = plugins;