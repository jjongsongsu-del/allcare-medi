if (typeof globalThis.DOMException === "undefined") {
  class DOMExceptionPolyfill extends Error {
    constructor(message = "", name = "Error") {
      super(message);
      this.name = name;
    }
  }

  globalThis.DOMException = DOMExceptionPolyfill;
}

require("expo-router/entry");
