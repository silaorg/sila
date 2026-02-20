import { readConfig } from "./config.js";

export class Land {
  /** @type {string} **/
  #path;
  /** @type {string} */
  #name;
  /** @type {Promise} **/
  #readConfigPromise;

  #isRunning = false;

  get name() {
    return this.#name;
  }

  set name(value) {
    throw new Error("Not implemented");
  }

  /**
   * Construct a Land instance for the given path. The path should point to the directory containing the land's config.json.
   * @param {string} path 
   */
  constructor(path) {
    this.#readConfigPromise = readConfig(path).then(config => {
      this.path = path;
      this.#name = config.name;
    }).catch(error => {
      console.error("Failed to load config:", error);
    });
  }

  async run() {
    if (this.#isRunning) {
      throw new Error("Land is already running");
    }
    this.#isRunning = true;

    await this.#readConfigPromise;

    console.log(`Running land: ${this.name} at path: ${this.path}`);
  }
}