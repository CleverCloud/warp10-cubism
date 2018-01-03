/*
 * A bit of documentation:
 * You can find in this file every plugins metrics supports
 *
 * To add a plugin, follow the few plugins at the bottom.
 * A plugin must have a few defined keys: id, displayName, key, subkeys
 *
 * id: a uniq id for the plugin. no spaces.
 * displayName: the name of the plugin display in the metrics pane
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

module.exports = (() => {;
  const _ = require("lodash");
  const plugins = {};

  plugins.cpu = {
    id: "cpu",
    displayName: "CPU",
    serverDelay: 10e3,
    key: "fast_cpu.{}",
    subkeys: [{key: "usage_idle"}],
    labels: { cpu: 'cpu-total' },
    unit: "% of utilization",
    transformers: {
      onNewPoints: gtss => _.map(gtss, gts => [gts[0], 100 - gts[1]])
    }
  };

  plugins.ram = {
    id: "mem",
    displayName: "RAM",
    serverDelay: 10e3,
    key: "mem.{}",
    subkeys: [{key: "used"}],
    unit: "Bytes"
  };

  plugins.net = {
    id: "net",
    displayName: "Network",
    serverDelay: 60e3,
    key: "~net.({})",
    subkeys: [{key: "bytes_sent", displayName: "Net Out"}, {key: "bytes_recv", displayName: "Net In"}],
    unit: "Bytes / second",
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
    }
  };

  plugins.apache_req_per_sec = {
    id: "apache_req_per_sec",
    displayName: "Requests per second",
    serverDelay: 60e3,
    key: "apache.{}",
    subkeys: [{key: "ReqPerSec"}]
  };

  plugins.apache_workers = {
    id: "apache_workers",
    displayName: "Workers",
    serverDelay: 60e3,
    key: "~apache.({})",
    subkeys: [
      {key: "IdleWorkers", displayName: "Idle"},
      {key: "BusyWorkers", displayName: "Busy"}
    ]
  };

  plugins.haskell_wai_request_count = {
    id: "haskell_wai_request_count",
    displayName: "Requests per second",
    serverDelay: 60e3,
    key: "statsd.{}",
    subkeys: [{key: "wai_request_count.value"}],
    transformers: {
      onGetWarpscript: (ws, plugin) => {
        const map = plugin.mapperWarpscript(ws, "delta", 1, 0, 0);
        const bucketize = plugin.bucketizeWarpscript(map);
        return plugin.interpolateWarpscript(bucketize);
      }
    }
  };

  plugins.haskell_memory_used = {
    id: "haskell†_memory_used",
    displayName: "GC residency",
    serverDelay: 60e3,
    key: "statsd.{}",
    subkeys: [{key: "rts_gc_current_bytes_used.value"}],
    unit: "Bytes"
  }

  plugins.java_memory_used = {
    id: "java_memory_used",
    displayName: "Allocated Memory",
    serverDelay: 60e3,
    key: "~jvm.({})",
    unit: "Bytes",
    subkeys: [{
      key: "statsd-jvm-profiler_heap_total_used.value",
      displayName: "Total heap"
    }, {
      key: "statsd-jvm-profiler_nonheap_total_used.value",
      displayName: "Off heap"
    }]
  }

  return plugins;
})();
