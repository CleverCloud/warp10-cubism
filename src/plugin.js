module.exports = (() => {
  const _ = require("lodash");

  const Plugin = function(settings){
    const required = [
      "app_id",
      "displayName",
      "instances",
      "key",
      "subkeys",
      "id",
      "token"
    ];

    // We hope to have the name attribute
    _.each(required, r => {
      if(!_.has(settings, r)){
        throw new Error(`Missing ${r} setting for plugin ${settings.id}`)
      }
    });

    if(settings.id.match(/\s/) !== null){
      throw new Error(`Can't have a space in plugin's id for plugin ${settings.id}`);
    }

    this.app_id = settings.app_id;
    this.displayName = settings.displayName;
    this.clientDelay = settings.clientDelay || 1e3; // additional time the context waits to fetch metrics from the server
    this.gts = {}; // list of all the GTS, index is the instance_id
    this.instances = settings.instances; // list of instances to fetch
    this.toBeDeletedDeployments = [];
    this.key = settings.key; // key to match the GTS
    this.labels = settings.label || {}; // labels to match GTS labels
    this.maxPoints = null;
    this.id = settings.id;
    this.serverDelay = settings.serverDelay || 60e3; // delay to wait values from server in seconds
    this.subkeys = settings.subkeys;
    this.token = settings.token; // Token to read metrics
    this.transformers = settings.transformers || {}; // an object of function transforming the data
    this.step = settings.step || 1e3; // Delay the client refreshes
    // value for bucketize interval. It's updated each time we fetch metrics with a different start and stop time
    this.bucketizeInterval = 1e6;
    this.fillMissingPoints = _.has(settings, 'fillMissingPoints') ? settings.fillMissingPoints : true;
    this.pointsRange = null;
    this.state = "INITIAL";
    this.unit = settings.unit || null;
  };

  Plugin.prototype.setGts = function(gts){ this.gts = gts; return this; };
  Plugin.prototype.setInstances = function(instances) { this.instances = instances; return this; };
  Plugin.prototype.setKey = function(key){ this.key = key; return this; };
  Plugin.prototype.setLabels = function(labels){ this.labels = labels; return this; };
  Plugin.prototype.setMaxPoints = function(maxPoints) { this.maxPoints = maxPoints; return this; };
  Plugin.prototype.setSubkeys = function(subkeys){ this.subkeys = subkeys; return this; };
  Plugin.prototype.setToken = function(token) { this.token = token; return this; };
  Plugin.prototype.setClientDelay = function(delay) { this.clientDelay = delay; return this; };
  Plugin.prototype.setServerDelay = function(delay) { this.serverDelay = delay; return this; };
  Plugin.prototype.setBucketizeInterval = function(interval) { this.bucketizeInterval = interval; return this; };
  Plugin.prototype.setPointsRange = function(start, stop) { this.pointsRange = stop.getTime() - start.getTime(); return this; };
  Plugin.prototype.addDeploymentToBeDeleted = function(deployNumber) { this.toBeDeletedDeployments.push(parseInt(deployNumber)); return this; };
  Plugin.prototype.getBucketizeInterval = function() { return this.bucketizeInterval; };
  Plugin.prototype.getInstances = function() { return this.instances; };
  Plugin.prototype.getMaxPoints = function() { return this.maxPoints; };
  Plugin.prototype.getClientDelay = function() { return this.clientDelay; };
  Plugin.prototype.getDisplayName = function() { return this.displayName; };
  Plugin.prototype.getRawServerDelay = function() { return this.serverDelay; };
  Plugin.prototype.getStep = function() { return this.step; };
  Plugin.prototype.getState = function() { return this.state; };
  Plugin.prototype.getUnit = function() { return this.unit; };
  Plugin.prototype.getToBeDeletedDeployment = function(deployNumber) {
    return this.toBeDeletedDeployments.find(d => d === parseInt(deployNumber));
  };
  Plugin.prototype.removeDeploymentToBeDeleted = function(deployNumber) {
    this.toBeDeletedDeployments = this.toBeDeletedDeployments.filter(d => d !== parseInt(deployNumber));
    this.removeInstancesOf(deployNumber);
    return this;
  };
  Plugin.prototype.getServerDelay = function() {
    // we also wait 10s for the metrics to be sent and aggregated
    // by warp10
    return this.getRawServerDelay() + 10e3;
  };
  Plugin.prototype.getGts = function(instanceId, subkey){
    if(!instanceId && !subkey){
      return this.gts;
    }

    if(!this.gts){
      return null;
    } else if(!this.gts[instanceId]){
      return null;
    } else if(!this.gts[instanceId][subkey]){
      return null;
    } else if(this.gts[instanceId][subkey].length <= 0){
      return null;
    } else{
      return this.gts[instanceId][subkey];
    }
  };
  Plugin.prototype.getInstancesFromGts = function(){
    return _.keys(this.gts);
  };
  Plugin.prototype.getSubkeys = function(){ return this.subkeys; };
  Plugin.prototype.getInstancesLabel = function(instances) {
    // If there are 0 instances, return ""
    // If there is 1 instance, return a exact match
    // if there are more than 1 instance, return a regex match
    if(instances.length === 0){
      return "";
    } else if(instances.length === 1){
      return `=${_.first(instances).id}`;
    } else{
      const instancesIds = _.map(instances, 'id').join('|');
      return `~(${instancesIds})`;
    }
  };
  Plugin.prototype.getId = function(){ return this.id; };

  Plugin.prototype.getFetchWarpscript = function(start, stop, includeInstances){
    if(!this.token){
      throw new Error(`Token not defined for metrics plugin ${this.id}`);
    }

    if(!this.key){
      throw new Error(`Key is not defined for metrics plugin ${this.id}`);
    }

    let labels = _.extend({}, _.clone(this.labels), {
      'app_id': `=${this.app_id}`
    });

    if(includeInstances) {
      labels = _.extend({}, labels, {
        'host': this.getInstancesLabel(this.instances)
      });
    }

    const lelems = Object.keys(labels).map(k => {
      return `'${k}' '${labels[k]}'`;
    });

    const rStart = start === "NOW" ? `${start}` : `'${start}'`;
    const rStop = typeof stop === "number" ? `${stop}` : `'${stop}'`;

    const _key = this.key.replace(/{}/, this.getKeyFromSubkeys(this.subkeys));

    return `
    "${this.token}"
    '${_key}'
    { ${lelems.join(' ')} }
    ${rStart} ${rStop}
    FETCH`;
  };

  Plugin.prototype.getWarpscript = function(start, stop, includeInstances = true) {
    const realStart = this.getRealStart(start);
    this.setBucketizeInterval(this.computeBucketizeInterval(realStart, stop));
    const ws = this.getFetchWarpscript(realStart, stop, includeInstances);

    return this.transformers.onGetWarpscript ?
      this.transformers.onGetWarpscript(ws, this) :
      this.interpolateWarpscript(this.bucketizeWarpscript(ws, "mean", 0, this.getBucketizeInterval(), 0));
  };

  Plugin.prototype.bucketizeWarpscript = (ws, bucketizer, lastbucket, bucketspan, bucketcount) => {
    bucketizer  = bucketizer || "mean";
    lastbucket  = lastbucket !== undefined ? lastbucket : 0;
    bucketspan  = bucketspan !== undefined ? bucketspan : 1e6;
    bucketcount = bucketcount !== undefined ? bucketcount : 0;

    return `[ ${ws} bucketizer.${bucketizer} ${lastbucket} ${bucketspan} ${bucketcount} ]
          BUCKETIZE`;
  };

  Plugin.prototype.interpolateWarpscript = (ws) => `${ws} INTERPOLATE`;

  // Not sure how to call those arguments..
  Plugin.prototype.mapperWarpscript = function(ws, mapper, first, second, third) {
    return `[
      ${ws}
      mapper.${mapper} ${first} ${second} ${third}
    ]
    MAP`;
  };

  Plugin.prototype.mapperMul = function(ws, constant, prewindow, postwindow, occurences) {
    if(typeof constant === "number") {
      console.warning("mapper.mul doesn't seem to like non-float numbers, use a string..");
    }
    return `[
      ${ws}
      ${constant} mapper.mul ${prewindow} ${postwindow} ${occurences}
    ]
    MAP`;
  };

  Plugin.prototype.newPoints = function(gtss){
    const pluginGtss = gtss[this.id];
    if(this.state === "INITIAL"){
      this.state = "WITH_POINTS"
    }

    if(pluginGtss){
      _.each(pluginGtss, gts => {
        const key = gts.c.replace(_.first(gts.c.split('.')) + '.', '');
        // This if is mostly to avoid useless allocation when we don't have a transformer
        if(this.transformers.onNewPoints){
          const _gts = _.extend({}, gts, {
            v: this.transformers.onNewPoints(gts.v, key)
          });
          this.storePoints(_gts, key);
        } else {
          this.storePoints(gts, key);
        }
      });

      const toBeDeletedDeployments = this.getDeployNumbersToClean(this.gts);
      toBeDeletedDeployments.forEach(deployNumber => this.addDeploymentToBeDeleted(deployNumber));
    }

    return this;
  };

  Plugin.prototype.storePoints = function(gts, key){
    let values = _.sortBy(gts.v, v => v[0]);
    const instanceId = gts.l.host;

    let currentGts = this.getGts();

    if(!currentGts){
      currentGts = {};
    }

    if(!currentGts[instanceId]){
      currentGts = _.extend({}, currentGts, {
        [instanceId]: {}
      });
    }

    if(!currentGts[instanceId][key] || currentGts[instanceId][key].length === 0){
      if(this.fillMissingPoints && values.length < this.maxPoints && values.length > 0){
        const diff = this.maxPoints - values.length;
        const step = this.getStep() * 1e3;
        let timestamp = _.first(values)[0] - (diff * step);
        let missingValues = _.times(diff, () => {
          let gts = [timestamp, 0];
          timestamp += step;
          return gts;
        });

        values = missingValues.concat(values);
      }
      currentGts[instanceId][key] = values;
    } else {
      const deduplicatedPoints = this.deduplicatePoints(_.clone(currentGts[instanceId][key]), values);
      const fullPoints = currentGts[instanceId][key].concat(deduplicatedPoints);
      const cleanedOfOldPoints = this.cleanOldPoints(fullPoints);

      currentGts[instanceId][key] = cleanedOfOldPoints;
    }

    this.setGts(currentGts);
  };

  Plugin.prototype.deduplicatePoints = (oldValues, newValues) => {
    const lastOldValue = _.last(oldValues);

    if(!lastOldValue){
      return newValues;
    }

    let removeCounter = 0;
    let length = newValues.length;
    while(removeCounter < length){
      if(newValues[removeCounter][0] > lastOldValue[0]){
        break;
      } else {
        ++removeCounter;
      }
    }

    return newValues.slice(removeCounter, length);
  };

  Plugin.prototype.getKeyFromSubkeys = function(subkeys){
    return _.chain(subkeys)
      .flatten()
      .map('key')
      .value()
      .join('|');
  };

  Plugin.prototype.cleanOldPoints = function(points){
    const max = this.getMaxPoints();

    if(this.pointsRange) {
      const min = (new Date().getTime() - this.pointsRange) * 1e3;
      const index = _.findIndex(points, p => p[0] >= min);
      if(index) {
        return points.slice(index, points.length);
      } else {
        return points;
      }
    } else {
      if(!max || points.length <= max){
        return points;
      }

      return points.slice(points.length - max, points.length);
    }
  };

  Plugin.prototype.stop = function(){
    this.gts = {};
  };

  Plugin.prototype.computeBucketizeInterval = function(start, stop){
    if(start === "NOW") {
      return this.getBucketizeInterval();
    }

    const mStart = moment(start);
    const mStop = moment(stop);

    if(!mStart.isValid() || !mStop.isValid()) {
      return this.getBucketizeInterval();
    }

    const diff = mStop.diff(mStart) / 1e3;
    return Math.ceil(diff / this.getMaxPoints()) * 1e6;
  };

  Plugin.prototype.getRealStart = function(start){
    if(start === "NOW") {
      return start;
    } else {
      const mStart = moment(start);
      if(mStart.isValid()) {
        return mStart.subtract(this.serverDelay, "milliseconds").toISOString()
      } else {
        return start;
      }
    }
  };

  Plugin.prototype.resetGts = function(){
    this.gts = {};
    return this;
  };

  Plugin.prototype.getDeployNumbersToClean = function(gts){
    const limitTimestamp = new Date().getTime() - (this.getMaxPoints() * 1e3);

    const outdatedInstances = _.reduce(gts, (outdatedInstances, _gts, instanceId) => {
      const noMoreGts = _.every(_gts, g => {
        if(g.length === 0){
          return false;
        } else {
          return (_.last(g)[0] / 1e3) <= limitTimestamp;
        }
      });

      if(noMoreGts){
        const instance = this.getInstances().find(i => i.id === instanceId);
        if(instance){
          outdatedInstances.push(instance);
        }
      }

      return outdatedInstances;
    }, []);

    const outdatedByDeployment = _.groupBy(outdatedInstances, i => i.deployNumber);
    const deploymentsToDelete = _.chain(outdatedByDeployment)
      .pickBy((instances, deployNumber) => {
        const instancesWithSameDeployNumber = this.getInstances().filter(i => i.deployNumber === parseInt(deployNumber));
        return instances.length === instancesWithSameDeployNumber.length;
      })
      .keys()
      .map(d => parseInt(d))
      .uniq()
      .value();

    return deploymentsToDelete;
  };

  Plugin.prototype.removeInstancesOf = function(deployNumber){
    this.instances = this
      .getInstances()
      .filter(i => {
        if(i.deployNumber === parseInt(deployNumber)){
          this.gts[i.id] = undefined;
          delete this.gts[i.id];
          return false;
        } else {
          return true;
        }
      });
  };

  return Plugin;

})();
