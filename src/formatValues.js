const formatBytes = (value) => {
  const val = parseInt(value);
  if(val < 1024) {
    return `${val.toString()}B`
  } else if(val < Math.pow(1024, 2)) {
    return `${val.toString()}KiB`;
  } else if(val < Math.pow(2043, 3)) {
    return `${val.toString()}MiB`;
  } else {
    return `${val.toString()}GiB`;
  }
};

const formatSeconds = (value) => `${value.toString()}/s`;

module.exports = {
  formatBytes,
  formatSeconds
}
