// TODO: handle websocket reconnection
// We want to reconnect if there has been a newtwork issue
// Also, we want to send the last sent message to recover in the same state
// b_messages could be a property
//
// If the websocket has been closed because there are no more listeners,
// we should not reconnect
module.exports = (() => {
  const Bacon = require("baconjs");

  // Used to send message through WS
  const b_messages = new Bacon.Bus();

  const $Warp10 = {};

  $Warp10.websocket = (url) => {
    return Bacon.fromBinder((sink) => {
      const ws = new WebSocket(url);

      ws.onopen = () => sink({type: "WEBSOCKET_STATE_CHANGED", value: ws.readyState});
      ws.onmessage = (data) => sink({type: "WEBSOCKET_DATA", value: data});
      ws.onerror = (err) => sink({type: "WEBSOCKET_ERROR", value: new Bacon.Error(err)});
      ws.onclose = () => {
        sink({type: "WEBSOCKET_STATE_CHANGED", value: ws.readyState});
        sink(new Bacon.End());
      };

      // Send all messages in bus
      // TODO: buffer messages while websocket is down
      b_messages
        .filter(() => ws.readyState === 1)
        .onValue(message => {
          try{
            ws.send(message);
          } catch(e){
            sink(new Bacon.Error(e));
          }
        });

      return () => {
        ws.close();
      };
    });
  };

  $Warp10.send = (message) => b_messages.push(message);

  return $Warp10;
})();

