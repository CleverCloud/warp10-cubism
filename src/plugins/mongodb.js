const plugins = {};

plugins.mongodb_open_connections = {
  id: "mongodb_open_connections",
  serverDelay: 60e3,
  key: "mongodb",
  subkeys: [{ key: "open_connections" }]
};

plugins.mongodb_queries = {
  id: "mongodb_queries",
  serverDelay: 60e3,
  key: "mongodb",
  subkeys: [{ key: "queries_per_sec" }, { key: "inserts_per_sec" }, { key: "updates_per_sec" }, { key: "deletes_per_sec" },
    { key: "commands_per_sec" }]
};

module.exports = plugins;