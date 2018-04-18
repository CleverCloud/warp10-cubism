module.exports = (() => {
  const _ = require("lodash");
  const Bacon = require("baconjs");
  const $ = require("jquery");

  const Plugin = require("./plugin.js");
  const $Warp10 = require("./warp10.js");
  const $Global = require("./global.js");
  const Time = require("./time.js");

  const $Metrics = (settings) => {
    const state = {
      $container: settings.$container,
      $metricsContainer: settings.$container.find('.metrics-overview'),
      s_token: settings.s_token,
      s_instances: settings.s_instances,
      s_requestUnload: settings.s_requestUnload,
      app: settings.app,
      owner: settings.owner,
      viewType: settings.viewType || "GLOBAL",
      $Metrics,
      $Warp10: $Warp10,
      b_inputEvents: settings.b_inputEvents,
      b_outputEvents: settings.b_outputEvents,
      Translations: settings.Translations || function(key) { return key },
    };

    state.b_plugins = new Bacon.Bus();
    state.s_plugins = state.b_plugins.toProperty();
    state.s_plugins.takeUntil(state.s_requestUnload.first()).onValue(() => { /* lazy */ });

    state.s_requestUnload.first().onValue(() => {
      state.b_plugins.end();
    });
    return state;
  };

  $Metrics.start = (state) => {
    $Metrics.displayView(state);
  };

  $Metrics.displayView = (state) => {
    $Metrics.loading(state);

    if(state.viewType === "GLOBAL"){
      $Metrics.globalView(state);
    } else {
      console.error(new Error(`${type} isn't a supported view`));
    }
  };

  $Metrics.globalView = (state) => {
    state
      .b_inputEvents
      .filter(event => event.type === "PAGE_READY")
      .map(() => $Metrics.setMaxPoints(state))
      .onValue(_state => $Global(_state));
  };

  $Metrics.initPlugins = (state, plugins) => {
    // TODO: require instance type plugins
    return Bacon.combineWith((token, instances) => {
      try{
        return _.map(plugins, conf => {
          const pluginConfiguration = _.extend({}, conf, {
            app_id: state.app.id,
            token,
            instances,
            Translations: state.Translations
          });

          const newPlugin = new Plugin(pluginConfiguration);
          // We set the maxPoints to this so we can re-render the graph without loosing points
          // we need to take the server delay into account
          return newPlugin.setMaxPoints(state.maxPoints + (newPlugin.getServerDelay() / 1e3));
        });
      }catch(e){console.log("init", e)} // TODO: handle the fact that a plugin can be badly inited and display an error
    }, state.s_token.first(), state.s_instances.first());
  };

  $Metrics.getFetchCommand = ((plugin, start, stop, includeInstances = true) => {
    return `'${plugin.getId()}' ${plugin.getWarpscript(start, stop, includeInstances)}`;
  });

  $Metrics.openWebsocket = (state) => {
    const mobiusUrl = `${Console.configuration.WSS_WARP10_HOST}/mobius`;
    const s_warp10 = $Warp10.websocket(mobiusUrl);
    const s_end = s_warp10.filter(false).mapEnd();

    const s_stop = Bacon.mergeAll(state.s_requestUnload.first());

    return s_warp10
      .merge(s_end.flatMapLatest(() => $Metrics.openWebsocket(state)))
      .takeUntil(s_stop);
  };

  $Metrics.listenToWarp10Events = (state, s_warp10, origin) => {
    const s_warp10Ready = s_warp10
      .filter(({type, value}) => type === "WEBSOCKET_STATE_CHANGED" && value === 1)
      .map(true)
      .toProperty(false);

    s_warp10
      .filter(({ type }) => type === "WEBSOCKET_ERROR")
      .map(".value")
      .log("Websocket error");

    s_warp10
      .filter(({ type, value }) => type === "WEBSOCKET_STATE_CHANGED")
      .onValue(({ value }) => {
        if(value === 0) {
          console.log("Websocket state: Connecting");
        } else if(value === 1) {
          console.log("Websocket state: Open");
        } else if(value === 2) {
          console.log("Websocket state: Closing");
        } else if(value === 3) {
          console.log("Websocket state: Closed");
        }
      });

    const s_websocketData = s_warp10
      .filter(({type}) => type === "WEBSOCKET_DATA");

    return {
      s_warp10Ready,
      s_websocketData
    };
  };

  $Metrics.listenToFirstPoints = (state, origin) => {
    return b_data
      .takeUntil(state.s_requestUnload)
      .filter(({type, origin}) => type === "FIRST_POINTS" && origin === origin);
  };

  $Metrics.initialFetch = (state, start, stop, includeInstances = true) => {
    return state.s_plugins.first().map(plugins => {
      const pluginsWarpscript = _.map(plugins, plugin => {
        // what happens here:
        // we want to fetch the points relatively to how often the points are sent and the step of the graph
        // So, imagine you want to display 1440 points with a server refresh of 10s and a step of 1s:
        // 1440 / (10e3 / 1e3) => 144
        // Now, if we want to display 1440 points with a server refresh of 60s and a step of 60s (because we don't
        // want to interpolate or bucketize it):
        // 1440 / (60e3 / 60e3) => 1440
        let _stop;
        let _start;
        if(start){
          _start = Time.getDate(start).toISOString();
        } else {
          _start = "NOW";
        }

        if(stop) {
          _stop = Time.getDate(stop).toISOString();
        } else {
          _stop = -Math.ceil(plugin.getMaxPoints() / (plugin.getRawServerDelay() / plugin.getStep()));
        }

        return $Metrics.getFetchCommand(plugin, _start, _stop, includeInstances);
      }).join('\n');

      return `{
        ${pluginsWarpscript}
      }`;
    });
  };

  $Metrics.continuousFetch = (state, interval = 1e3) => {
    const s_stop = Bacon.mergeAll(state.s_requestUnload.first());
    return state.s_plugins
      .map(plugins => {
        const pluginsWarpscript = _.map(plugins, plugin => {
          // we get one more point, in case we are too late
          const pointsToFetch = Math.ceil((interval / plugin.getRawServerDelay())) + 1;
          return $Metrics.getFetchCommand(plugin, "NOW", -pointsToFetch);
        }).join('\n');

        return `{
          ${pluginsWarpscript}
        }`;
      })
      .sampledBy(Bacon.interval(interval))
      .takeUntil(s_stop);
  };

  $Metrics.listenForPluginsUpdates = (state) => {
    const s_newPlugins = Bacon
      .combineTemplate({
        token: state.s_token,
        instances: state.s_instances
      })
      .flatMapLatest(({token, instances}) => state.s_plugins.first().map(plugins => ({token, instances, plugins})))
      .map(({token, instances, plugins}) => {
        return _.map(plugins, plugin => {
          const _instances = _.uniqBy(plugin.getInstances().concat(instances), i => i.id);
          return plugin
            .setInstances(_instances)
            .setToken(token);
        });
      })
      .takeUntil(state.s_requestUnload.first());

    state.b_plugins.plug(s_newPlugins);
  };

  $Metrics.onWarp10Data = (data) => {
    return $Metrics.parseWarp10Data(data);
  };

  $Metrics.parseWarp10Data = (data) => {
    // try/catch in case we can't deserialize the JSON
    try{
      // We simple extract the data from the websocket, parse it as JSON
      // and check that it's not empty
      const _data = _.first(JSON.parse(data.value.data));
      return _.size(_data) > 0 ? _data : null;
    } catch(e){
      console.error("Error while parsing data from warp10", e, data);
      return null;
    }
  };

  $Metrics.onResizeStart = (state) => {
    $Metrics.loading(state);

    if(state.viewType === "GLOBAL") {
      // TODO: use $Global module
      const $Cubism = require("./cubism.js");
      $Cubism.clear({
        $container: state.$metricsContainer
      }).onValue(() => { /* Lazy */ });
    }
  };

  $Metrics.onResizeEnd = (state) => {
    $Metrics.switchView(state, state.viewType.toLowerCase());
  };

  $Metrics.loading = (state) => {
    state.$container.find('.metrics-loader').removeClass('hidden');
    state.$container.find('.metrics-simple-view').addClass('hidden');
  };

  $Metrics.unloading = (state) => {
    state.$container.find('.metrics-loader').addClass('hidden');
  };

  $Metrics.savePoints = (state, data) => {
    const s_newPlugins = state.s_plugins
      .first()
      .map(plugins => {
        return _.map(plugins, plugin => {
          return plugin.newPoints(data);
        });
      });

    state.b_plugins.plug(s_newPlugins);
    return s_newPlugins;
  };

  $Metrics.switchView = (state, view) => {
    const event = {
      type: "CHANGE_VIEW",
      data: view
    };

    state.b_outputEvents.push(event);
  };

  $Metrics.setMaxPoints = (state) => {
    return _.extend({}, state, {
      maxPoints: state.$container.find(".card-container").width()
    });
  };

  $Metrics.noPointsYet = (state) => {
    $Metrics.loading(state);
    state.$container.find('.metrics-loading-reasons').removeClass('hidden');
  };

  return $Metrics;
})();
