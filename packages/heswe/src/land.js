import fs from "node:fs/promises";
import path from "node:path";
import { SlackChannel } from "./channels/slack-channel.js";
import { TelegramChannel } from "./channels/telegram-channel.js";
import { CONFIG_FILE_NAME, readConfig } from "./config.js";
import { loadLandEnvironment } from "./env.js";
import { resolveLandLanguageSelection } from "./providers.js";

const CHANNEL_RUNTIME_BY_TYPE = Object.freeze({
  slack: SlackChannel,
  telegram: TelegramChannel,
});

export class Land {
  /** @type {string} */
  #path;
  /** @type {string} */
  #name;
  /** @type {Promise<void>} */
  #readConfigPromise;
  /** @type {Array<SlackChannel | TelegramChannel>} */
  #channels = [];

  #isRunning = false;

  get name() {
    return this.#name;
  }

  get path() {
    return this.#path;
  }

  set name(value) {
    throw new Error("Not implemented");
  }

  /**
   * Construct a Land instance for the given path. The path should point to the directory containing the land's config.json.
   * @param {string} landPath
   */
  constructor(landPath) {
    this.#path = landPath;
    this.#readConfigPromise = readConfig(landPath)
      .then((config) => {
        this.#name = config.name;
      })
      .catch((error) => {
        console.error("Failed to load config:", error);
      });
  }

  async run() {
    if (this.#isRunning) {
      throw new Error("Land is already running");
    }
    this.#isRunning = true;

    await this.#readConfigPromise;
    await loadLandEnvironment(this.#path);
    await this.logDefaultAgentLanguageSelection();

    await this.runChannels();

    console.log(`Running land: ${this.name} at path: ${this.path}`);
  }

  async runChannels() {
    const channelsDir = path.join(this.#path, "channels");
    const channelDirEntries = await readDirectoryEntriesOrEmpty(channelsDir);

    for (const entry of channelDirEntries) {
      if (!entry.isDirectory()) {
        continue;
      }

      const channelPath = path.join(channelsDir, entry.name);
      const configPath = path.join(channelPath, CONFIG_FILE_NAME);
      const channelConfig = await readJsonFileOrNull(configPath);

      if (!channelConfig) {
        continue;
      }

      const channelType = typeof channelConfig.channel === "string" ? channelConfig.channel : "";
      const ChannelRuntime = CHANNEL_RUNTIME_BY_TYPE[channelType];
      if (!ChannelRuntime) {
        console.warn(`Skipping unsupported channel type "${channelType || "unknown"}" at ${channelPath}.`);
        continue;
      }

      const channel = new ChannelRuntime(channelPath, channelConfig);
      this.#channels.push(channel);
      await channel.run();
    }

    console.log(`Loaded ${this.#channels.length} channel(s).`);
  }

  async logDefaultAgentLanguageSelection() {
    try {
      const selection = await resolveLandLanguageSelection(this.#path);
      console.log(`Default agent language model: ${selection.provider}/${selection.model}`);
    } catch (error) {
      console.log(`Default agent language model unavailable: ${error.message}`);
    }
  }
}

async function readDirectoryEntriesOrEmpty(directoryPath) {
  try {
    return await fs.readdir(directoryPath, { withFileTypes: true });
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

async function readJsonFileOrNull(filePath) {
  let raw;
  try {
    raw = await fs.readFile(filePath, "utf8");
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return null;
    }
    throw error;
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    console.error(`Skipping invalid JSON file at ${filePath}:`, error.message);
    return null;
  }
}
