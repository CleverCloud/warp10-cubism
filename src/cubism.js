module.exports = (() => {
  const _ = require("lodash");
  const $ = require("jquery");
  const cubism = require("cubism");
  const d3 = require("d3");
  const pageVisibility = require("./page-visibility.js");

  const Templates = require("./templates.js");

  const b_contexts = new Bacon.Bus();
  const s_contexts = b_contexts.toProperty([]);

  s_contexts.onValue(() => { /* lazy */ });

  const $Cubism = (settings) => {
    const state = {
      $container: settings.$container,
      instances: settings.instances,
      plugins: settings.plugins,
      s_requestUnload: settings.s_requestUnload,
      s_plugins: settings.s_plugins,
      b_plugins: settings.b_plugins,
      Translations: settings.Translations
    };

    $Cubism.init(state);
    return state;
  };

  $Cubism.init = (state) => {
    state.$container.show();
    const deploymentsNumber = $Cubism.getDeploymentsNumberFromInstances(state.instances, state.plugins);
    const deploymentsToDraw = $Cubism.getDeploymentsToDraw(deploymentsNumber, state.instances, state.plugins, state.$container);
    $Cubism.drawDeployments(state, deploymentsToDraw);

    const pluginsToDraw = $Cubism.getPluginsToDraw(state.plugins, deploymentsToDraw, state.$container);
    $Cubism.drawPlugins(state, pluginsToDraw);

    $Cubism.drawContexts(state, pluginsToDraw);
  };

  $Cubism.getDeploymentsNumberFromInstances = (instances, plugins) => {
    const instancesDeployNumbers = instances
      .map(instance => instance.deployNumber);

    const pluginsDeployNumbers = _.chain(plugins)
      .map(plugin => {
        return plugin
          .getInstances()
          .map(instance => instance.deployNumber);
      })
      .flatten()
      .value();

    return _.chain(instancesDeployNumbers.concat(pluginsDeployNumbers))
      .uniq()
      .sortBy()
      .reverse()
      .value();
  };

  $Cubism.getDeploymentsToDraw = (deploymentsNumber, instances, plugins, $container) => {
    return _.filter(deploymentsNumber, deployNumber => {
      return $container.find(`[data-deploy-number="${deployNumber}"]`).length === 0;
    });
  };

  $Cubism.getPluginsToDraw = (plugins, deploymentsToDraw, $container) => {
    return _.reduce(deploymentsToDraw, (map, deployNumber) => {
      const pluginsToDraw = _.filter(plugins, plugin => {
        const selector = `[data-deploy-number="${deployNumber}"] [data-plugin-id="${plugin.getId()}"]`;
        return $container.find(selector).length === 0;
      });

      if(pluginsToDraw.length > 0){
        map[deployNumber] = pluginsToDraw;
      }

      return map;
    }, {});
  };

  $Cubism.drawDeployments = (state, deploymentsNumber) => {
    _.each(deploymentsNumber, deployNumber => {
      const instance = _.find(state.instances, instance => instance.deployNumber === deployNumber);
      state.$container.prepend(Templates["Metrics.cubism-deploy-context"]({
        deployNumber: deployNumber,
        commitId: instance.commit ?
          instance.commit.substr(0, 8) :
          null,
        T: state.Translations,
      }));
    });
  };

  $Cubism.drawPlugins = (state, pluginsToDraw) => {
    _.each(pluginsToDraw, (plugins, deployNumber) => {
      _.each(plugins, plugin => {
        const $deployNumber = state.$container.find(`div[data-deploy-number="${deployNumber}"]`);

        const $plugin = Templates["Metrics.cubism-context"]({
          pluginId: plugin.getId(),
          pluginName: plugin.getDisplayName(),
          pluginUnit: plugin.getUnit(),
          T: state.Translations,
        });

        $deployNumber.append($plugin);
      });
    });
  };

  $Cubism.createContext = ($context, plugin) => {
    return cubism
      .context()
      .clientDelay(plugin.getClientDelay())
      .serverDelay(plugin.getServerDelay()) // Let the metrics be gathered, batched, and sent
      .step(plugin.getStep()) // Small step to reduce the number of values loaded initially
      .size($context.width());
  };

  $Cubism.addContextData = (state, plugin, deployNumber, context, div) => {
    div
      .selectAll(".horizon")
      .data(_.flatten(_.flatten(
        [
          _.chain(plugin.getInstances())
            .filter(instance => instance.deployNumber === deployNumber)
            .reduce((instances, instance) => {
              const addSubPlugins = _.map(plugin.getSubkeys(), subkey => {
                return $Cubism.getPoints(state, context, instance, plugin, subkey);
              });

              return instances.concat(addSubPlugins);
            }, [])
            .value()
        ]
      )))
      .enter()
      .append("div")
      .attr("class", "horizon")
      .call(context.horizon());
  };

  $Cubism.drawAxis = (div, context) => {
    div
      .append("div")
      .attr("class", "axis")
      .call(context.axis().ticks(12).orient("top"));
  };

  $Cubism.drawRule = (div, context) => {
     div
      .append("div")
      .attr("class", "rule")
      .call(context.rule());
  };

  $Cubism.onContextFocus = (context, $context, i) => {
    d3
      .selectAll($context.find(".value").selector)
      .style("right", i === null ? null : (context.size() - i).toString() + "px");
  };

  $Cubism.drawContext = (state, deployNumber, plugin) => {
    const selector = `[data-deploy-number="${deployNumber}"] [data-plugin-id="${plugin.getId()}"]`;
    const $context = state.$container.find(`${selector} .metrics-context-body`).empty();
    const context = $Cubism.createContext($context, plugin);

    d3.select($context.get(0)).call(function(div){
      $Cubism.drawAxis(div, context);
      $Cubism.addContextData(state, plugin, deployNumber, context, div);
      $Cubism.drawRule(div, context);
    });

    context.on('focus', i => $Cubism.onContextFocus(context, $context, i));

    state.s_requestUnload.first().onValue(function(){
      context.stop();
    });

    return {context, $context};
  };

  $Cubism.drawContexts = (state, pluginsToDraw) => {
    const contexts = _.flatten(_.map(pluginsToDraw, (plugins, deployNumber) => {
      return _.map(plugins, plugin => {
        const dn = parseInt(deployNumber);
        const {context, $context} = $Cubism.drawContext(state, dn, plugin);
        const contextData = {
          deployNumber: dn,
          plugin,
          context,
          $context
        };

        return contextData;
      });
    }));

    s_contexts
      .first()
      .onValue(existingContexts => b_contexts.push(existingContexts.concat(contexts)));

    const s_visibilityStopListen = Console.s_requestUnload.first();

    const {s_visible, s_hidden} = pageVisibility();
    s_hidden
      .takeUntil(s_visibilityStopListen)
      .first()
      .onValue(() => {
        _.each(contexts, ({context}) => context.stop());
      });

    s_visible
      .takeUntil(s_visibilityStopListen)
      .first()
      .onValue(() => {
        // stop here too in case we never receive the hidden event
        _.each(contexts, ({context}) => context.stop());
        $Cubism.drawContexts(state, pluginsToDraw);
      });
  };

  $Cubism.getPoints = (state, context, instance, plugin, subkey) => {
    let graphName = `${instance.displayName}`;

    // If there is only one subkey, the plugin display name will just say the same thing
    // than the subkey one
    if(plugin.getSubkeys().length > 1) {
      const translationKey = `metrics.metric-${plugin.key}.${subkey.key}`;
      let translation = state.Translations(translationKey);
      // if there is no translation
      if(translation === translationKey) {
        translation = subkey.key;
      }

      graphName += ` - ${translation}`;
    }

    const metrics = context.metric(function(start, stop, step, callback) {
      if(plugin.getToBeDeletedDeployment(instance.deployNumber)){
        $Cubism.removeContext(state, context, instance.deployNumber, plugin);
      }

      const allPoints = plugin.getGts(instance.id, subkey.key);
      if(!allPoints){
        return callback(new Error("data not available"));
      }

      // Get an enclosing range of values
      const startTime = start.getTime() * 1e3;
      const stopTime = stop.getTime() * 1e3;
      const fpi = _.findIndex(allPoints, p => p[0] < startTime);
      const lpi = _.findLastIndex(allPoints, p => p[0] > stopTime);
      const elems = allPoints.slice(Math.max(fpi, 0), lpi == -1 ? allPoints.length : lpi + 1);

      if(fpi === -1 && lpi === -1) {
        //callback(new Error("data not available"));
        callback(null, _.range(0, (stop - start) / step).map(() => 0));
        return;
      }

      // Duplicate start or end if needed to have a properly enclosing range
      if(fpi === -1) {
        elems.unshift([allPoints[0][0] - 10 * 1e6, allPoints[0][1]]);
      }
      if(lpi === -1) {
        elems.push([allPoints[allPoints.length - 1][0] - 10 * 1e6, allPoints[allPoints.length - 1][1]]);
      }

      // Fill in the gaps to have plugin.getStep() granularity
      const interpolated = $Cubism.fillArray(elems, plugin.getStep() * 1e3);

      // Trim the interval to satisfy the query
      const points = interpolated.filter(p => p[0] >= startTime && p[0] <= stopTime);

      // Cubism only wants the values, not the timestamps
      callback(null, points.map(p => p[1]));

    }, graphName);

    return metrics;
  };

  $Cubism.fillArray = (a, granularity) => {
    const ret = _.flatten(_.sortBy(a, c => c[0]).map((current, i) => {
      // Only interpolate data when a next point is available
      if(i === a.length - 1) return ([current]);

      const delta = a[i + 1][0] - current[0];
      const points = delta === 0 ? 1 : delta / granularity;
      const slope = (a[i + 1][1] - current[1]) / points;
      return _.range(0, points).map(t => {
          // Step the TimeStamp forward by ${granularity} microseconds
          // Use the linear coefficient for values
          return [current[0] + t * granularity, current[1] + t * slope];
      });
    }));
    return ret;
  };

  // This function returns a stream
  // so it won't be executed until there are listeners
  $Cubism.clearAllContexts = () => {
    return s_contexts
      .first()
      .map(contexts => {
        _.each(contexts, ({context,$context,plugin}) => {
          context.stop();
          plugin.stop();
          $context.remove();
        });
        b_contexts.push([]);
      });
  };

  // This function also returns a stream
  // so it wont't be executed until there are listeners
  // ence the map to mutate the DOM
  $Cubism.clear = (state) => {
    return $Cubism
      .clearAllContexts()
      .map(() => {
        state.$container.find('.deploy-context-container').remove();
      });
  };

  $Cubism.removeContext = (state, context, deployNumber, plugin) => {
    context.stop();
    const selector = `[data-deploy-number="${deployNumber}"] [data-plugin-id="${plugin.getId()}"]`;
    state.$container.find(selector).attr('status', 'to-be-deleted');

    const allContextsInDeployment = state.$container.find(`[data-deploy-number="${deployNumber}"] [data-plugin-id]`);
    const everyToBeDeleted = _.every(allContextsInDeployment, c => $(c).attr('status') === 'to-be-deleted');

    if(everyToBeDeleted){
      $Cubism.removeDeployment(state, deployNumber);
    }
  };

  $Cubism.removeDeployment = (state, deployNumber, plugin) => {
    state.$container.find(`[data-deploy-number=${deployNumber}]`).parents('.deploy-context-container').remove();
    const s_newPlugins = state
      .s_plugins
      .first()
      .map(plugins => {
        plugins.forEach(plugin => plugin.removeDeploymentToBeDeleted(deployNumber));
        return plugins;
      });

    state.b_plugins.plug(s_newPlugins);
  };

  return $Cubism;
})();
