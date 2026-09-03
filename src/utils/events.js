// adopted from: https://github.com/mrdoob/eventdispatcher.js/blob/master/src/EventDispatcher.js

export class EventDispatcher {
  constructor() {
    this._listeners = {};
  }

  dispatch(eventName, data) {
    if (this._listeners === undefined) return;

    const listeners = this._listeners;
    const listenerArray = listeners[eventName];

    if (listenerArray !== undefined) {
      // Make a copy, in case listeners are removed while iterating.
      const array = listenerArray.slice(0);

      for (let i = 0, l = array.length; i < l; i++) {
        array[i].call(this, data);
      }
    }
  }

  on(eventName, callback) {
    if (this._listeners === undefined) this._listeners = {};

    const listeners = this._listeners;

    if (listeners[eventName] === undefined) {
      listeners[eventName] = [];
    }

    if (listeners[eventName].indexOf(callback) === -1) {
      listeners[eventName].push(callback);
    }
  }

  off(eventName, callback) {
    if (this._listeners === undefined) return;

    const listeners = this._listeners;
    const listenerArray = listeners[eventName];

    if (listenerArray !== undefined) {
      const index = listenerArray.indexOf(callback);

      if (index !== -1) {
        listenerArray.splice(index, 1);
      }
    }
  }
}
