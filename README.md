Warp10 Cubism
=============

Warp10 Cubism is a [Warp10](www.warp10.io) graphical plugin to display data using [Cubism](https://square.github.io/cubism/)

While it's not yet quite ready and mostly [Clever Cloud](https://www.clever-cloud.com/) oriented for now,
it should be usuable if you want to display some Geo time series coming from Warp10.

This plugin uses the `Mobius` interface of Warp10 through `Websocket` to live stream the points.

This module relies heavly on [Bacon.js](https://baconjs.github.io/) to receive from / send data to the module.

## Build and use

You can build this module (LESS and JST) by using grunt.

You can then require this module using webpack or any other tool.

## API

The module is a function accepting an object:

- `$container`: A `JQuery` object where the module will live with a `<div class="metrics-overview"></div>` in it
- `s_token`: A Bacon.js property with a `read` token for Warp10
- `s_instances`: A Bacon.js property with an array of Clever Cloud instances
- `s_requestUnload`: A Bacon.js stream which is used to stop actions when an event is received (used with `.takeUntil()`)
- `app`: A Clever Cloud application object
- `owner`: A Clever Cloud owner object (user or organization) which own the application
- `b_inputEvents`: A Bacon.js bus used to send events to the module
- `b_outputEvents`: A Bacon.js bus used to receive events from the module
- `Translations`: A function `(key: string) -> string` that returns the translation corresponding to the given key


## Events

It's an object of the form: `Object<T>{type: string, data: T}` where `T` can be anything (only used in `CHANGE_VIEW` for now)

### Events to send to the module

- `PAGE_READY`: To send when the page is ready, no data (mandatory)
- `PAGE_RESIZE_START`: To send when the page is resizing. It will show a loader (optional)
- `PAGE_RESIZE_END`: To send when the page resizing is done. It will redraw cubism and fetch missing points (optional)

### Events received from the module

- `CHANGE_VIEW`: This event is most likely not used unless you add other views (like it's done in the Clever Cloud console).
You will receive the new view to show, which may be `GLOBAL` (string) here. When received, you need to re-instanciate the $Metrics module.

## Example

```javascript
const state = $Metrics({...});
$Metrics.start(state);
```
