const formatBytes = (value) => {
  let val = parseInt(value);
  if(val < 0) {
    val *= -1;
  }

  if(val < 1024) {
    return `${val.toString()}B`;
  } else if(val < Math.pow(1024, 2)) {
    const divided = (val / Math.pow(1024, 1)).toFixed(1);
    return `${divided.toString()}KiB`;
  } else if(val < Math.pow(2043, 3)) {
    const divided = (val / Math.pow(1024, 2)).toFixed(1);
    return `${divided.toString()}MiB`;
  } else {
    const divided = (val / Math.pow(1024, 3)).toFixed(1);
    return `${divided.toString()}GiB`;
  }
};

const formatSeconds = (value) => `${value.toString()}/s`;

const formatPercent = (value) => {
  const round = Math.round(parseFloat(value));
  return `${round.toString()}%`;
};

module.exports = {
  formatBytes,
  formatSeconds,
  formatPercent,
};
