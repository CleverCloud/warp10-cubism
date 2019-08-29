const formatValue = require("../formatValues.js");

const plugins = {};

plugins.cpu = {
  id: "cpu",
  serverDelay: 10e3,
  key: "cpu",
  subkeys: [{key: "usage_idle"}],
  labels: { cpu: 'cpu-total' },
  transformers: {
    onNewPoints: gtss => _.map(gtss, gts => [gts[0], 100 - gts[1]])
  },
  formatters: {
    formatValue: formatValue.formatPercent
  }
};

plugins.cpu_usage_user = {
  id: "cpu",
  serverDelay: 60e3,
  key: "cpu",
  subkeys: [{key: "usage_user"}],
  labels: { cpu: 'cpu-total' },
  formatters: {
    formatValue: formatValue.formatPercent
  }
};

plugins.cpu_usage_system = {
  id: "cpu",
  serverDelay: 60e3,
  key: "cpu",
  subkeys: [{key: "usage_system"}],
  labels: { cpu: 'cpu-total' },
  formatters: {
    formatValue: formatValue.formatPercent
  }
};

plugins.cpu_usage_steal = {
  id: "cpu",
  serverDelay: 60e3,
  key: "cpu",
  subkeys: [{key: "usage_steal"}],
  labels: { cpu: 'cpu-total' },
  formatters: {
    formatValue: formatValue.formatPercent
  }
};

plugins.cpu_usage_guest = {
  id: "cpu",
  serverDelay: 60e3,
  key: "cpu",
  subkeys: [{key: "usage_guest"}],
  labels: { cpu: 'cpu-total' },
  formatters: {
    formatValue: formatValue.formatPercent
  }
};

plugins.cpu_usage_guest_nice = {
  id: "cpu",
  serverDelay: 60e3,
  key: "cpu",
  subkeys: [{key: "usage_guest_nice"}],
  labels: { cpu: 'cpu-total' },
  formatters: {
    formatValue: formatValue.formatPercent
  }
};

plugins.cpu_usage_idle = {
  id: "cpu",
  serverDelay: 60e3,
  key: "cpu",
  subkeys: [{key: "usage_idle"}],
  labels: { cpu: 'cpu-total' },
  transformers: {
    onNewPoints: gtss => _.map(gtss, gts => [gts[0], 100 - gts[1]])
  },
  formatters: {
    formatValue: formatValue.formatPercent
  }
};

plugins.cpu_usage_softirq = {
  id: "cpu",
  serverDelay: 60e3,
  key: "cpu",
  subkeys: [{key: "usage_softirq"}],
  labels: { cpu: 'cpu-total' },
  formatters: {
    formatValue: formatValue.formatPercent
  }
};

plugins.cpu_usage_iowait = {
  id: "cpu",
  serverDelay: 60e3,
  key: "cpu",
  subkeys: [{key: "usage_iowait"}],
  labels: { cpu: 'cpu-total' },
  formatters: {
    formatValue: formatValue.formatPercent
  }
};

plugins.cpu_usage_nice = {
  id: "cpu",
  serverDelay: 60e3,
  key: "cpu",
  subkeys: [{key: "usage_nice"}],
  labels: { cpu: 'cpu-total' },
  formatters: {
    formatValue: formatValue.formatPercent
  }
};

module.exports = plugins;
