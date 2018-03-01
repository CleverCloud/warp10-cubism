module.exports = (() => {
  const _ = require("lodash");

  // merge points when we try to view more than 3 days;
  const MERGE_POINTS_ZOOM_SECONDS = 3600 * 24 * 3;

  const Plugin = function(settings){
    const required = [
      "app_id",
      "instances",
      "key",
      "subkeys",
      "id",
      "token",
      "Translations"
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
    this.clientDelay = settings.clientDelay || 1e3; // additional time the context waits to fetch metrics from the server
    this.gts = {}; // list of all the GTS, index is the instance_id
    this.instances = settings.instances; // list of instances to fetch
    this.toBeDeletedDeployments = [];
    this.key = settings.key; // key to match the GTS
    this.labels = settings.labels || {}; // labels to match GTS labels
    this.maxPoints = null;
    this.id = settings.id;
    this.serverDelay = settings.serverDelay || 60e3; // delay to wait values from server in seconds
    this.subkeys = settings.subkeys;
    this.token = settings.token; // Token to read metrics
    this.transformers = settings.transformers || {}; // an object of function transforming the data
    this.step = settings.step || 1e3; // Delay the client refreshes
    this.fillMissingPoints = _.has(settings, 'fillMissingPoints') ? settings.fillMissingPoints : true;
    this.pointsRange = null;
    this.state = "INITIAL";
    this.formatters = settings.formatters || {}; // an object of functions formatting the data
    this.Translations = settings.Translations;
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
  Plugin.prototype.setPointsRange = function(start, stop) { this.pointsRange = stop.getTime() - start.getTime(); return this; };
  Plugin.prototype.addDeploymentToBeDeleted = function(deployNumber) { this.toBeDeletedDeployments.push(parseInt(deployNumber)); return this; };
  Plugin.prototype.getInstances = function() { return this.instances; };
  Plugin.prototype.getMaxPoints = function() { return this.maxPoints; };
  Plugin.prototype.getClientDelay = function() { return this.clientDelay; };
  Plugin.prototype.getRawServerDelay = function() { return this.serverDelay; };
  Plugin.prototype.getStep = function() { return this.step; };
  Plugin.prototype.getState = function() { return this.state; };
  Plugin.prototype.getDisplayName = function() {
    const subkeys = _.map(this.subkeys, "key").join('-');
    const translationKey = `metrics.metric-${this.key}-${subkeys}`;
    return this.Translations(translationKey);
  };
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

    const _key = this.getFullKey(this.key, this.subkeys);

    return `
    "${this.token}"
    '${_key}'
    { ${lelems.join(' ')} }
    ${rStart} ${rStop}
    FETCH`;
  };

  Plugin.prototype.getWarpscript = function(start, stop, includeInstances = true) {
    const realStart = this.getRealStart(start);

    const bucketizeStop = start !== "NOW" ?
      (new Date(stop)).getTime() * 1e3 :
      0;

    const shouldMerge = this.shouldMerge(start, stop);

    const fetchWarpscript = this.getFetchWarpscript(realStart, stop, includeInstances);
    const mergedWarpscript = shouldMerge ?
      this.merge(fetchWarpscript) :
      fetchWarpscript;

    const interpolatedWarpscript = this.transformers.onGetWarpscript ?
      this.transformers.onGetWarpscript(mergedWarpscript, this) :
      this.interpolateWarpscript(this.bucketizeWarpscript(mergedWarpscript, "mean", bucketizeStop, this.getBucketizeInterval(start, stop), 0));

    if(!shouldMerge && start !== "NOW"){
      return this.deleteGTSWhenNotEnoughPoints(interpolatedWarpscript, 1);
    } else {
      return interpolatedWarpscript;
    }
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

  Plugin.prototype.merge = (ws) => `${ws} MERGE`;

  // This function takes a warpscript that returns a list of GTS
  // and for each GTS, drop it or not if it only has one value
  Plugin.prototype.deleteGTSWhenNotEnoughPoints = (ws, threshold = 1) => {
    return `
      0 'DROP_COUNT' STORE
      <%
        'GTS' STORE
        $GTS

        SIZE
        'GTS_SIZE' STORE

        $GTS
        <% $GTS_SIZE ${threshold} <= %>
        <%
            DROP
            $DROP_COUNT 1 +
            'DROP_COUNT' STORE
        %>
        IFT
      %>
      'DROP_NOT_ENOUGH_DATA' STORE

      ${ws}
      'FETCHED_DATA' STORE

      $FETCHED_DATA SIZE
      'FETCHED_SIZE' STORE

      $FETCHED_DATA
      $DROP_NOT_ENOUGH_DATA
      FOREACH

      $FETCHED_SIZE $DROP_COUNT -
      ->LIST
    `;
  };

  Plugin.prototype.newPoints = function(gtss){
    const pluginGtss = gtss[this.id];

    if(pluginGtss){
      _.each(pluginGtss, gts => {
        const key = gts.c.replace(_.first(gts.c.split('.')) + '.', '');
        const subkey = gts.c.replace(`${this.key}\.`, '');
        const hasSubkey = this.subkeys.find(s => s.key === subkey);
        if(hasSubkey !== null) {
          // This if is mostly to avoid useless allocation when we don't have a transformer
          if(this.transformers.onNewPoints){
            const _gts = _.extend({}, gts, {
              v: this.transformers.onNewPoints(gts.v, key)
            });
            this.storePoints(_gts, key);
          } else {
            this.storePoints(gts, key);
          }
        }
      });

      const toBeDeletedDeployments = this.getDeployNumbersToClean(this.gts);
      toBeDeletedDeployments.forEach(deployNumber => this.addDeploymentToBeDeleted(deployNumber));
    }

    if(_.keys(this.gts).length > 0) {
      this.state = "WITH_POINTS";
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

  Plugin.prototype.getFullKey = function(key, subkeys){
    if(subkeys.length === 0) {
      return key;
    } else if(subkeys.length === 1) {
      return `${key}.${subkeys[0].key}`;
    } else {
      const formattedSubkeys = _.chain(subkeys)
        .flatten()
        .map('key')
        .value()
        .join('|');
      return `~${key}.(${formattedSubkeys})`;
    }
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

  Plugin.prototype.getBucketizeInterval = function(start, stop){
    const bucketizeDefault = 1e6; // 1s
    if(start === "NOW") {
      return bucketizeDefault;
    }

    const mStart = moment(start);
    const mStop = moment(stop);

    if(!mStart.isValid() || !mStop.isValid()) {
      return bucketizeDefault;
    }

    const diff = mStop.diff(mStart) / 1e3;
    // in seconds
    const minute = 60;
    const hour = 3600;
    const day = hour * 24;
    const month = day * 30;

    if(diff <= (minute * 5)) {
      return 1e6;
    } else if(diff <= (minute * 15)) {
      return 3e6;
    } else if(diff <= hour) {
      return 10e6;
    } else if(diff <= (hour * 2)) {
      return 30e6;
    } else if(diff <= (hour * 3)) {
      return 60e6;
    } else if(diff <= (hour * 6)) {
      return (minute * 2) * 1e6;
    } else if(diff <= (hour * 12)) {
      return (minute * 5) * 1e6;
    } else if(diff <= day) {
      return (minute * 10) * 1e6;
    } else if(diff <= (day * 3)) {
      return hour * 1e6;
    } else if(diff <= (day * 7)) {
      return (hour * 3) * 1e6
    } else if(diff <= (day * 14)) {
      return (hour * 6) * 1e6;
    } else if(diff <= month) {
      return (hour * 12) * 1e6;
    } else if(diff <= (month * 3)) {
      return day * 1e6;
    } else {
      return (day * 7) * 1e6;
    }
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

  Plugin.prototype.shouldMerge = (start, stop) => {
    if(start !== "NOW"){
      const dateStart = new Date(start);
      const dateStop = new Date(stop);
      const diff = (dateStop.getTime() - dateStart.getTime()) / 1e3;
      if(diff > MERGE_POINTS_ZOOM_SECONDS) {
        return true;
      }
    }

    return false;
  }

  return Plugin;

})();
