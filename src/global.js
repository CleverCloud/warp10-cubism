module.exports = (() => {
  const _ = require("lodash");
  const Bacon = require("baconjs");

  const $Cubism = require("./cubism.js");
  const PluginsLoader = require("./plugins-loader.js");

  const $Global = (settings) => {
    $Global.init(_.extend({}, settings, {
      pointsFetchState: "NOT_FETCHED_YET"
    }));
  };

  $Global.init = (state) => {
    const s_plugins = state.$Metrics.initPlugins(state, PluginsLoader.globalPlugins(state.app));
    state.b_plugins.plug(s_plugins);

    const {s_firstPoints} = $Global.initStream(state);

    // We want to wait to have the first points before rendering anything.
    const s_newInstances = s_firstPoints.flatMapLatest(() => {
      return Bacon.mergeAll(
        state.s_instances.first(),
        state.s_instances.skip(1)
      );
    });

    s_newInstances
      .flatMapLatest(instances => {
        return state.s_plugins.first().map(plugins => ({instances, plugins}));
      })
      .onValue(({instances, plugins}) => $Global.drawCubismContexts(state, instances, plugins));

    s_firstPoints.onValue(() => {
      $Global.onGlobalViewFirstPoints(state);
    });

    $Global.listenInputEvents(state);
  };

  $Global.initStream = (state) => {
    const s_warp10Websocket = state.$Metrics.openWebsocket(state);
    //ajout des listeners warp10
    const {s_websocketData, s_warp10Ready} = state.$Metrics.listenToWarp10Events(state, s_warp10Websocket);
    state.$Metrics.listenForPluginsUpdates(state);

    s_warp10Ready
      .changes()
      .filter(status => status)
      .flatMapLatest(() => state.$Metrics.initialFetch(state))
      .onValue(state.$Warp10.send);

    const s_warp10 = s_websocketData
      .map(state.$Metrics.onWarp10Data)
      .filter(data => data)
      .flatMapLatest(data => {
        const noData = _.every(data, points => points.length === 0);
        if(noData && state.pointsFetchState === "NOT_FETCHED_YET"){
          state.$Metrics.noPointsYet(state);
          return Bacon.once({status: "NO_DATA"});
        } else {
          state.pointsFetchState = "FETCHED";
          return Bacon.once({status: "DATA", data: data});
        }
      });

    const s_warp10Data = s_warp10.filter(({status}) => status === "DATA").map(".data");
    const s_warp10NoData = s_warp10.filter(({status}) => status === "NO_DATA");

    s_warp10Data
      .onValue(_.partial(state.$Metrics.savePoints, state));

    const s_firstPoints = s_warp10Data
      .first()
      .sampledBy(state.b_plugins) // Wait the plugins to be updated
      .first();

    Bacon
      .mergeAll(s_firstPoints, s_warp10NoData.first())
      .flatMapLatest(() => state.$Metrics.continuousFetch(state))
      .onValue(state.$Warp10.send);

    return {
      s_warp10,
      s_warp10Data,
      s_firstPoints
    };
  };

  $Global.onGlobalViewFirstPoints = (state) => {
    state.$Metrics.unloading(state);
    state.$container.find('.metrics-simple-view').removeClass('hidden');
  };

  $Global.drawCubismContexts = (state, instances, plugins) => {
    $Cubism({
      $container: state.$metricsContainer,
      s_requestUnload: state.s_requestUnload,
      instances,
      plugins,
      s_plugins: state.s_plugins,
      b_plugins: state.b_plugins,
      Translations: state.Translations
    });
  };

  $Global.listenInputEvents = (state) => {
    state.b_inputEvents.onValue(event => {
      try{
      switch(event.type) {
        case "PAGE_RESIZE_START":
          state.$Metrics.onResizeStart(state);
        break;
        case "PAGE_RESIZE_END":
          state.$Metrics.onResizeEnd(state);
        break;
      }
      }catch(e){console.log(e)}
    });
  }

  return $Global;
})();
