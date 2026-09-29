import path from "node:path";
import { ThreadStore } from "../thread-store.js";
import { readConfig } from "../config.js";
import {
  PROVIDER_CONFIG_ERROR_CODE,
  ProviderConfigError,
  readWorkspaceModelSettings,
  updateWorkspaceModelSettings,
} from "../providers.js";
import { enqueueSerialTask } from "../serial-task-queue.js";
import { getPublicMessageText } from "./app-message.js";
import {
  AppFileStore,
  MAX_APP_FILE_COUNT,
  MAX_APP_UPLOAD_BYTES,
} from "./app-file-store.js";
import { AppThreadRepository } from "./app-thread-repository.js";
import { AppWorkspaceError } from "./app-workspace-error.js";

const MAX_MESSAGE_LENGTH = 50_000;
const MAX_TITLE_LENGTH = 100;

export class AppWorkspaceService {
  #workspacePath;
  #threads;
  #files;
  #createAgentRuntime;
  #agentRuntimePromise = null;
  #onChange;
  #queues = new Map();
  #progressByThread = new Map();
  #lifecyclePromise = null;
  #stopPromise = null;
  #stopped = false;

  constructor(options) {
    if (!options?.workspacePath) {
      throw new AppWorkspaceError(
        "invalid_input",
        "AppWorkspaceService requires workspacePath.",
      );
    }
    this.#workspacePath = path.resolve(options.workspacePath);
    const threadStore = options.threadStore instanceof ThreadStore
      ? options.threadStore
      : new ThreadStore();
    this.#threads = new AppThreadRepository(this.#workspacePath, threadStore);
    this.#files = new AppFileStore(this.#workspacePath);
    this.#createAgentRuntime = options.createAgentRuntime
      ?? (() => createDefaultAgentRuntime(this.#workspacePath, threadStore));
    this.#onChange = typeof options.onChange === "function" ? options.onChange : null;
  }

  async getWorkspace() {
    const config = await readConfig(this.#workspacePath);
    return { name: config.name };
  }

  getModelSettings() {
    return readWorkspaceModelSettings(this.#workspacePath);
  }

  updateModelSettings(input) {
    if (this.#stopped) return Promise.reject(this.#stoppedError());
    const pending = (this.#lifecyclePromise ?? Promise.resolve())
      .catch(() => {})
      .then(async () => {
        // Admission closes synchronously below. Drain all accepted messages
        // before changing files, then activate the new configuration together.
        await Promise.allSettled(this.#queues.values());
        try {
          return await updateWorkspaceModelSettings(this.#workspacePath, input);
        } catch (error) {
          if (error instanceof ProviderConfigError) {
            throw new AppWorkspaceError("invalid_input", error.message, { cause: error });
          }
          throw error;
        } finally {
          // A filesystem failure can leave a partial settings update. Never
          // keep running a cached agent against that changed configuration.
          await this.#resetAgentRuntime();
        }
      });
    this.#lifecyclePromise = pending;
    const clear = () => {
      if (this.#lifecyclePromise === pending) this.#lifecyclePromise = null;
    };
    void pending.then(clear, clear);
    return pending;
  }

  listThreads(userId) {
    return this.#threads.list(userId);
  }

  async createThread(userId, input = {}) {
    const thread = await this.#threads.create(userId, normalizeTitle(input?.title));
    await this.#emitChange({ type: "thread.created", userId, threadId: thread.id });
    return thread;
  }

  async getThread(userId, threadId) {
    const { summary, events } = await this.#threads.get(userId, threadId);
    return {
      ...summary,
      messages: projectThreadMessages(events, this.#progressByThread.has(threadQueueKey(userId, threadId))),
      progress: this.#progressByThread.get(threadQueueKey(userId, threadId)) ?? null,
    };
  }

  async listFiles(userId, threadId, query = "") {
    const threadDir = await this.#threads.require(userId, threadId);
    return this.#files.list(threadDir, query);
  }

  async uploadFiles(userId, threadId, files) {
    const threadDir = await this.#threads.require(userId, threadId);
    return this.#files.upload(threadDir, files);
  }

  browseWorkspaceFiles(_userId, relativeDirectory = "") {
    return this.#files.browse(relativeDirectory);
  }

  async uploadWorkspaceFiles(userId, relativeDirectory, files) {
    const uploaded = await this.#files.uploadWorkspaceFiles(relativeDirectory, files);
    await this.#emitChange({ type: "workspace.files.changed", userId });
    return uploaded;
  }

  async createWorkspaceDirectory(userId, relativeDirectory, name) {
    const directory = await this.#files.createWorkspaceDirectory(relativeDirectory, name);
    await this.#emitChange({ type: "workspace.files.changed", userId });
    return directory;
  }

  async renameWorkspaceEntry(userId, relativePath, name) {
    const entry = await this.#files.renameWorkspaceEntry(relativePath, name);
    await this.#emitChange({ type: "workspace.files.changed", userId });
    return entry;
  }

  async moveWorkspaceEntries(userId, relativePaths, destinationPath) {
    const entries = await this.#files.moveWorkspaceEntries(
      relativePaths,
      destinationPath,
    );
    if (entries.length > 0) {
      await this.#emitChange({ type: "workspace.files.changed", userId });
    }
    return entries;
  }

  async removeWorkspaceEntry(userId, relativePath) {
    await this.#files.removeWorkspaceEntry(relativePath);
    await this.#emitChange({ type: "workspace.files.changed", userId });
  }

  getWorkspaceFile(_userId, relativePath) {
    return this.#files.resolveWorkspaceFile(relativePath);
  }

  async getFile(userId, threadId, reference) {
    const threadDir = await this.#threads.require(userId, threadId);
    return this.#files.resolve(threadDir, reference);
  }

  async removeUploadedFile(userId, threadId, reference) {
    while (this.#lifecyclePromise) await this.#lifecyclePromise.catch(() => {});
    if (this.#stopped) throw this.#stoppedError();
    return enqueueSerialTask(
      this.#queues,
      threadQueueKey(userId, threadId),
      async () => {
        const threadDir = await this.#threads.require(userId, threadId);
        const { events } = await this.#threads.get(userId, threadId);
        const isAttached = events.some((event) =>
          event.type === "message"
          && Array.isArray(event.message?.meta?.app?.attachments)
          && event.message.meta.app.attachments.some(
            (file) => file?.reference === reference,
          )
        );
        if (isAttached) {
          throw new AppWorkspaceError(
            "invalid_input",
            "A file attached to a sent message cannot be removed.",
          );
        }
        await this.#files.removeThreadFile(threadDir, reference);
      },
    );
  }

  async sendMessage(userId, threadId, input) {
    const message = normalizeMessageInput(input);
    while (this.#lifecyclePromise) await this.#lifecyclePromise.catch(() => {});
    if (this.#stopped) throw this.#stoppedError();
    return enqueueSerialTask(
      this.#queues,
      threadQueueKey(userId, threadId),
      async () => {
        const threadDir = await this.#threads.require(userId, threadId);
        const referencedFiles = await resolveMessageFiles(
          this.#files,
          threadDir,
          message.text,
          message.attachments,
        );
        const agentText = buildAgentMessage(message.text, referencedFiles);
        const runtime = await this.#getAgentRuntime();
        let result;
        let runtimeFailed = false;
        let runtimeError;

        try {
          result = await runtime.handleThreadMessage({
            threadId,
            threadDir,
            userId,
            text: agentText,
            publicText: message.text,
            attachments: referencedFiles
              .filter((file) => file.attached)
              .map(toPersistedFile),
            onAssistantResponding: async () => {
              this.#setThreadProgress(userId, threadId, {
                status: "processing",
                text: "",
                activities: [],
              });
              await this.#emitChange({ type: "thread.changed", userId, threadId });
            },
            onAssistantProgress: async ({ text, toolNames, tools }) => {
              this.#setThreadProgress(userId, threadId, {
                status: toolNames.length ? "acting" : "thinking",
                text,
                activities: (tools ?? toolNames.map((name) => ({ name }))).map((tool, index) => ({
                  id: `running:${tool.name}:${index}`,
                  name: tool.name,
                  preview: getToolPreview(tool.arguments),
                  status: "running",
                })),
              });
              await this.#emitChange({ type: "thread.changed", userId, threadId });
            },
          });
        } catch (error) {
          runtimeFailed = true;
          runtimeError = normalizeAgentRuntimeError(error);
        }

        this.#progressByThread.delete(threadQueueKey(userId, threadId));
        try {
          await this.#threads.touch(userId, threadId);
          await this.#emitChange({ type: "thread.changed", userId, threadId });
        } catch (error) {
          if (!runtimeFailed) {
            throw error;
          }
          console.error(`Failed to update app thread ${threadId} after agent failure:`, error);
        }

        if (runtimeFailed) {
          throw runtimeError;
        }
        return result;
      },
    );
  }

  stop() {
    if (this.#stopPromise) return this.#stopPromise;
    this.#stopped = true;
    this.#stopPromise = (this.#lifecyclePromise ?? Promise.resolve())
      .catch(() => {})
      .then(async () => {
        await Promise.allSettled(this.#queues.values());
        this.#progressByThread.clear();
        await this.#resetAgentRuntime();
      });
    return this.#stopPromise;
  }

  #stoppedError() {
    return new AppWorkspaceError("invalid_input", "This workspace is shutting down. Try again later.");
  }

  async #resetAgentRuntime() {
    const runtimePromise = this.#agentRuntimePromise;
    this.#agentRuntimePromise = null;
    if (!runtimePromise) return;
    const runtime = await runtimePromise.catch(() => null);
    await runtime?.stop?.();
  }

  #getAgentRuntime() {
    if (!this.#agentRuntimePromise) {
      const pending = Promise.resolve().then(() => this.#createAgentRuntime());
      this.#agentRuntimePromise = pending;
      void pending.catch(() => {
        if (this.#agentRuntimePromise === pending) {
          this.#agentRuntimePromise = null;
        }
      });
    }
    return this.#agentRuntimePromise;
  }

  async #emitChange(change) {
    try {
      await this.#onChange?.(change);
    } catch (error) {
      console.error(`Failed to publish ${change.type}:`, error);
    }
  }

  #setThreadProgress(userId, threadId, progress) {
    this.#progressByThread.set(threadQueueKey(userId, threadId), progress);
  }
}

async function createDefaultAgentRuntime(workspacePath, threadStore) {
  const { createAppAgentRuntime } = await import("../app-agent-runtime.js");
  return createAppAgentRuntime({ workspacePath, threadStore });
}

function normalizeAgentRuntimeError(error) {
  if (error?.code !== PROVIDER_CONFIG_ERROR_CODE) {
    // AIWrapper's worker transport preserves the message, but not HTTP fields.
    // Return fixed, actionable messages without leaking provider response bodies.
    const status = String(error?.message ?? "").match(/HTTP error! status: (\d{3})\b/)?.[1];
    const messages = {
      400: "The model provider rejected this request. Try another model or contact the server administrator.",
      401: "The model provider rejected the API key. Update it in workspace settings and try again.",
      402: "The model provider needs more credits for this request. Check its balance or choose a less expensive model.",
      403: "This API key does not have access to the selected model. Check provider permissions or choose another model.",
      404: "The selected model is unavailable. Choose another model in workspace settings.",
      429: "The model provider's rate or quota limit was reached. Check your provider limits and try again later.",
    };
    return messages[status]
      ? new AppWorkspaceError("invalid_input", messages[status], { cause: error })
      : error;
  }
  return new AppWorkspaceError(
    "invalid_input",
    "Check the workspace model settings and API key, then try again.",
    { cause: error },
  );
}

function normalizeTitle(value) {
  const title = typeof value === "string" ? value.trim() : "";
  return (title || "New thread").slice(0, MAX_TITLE_LENGTH);
}

function normalizeMessageInput(value) {
  const textValue = typeof value === "string" ? value : value?.text;
  const text = typeof textValue === "string" ? textValue.trim() : "";
  const attachmentValues = typeof value === "object" && Array.isArray(value?.attachments)
    ? value.attachments
    : [];
  const attachments = [
    ...new Set(
      attachmentValues
        .map((reference) => String(reference ?? "").trim())
        .filter(Boolean),
    ),
  ];
  if (!text && attachments.length === 0) {
    throw new AppWorkspaceError(
      "invalid_input",
      "Message text or an attachment is required.",
    );
  }
  if (text.length > MAX_MESSAGE_LENGTH) {
    throw new AppWorkspaceError(
      "invalid_input",
      `Message text cannot exceed ${MAX_MESSAGE_LENGTH.toLocaleString("en-US")} characters.`,
    );
  }
  if (attachments.length > MAX_APP_FILE_COUNT) {
    throw new AppWorkspaceError(
      "invalid_input",
      `You can attach up to ${MAX_APP_FILE_COUNT} files.`,
    );
  }
  return { text, attachments };
}

function threadQueueKey(userId, threadId) {
  return JSON.stringify([userId, threadId]);
}

async function resolveMessageFiles(fileStore, threadDir, text, attachmentReferences) {
  const mentionedReferences = extractMentionReferences(text);
  const attached = new Set(attachmentReferences);
  const references = [...new Set([...attachmentReferences, ...mentionedReferences])];
  const files = await Promise.all(references.map(async (reference) => ({
    ...(await fileStore.resolve(threadDir, reference)),
    attached: attached.has(reference),
  })));
  const attachedBytes = files
    .filter((file) => file.attached)
    .reduce((total, file) => total + file.size, 0);
  if (attachedBytes > MAX_APP_UPLOAD_BYTES) {
    throw new AppWorkspaceError(
      "invalid_input",
      "Attachments must be 40 MB or smaller in total.",
    );
  }
  return files;
}

function extractMentionReferences(text) {
  return Array.from(
    String(text).matchAll(/\]\(<((?:workspace|thread):[^>]+)>\)/g),
    (match) => match[1],
  );
}

function buildAgentMessage(text, files) {
  const fileLines = files.map((file) => {
    const action = file.attached ? "Attached" : "Mentioned";
    return `- ${action} "${file.name}": ${file.agentPath}`;
  });
  return [
    text,
    fileLines.length ? `<heswe_files>\n${fileLines.join("\n")}\n</heswe_files>` : "",
  ].filter(Boolean).join("\n\n");
}

function toPersistedFile(file) {
  return {
    reference: file.reference,
    scope: file.scope,
    path: file.path,
    name: file.name,
    size: file.size,
    mimeType: file.mimeType,
    kind: file.kind,
  };
}

function projectThreadMessages(events, isRunning = false) {
  const messages = [];
  const pending = new Map();

  for (const event of events) {
    if (event.type !== "message") continue;
    const role = event.message.role;
    if (role === "user") pending.clear();

    if (role === "tool-results") {
      for (const item of event.message.items ?? []) {
        if (item?.type !== "tool-result") continue;
        const activity = pending.get(item.callId);
        if (!activity) continue;
        activity.status = (item.result?.error || item.result?.status === "failed") ? "failed" : "complete";
        pending.delete(item.callId);
      }
      continue;
    }

    const projected = projectMessage(event);
    if (role === "assistant") {
      const activities = projectToolActivities(event);
      if (activities.length) {
        projected.activities = activities;
        const tools = (event.message.items ?? []).filter(
          (item) => item?.type === "tool" && typeof item.name === "string",
        );
        tools.forEach((tool, index) => {
          if (tool.callId) pending.set(tool.callId, activities[index]);
        });
      }
    }
    if (isPublicAppMessage(projected) || projected.activities?.length) {
      messages.push(projected);
    }
  }

  if (isRunning) {
    for (const activity of pending.values()) activity.status = "running";
  }
  return messages;
}

function projectMessage(event) {
  const attachments = Array.isArray(event.message.meta?.app?.attachments)
    ? event.message.meta.app.attachments
    : [];
  return {
    id: event.id,
    at: event.at,
    role: event.message.role,
    text: getPublicMessageText(event.message),
    attachments,
  };
}

function isPublicAppMessage(message) {
  return (
    (message.role === "user" || message.role === "assistant")
    && (message.text.trim() || message.attachments.length > 0)
  );
}

function projectToolActivities(event) {
  return (event.message.items ?? [])
    .filter((item) => item?.type === "tool" && typeof item.name === "string")
    .map((item, index) => ({
      id: `${event.id ?? "tool"}:${item.callId ?? index}`,
      name: item.name,
      preview: getToolPreview(item.arguments),
      status: "incomplete",
    }));
}

function getToolPreview(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  const keys = ["query", "q", "path", "uri", "url", "command", "prompt", "name"];
  for (const key of keys) {
    if (typeof value[key] === "string" && value[key].trim()) {
      return value[key].trim().slice(0, 160);
    }
  }
  const firstString = Object.values(value).find(
    (entry) => typeof entry === "string" && entry.trim(),
  );
  return typeof firstString === "string" ? firstString.trim().slice(0, 160) : "";
}
