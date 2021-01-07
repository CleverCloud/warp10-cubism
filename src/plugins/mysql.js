const plugins = {};

plugins.mysql_active_connections = {
  id: "mysql_active_connections",
  serverDelay: 60e3,
  key: "mysql",
  subkeys: [{ key: "threads_connected" }]
};

module.exports = plugins;