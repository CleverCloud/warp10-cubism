module.exports = (() => {
  const Time = (initial, update) => {
    const diff = new Date().getTime() - initial.getTime();
    const state = { initial, update, diff };
    return state;
  };

  Time.getDate = (state) => {
    if(state.update){
      const now = new Date().getTime();
      return new Date(now - state.diff);
    } else {
      return state.initial;
    }
  };

  Time.getTime = (state) => {
    return Time.getDate(state).getTime();
  };

  Time.doesUpdate = (state) => state.update;

  return Time;
})();
