// Setup Web Worker polyfill for Node.js test environment
if (typeof Worker === "undefined") {
  // The polyfill will be loaded dynamically in toolRunFlow
  // This file just ensures the environment is ready
}

