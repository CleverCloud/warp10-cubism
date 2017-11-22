module.exports = (() => {
  const Bacon = require("baconjs");

  let hidden, visibilityChange;
  if (typeof document.hidden !== "undefined") { // Opera 12.10 and Firefox 18 and later support 
    hidden = "hidden";
    visibilityChange = "visibilitychange";
  } else if (typeof document.msHidden !== "undefined") {
    hidden = "msHidden";
    visibilityChange = "msvisibilitychange";
  } else if (typeof document.webkitHidden !== "undefined") {
    hidden = "webkitHidden";
    visibilityChange = "webkitvisibilitychange";
  }

  const s_pageVisibilityCB = Bacon.fromEvent(document, visibilityChange);

  return () => {
    const s_visible = s_pageVisibilityCB.filter(() => {
      return !document[hidden];
    });
    const s_hidden = s_pageVisibilityCB.filter(() => {
      return document[hidden];
    });

    return {s_visible, s_hidden};
  };
})();
