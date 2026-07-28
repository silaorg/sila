import fs from "node:fs/promises";
import path from "node:path";
import { SlackChannel } from "./channels/slack-channel.js";
import { TelegramChannel } from "./channels/telegram-channel.js";
import { CONFIG_FILE_NAME, readConfig } from "./config.js";
import { loadWorkspaceEnvironment } from "./env.js";
import { resolveWorkspaceLanguageSelection } from "./providers.js";

const CHANNEL_RUNTIME_BY_TYPE = Object.freeze({
  slack: SlackChannel,
  telegram: TelegramChannel,
});

export class Workspace {
  /** @type {string} */
  #path;
  /** @type {string} */
  #name = "";
  /** @type {Array<SlackChannel | TelegramChannel>} */
  #channels = [];

  #isRunning = false;

  get name() {
    return this.#name;
  }

  get path() {
    return this.#path;
  }

  /**
   * Construct a Workspace instance for the given path. The path should point to the directory containing the workspace's config.json.
   * @param {string} workspacePath
   */
  constructor(workspacePath) {
    this.#path = workspacePath;
  }

  async run() {
    if (this.#isRunning) {
      throw new Error("Workspace is already running");
    }
    this.#isRunning = true;

    try {
      const config = await readConfig(this.#path);
      this.#name = config.name;
      await loadWorkspaceEnvironment(this.#path);
      await this.logDefaultAgentLanguageSelection();
      await this.runChannels();
      console.log(`Running workspace: ${this.name} at path: ${this.path}`);
    } catch (error) {
      const startedChannels = this.#channels.splice(0);
      await Promise.allSettled(startedChannels.map((channel) => channel.stop()));
      this.#isRunning = false;
      throw error;
    }
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
      const selection = await resolveWorkspaceLanguageSelection(this.#path);
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
    throw new Error(`Invalid JSON in ${filePath}: ${error.message}`, { cause: error });
  }
}
