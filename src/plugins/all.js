/*
 * A bit of documentation:
 * You can find in this file every plugins metrics supports
 *
 * To add a plugin, follow the few plugins at the bottom.
 * A plugin must have a few defined keys: id, key, subkeys
 *
 * id: a uniq id for the plugin. no spaces.
 * key: the warp10 key you use to query. Imagine that you want all statsd prefixed data, this will be: statsd.{}
 ****** the {} symbol here is then replaced by the constructed subkeys (right below). You can also use regex:
 ****** ~statsd.({}) Here the {} will be replaced by a "subkey1|subkey2" to match the regex format.
 * subkeys: an array of objects you want to fetch. For the RAM plugin, it's {key: "used"}, which makes: mem.used
 *
 * Optional keys:
 * clientDelay: delay the graph client has to refresh in ms. Default: 1s
 * serverDelay: delay for the metrics to be gathered in ms. Default 60s + 10s (+10 is to let them be gathered by warp10)
 * labels: a map of "key:value" to add additionnal labels to the warp10 request
 * transformers: A map of "key:function" to transform data (can be GTS or warpscript) during the process
 ****** Currently there are 2 transformers available:
 ****** onNewPoints: when the plugin receives point. It allows you to transform them. You receive the GTS values and the gts key
 ****** onGetWarpscript: when the plugin constructs the warp10 request. You receive the basic FETCH command and the current plugin. You can return anything you want
 *
 * Have a look at the other plugins to know how to easily add one.
 * You also have to modify files in src/plugins/metrics/instances/ to enable a plugin for an instance type
 */

const formatValues = require("../formatValues.js");
const _ = require("lodash");

const cpu = require("./cpu.js");

module.exports = (() => {;
  let plugins = {};

  plugins = _.extend(plugins, cpu);

  plugins.ram = {
    id: "mem",
    serverDelay: 10e3,
    key: "mem",
    subkeys: [{key: "used_percent"}],
    formatters: {
      formatValue: formatValues.formatPercent
    }
  };

  plugins.net = {
    id: "net",
    serverDelay: 60e3,
    key: "net",
    subkeys: [{key: "bytes_sent"}, {key: "bytes_recv"}],
    transformers: {
      onGetWarpscript: (warpscript, plugin) => {
        const derive = plugin.mapperWarpscript(warpscript, "rate", 1, 0, 0);
        return plugin.interpolateWarpscript(derive);
      },
      onNewPoints: (gtss, key) => {
        const firstGts = gtss[0];
        const v = firstGts && firstGts[1] === 0 ? _.drop(gtss, 1) : gtss;
        return key === 'bytes_recv' ?
          _.map(v, (kv) => [kv[0], -kv[1]]) :
          v;
      }
    },
    formatters: {
      formatValue: (value) => {
        const ret = formatValues.formatBytes(value);
        return `${ret}/s`;
      }
    }
  };

  plugins.apache_req_per_sec = {
    id: "apache_req_per_sec",
    serverDelay: 60e3,
    key: "apache",
    subkeys: [{key: "ReqPerSec"}],
    formatters: {
      formatValue: formatValues.formatSeconds,
    }
  };

  plugins.apache_workers = {
    id: "apache_workers",
    serverDelay: 60e3,
    key: "apache",
    subkeys: [
      {key: "IdleWorkers"},
      {key: "BusyWorkers"}
    ]
  };

  plugins.haskell_wai_request_count = {
    id: "haskell_wai_request_count",
    serverDelay: 60e3,
    key: "statsd",
    subkeys: [{key: "wai_request_count.value"}],
    transformers: {
      onGetWarpscript: (ws, plugin) => {
        const map = plugin.mapperWarpscript(ws, "delta", 1, 0, 0);
        const bucketize = plugin.bucketizeWarpscript(map);
        return plugin.interpolateWarpscript(bucketize);
      }
    },
    formatters: {
      formatValue: formatValues.formatSeconds,
    }
  };

  plugins.haskell_memory_used = {
    id: "haskell_memory_used",
    serverDelay: 60e3,
    key: "statsd",
    subkeys: [{key: "rts_gc_current_bytes_used.value"}],
  }

  plugins.java_memory_used = {
    id: "java_memory_used",
    serverDelay: 60e3,
    key: "jvm",
    subkeys: [{
      key: "metrics_jvm_heapMemoryUsage_committed.value"
    }, {
      key: "metrics_jvm_heapMemoryUsage_used.value"
    }],
    formatters: {
      formatValue: formatValues.formatBytes
    }
  }

  plugins.java_memory_used_compat = {
    id: "java_memory_used_compat",
    serverDelay: 60e3,
    key: "jvm",
    subkeys: [{
      key: "statsd-jvm-profiler_heap_total_used.value"
    }, {
      key: "statsd-jvm-profiler_nonheap_total_used.value"
    }],
    formatters: {
      formatValue: formatValues.formatBytes
    }
  }

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

  return plugins;
})();
