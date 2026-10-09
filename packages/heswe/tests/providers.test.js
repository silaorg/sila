import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, test } from "node:test";
import {
  createDefaultAgentConfig,
  createProviderConfig,
  loadWorkspaceLanguageProvider,
  readWorkspaceModelSettings,
  resolveWorkspaceLanguageSelection,
  updateWorkspaceModelSettings,
} from "../src/providers.js";

const PROVIDER_ENV_NAMES = [
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
  "GOOGLE_API_KEY",
  "KIMI_API_KEY",
  "XAI_API_KEY",
  "OPENROUTER_API_KEY",
  "DEEPSEEK_API_KEY",
  "GROQ_API_KEY",
  "COHERE_API_KEY",
  "MISTRAL_API_KEY",
  "FAL_KEY",
  "EXA_API_KEY",
];

let previousProviderEnv = {};

beforeEach(() => {
  previousProviderEnv = Object.fromEntries(PROVIDER_ENV_NAMES.map((name) => [name, process.env[name]]));
  for (const envName of PROVIDER_ENV_NAMES) {
    delete process.env[envName];
  }
});

afterEach(() => {
  for (const envName of PROVIDER_ENV_NAMES) {
    const previousValue = previousProviderEnv[envName];
    if (typeof previousValue === "string") {
      process.env[envName] = previousValue;
    } else {
      delete process.env[envName];
    }
  }
});

test("resolveWorkspaceLanguageSelection falls back to mock without provider keys", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "heswe-providers-"));
  const workspacePath = path.join(tempRoot, "workspace");
  await fs.mkdir(workspacePath, { recursive: true });

  const selection = await resolveWorkspaceLanguageSelection(workspacePath);
  assert.deepEqual(selection, {
    provider: "mock",
    model: "mock-cycle",
    apiKeyEnvName: null,
  });
});

test("resolveWorkspaceLanguageSelection uses the legacy auto priority order", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "heswe-providers-"));
  const workspacePath = path.join(tempRoot, "workspace");
  await createDefaultAgentConfig(workspacePath);
  await createProviderConfig(workspacePath, "openrouter");
  await createProviderConfig(workspacePath, "anthropic");
  await fs.writeFile(path.join(workspacePath, ".env"), "OPENROUTER_API_KEY=test-key\nANTHROPIC_API_KEY=test-key\n");

  const selection = await resolveWorkspaceLanguageSelection(workspacePath);
  assert.deepEqual(selection, {
    provider: "anthropic",
    model: "claude-sonnet-4-6",
    apiKeyEnvName: "ANTHROPIC_API_KEY",
  });
});

test("resolveWorkspaceLanguageSelection respects explicit provider config", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "heswe-providers-"));
  const workspacePath = path.join(tempRoot, "workspace");
  await createDefaultAgentConfig(workspacePath, { provider: "openrouter" });
  await createProviderConfig(workspacePath, "openrouter", { model: "anthropic/claude-3.5-sonnet" });
  await createProviderConfig(workspacePath, "openai");

  const selection = await resolveWorkspaceLanguageSelection(workspacePath);
  assert.deepEqual(selection, {
    provider: "openrouter",
    model: "anthropic/claude-3.5-sonnet",
    apiKeyEnvName: "OPENROUTER_API_KEY",
  });
});

test("resolveWorkspaceLanguageSelection includes kimi in auto priority", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "heswe-providers-"));
  const workspacePath = path.join(tempRoot, "workspace");
  await createDefaultAgentConfig(workspacePath);
  await createProviderConfig(workspacePath, "kimi");
  await createProviderConfig(workspacePath, "openrouter");
  await fs.writeFile(path.join(workspacePath, ".env"), "KIMI_API_KEY=test-key\nOPENROUTER_API_KEY=test-key\n");

  const selection = await resolveWorkspaceLanguageSelection(workspacePath);
  assert.deepEqual(selection, {
    provider: "kimi",
    model: "kimi-k2.5",
    apiKeyEnvName: "KIMI_API_KEY",
  });
});

test("automatic selection skips provider configs with no key and still prefers real providers", async (t) => {
  const workspacePath = await fs.mkdtemp(path.join(os.tmpdir(), "heswe-providers-"));
  t.after(() => fs.rm(workspacePath, { recursive: true, force: true }));
  await createDefaultAgentConfig(workspacePath);
  await createProviderConfig(workspacePath, "openai");
  await createProviderConfig(workspacePath, "mock");
  assert.equal((await resolveWorkspaceLanguageSelection(workspacePath)).provider, "mock");

  await fs.writeFile(path.join(workspacePath, ".env"), "ANTHROPIC_API_KEY=test-key\n");
  assert.equal((await resolveWorkspaceLanguageSelection(workspacePath)).provider, "anthropic");
  await createProviderConfig(workspacePath, "anthropic", { enabled: false });
  assert.equal((await resolveWorkspaceLanguageSelection(workspacePath)).provider, "mock");
});

test("mock is selectable and loads without an API key even when a real provider is ready", async (t) => {
  const workspacePath = await fs.mkdtemp(path.join(os.tmpdir(), "heswe-providers-"));
  t.after(() => fs.rm(workspacePath, { recursive: true, force: true }));
  await fs.writeFile(path.join(workspacePath, ".env"), "OPENAI_API_KEY=test-key\n");
  const settings = await updateWorkspaceModelSettings(workspacePath, {
    provider: "mock", model: "mock-cycle",
  });
  const mock = settings.providers.find((provider) => provider.id === "mock");
  assert.equal(mock.local, true);
  assert.equal(mock.enabled, true);
  assert.equal(mock.apiKeySource, "none");
  const provider = await loadWorkspaceLanguageProvider(workspacePath);
  assert.equal(provider.provider, "mock");
  assert.equal((await provider.lang.ask("hello")).answer, "Hey!");
  await assert.rejects(updateWorkspaceModelSettings(workspacePath, {
    provider: "mock", model: "mock-cycle", apiKeys: { mock: "not-needed" },
  }), /does not accept an API key/);
});

test("explicit real provider selection still reports a missing API key", async (t) => {
  const workspacePath = await fs.mkdtemp(path.join(os.tmpdir(), "heswe-providers-"));
  t.after(() => fs.rm(workspacePath, { recursive: true, force: true }));
  await createDefaultAgentConfig(workspacePath, { provider: "openai" });
  await assert.rejects(loadWorkspaceLanguageProvider(workspacePath), /missing OPENAI_API_KEY/);
});

test("loadWorkspaceLanguageProvider supports kimi via openai-like adapter", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "heswe-providers-"));
  const workspacePath = path.join(tempRoot, "workspace");
  await createDefaultAgentConfig(workspacePath, { provider: "kimi" });
  await createProviderConfig(workspacePath, "kimi");
  await fs.writeFile(path.join(workspacePath, ".env"), "KIMI_API_KEY=test-kimi-key\n", "utf8");

  const provider = await loadWorkspaceLanguageProvider(workspacePath);
  assert.equal(provider.provider, "kimi");
  assert.equal(provider.model, "kimi-k2.5");
  assert.ok(provider.lang);
  assert.equal(process.env.KIMI_API_KEY, undefined);
});

test("resolveWorkspaceLanguageSelection rejects non-language providers for default agent", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "heswe-providers-"));
  const workspacePath = path.join(tempRoot, "workspace");
  await createDefaultAgentConfig(workspacePath, { provider: "exa" });
  await createProviderConfig(workspacePath, "exa");

  await assert.rejects(
    () => resolveWorkspaceLanguageSelection(workspacePath),
    /not a language provider/,
  );
});

test("resolveWorkspaceLanguageSelection allows explicit provider from env without provider config", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "heswe-providers-"));
  const workspacePath = path.join(tempRoot, "workspace");
  await createDefaultAgentConfig(workspacePath, { provider: "openai" });
  await fs.writeFile(path.join(workspacePath, ".env"), "OPENAI_API_KEY=test-openai-key\n", "utf8");

  const selection = await resolveWorkspaceLanguageSelection(workspacePath);
  assert.deepEqual(selection, {
    provider: "openai",
    model: "gpt-5.4",
    apiKeyEnvName: "OPENAI_API_KEY",
  });
});

test("resolveWorkspaceLanguageSelection auto-detects providers from env without provider config", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "heswe-providers-"));
  const workspacePath = path.join(tempRoot, "workspace");
  await createDefaultAgentConfig(workspacePath);
  await fs.writeFile(path.join(workspacePath, ".env"), "KIMI_API_KEY=test-kimi-key\n", "utf8");

  const selection = await resolveWorkspaceLanguageSelection(workspacePath);
  assert.deepEqual(selection, {
    provider: "kimi",
    model: "kimi-k2.5",
    apiKeyEnvName: "KIMI_API_KEY",
  });
  assert.equal(process.env.KIMI_API_KEY, undefined);
});

test("workspace provider keys remain isolated across concurrent workspaces", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "heswe-providers-"));
  const openAiWorkspace = path.join(tempRoot, "openai");
  const kimiWorkspace = path.join(tempRoot, "kimi");
  await Promise.all([
    createDefaultAgentConfig(openAiWorkspace),
    createDefaultAgentConfig(kimiWorkspace),
  ]);
  await Promise.all([
    fs.writeFile(
      path.join(openAiWorkspace, ".env"),
      "OPENAI_API_KEY=openai-workspace-key\n",
      "utf8",
    ),
    fs.writeFile(
      path.join(kimiWorkspace, ".env"),
      "KIMI_API_KEY=kimi-workspace-key\n",
      "utf8",
    ),
  ]);

  const [openAiSelection, kimiSelection] = await Promise.all([
    resolveWorkspaceLanguageSelection(openAiWorkspace),
    resolveWorkspaceLanguageSelection(kimiWorkspace),
  ]);

  assert.equal(openAiSelection.provider, "openai");
  assert.equal(kimiSelection.provider, "kimi");
  assert.equal(process.env.OPENAI_API_KEY, undefined);
  assert.equal(process.env.KIMI_API_KEY, undefined);
});

test("explicitly disabled provider stays disabled even when env key exists", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "heswe-providers-"));
  const workspacePath = path.join(tempRoot, "workspace");
  await createDefaultAgentConfig(workspacePath);
  await createProviderConfig(workspacePath, "openai", { enabled: false });
  await fs.writeFile(path.join(workspacePath, ".env"), "OPENAI_API_KEY=test-openai-key\nKIMI_API_KEY=test-kimi-key\n", "utf8");

  const selection = await resolveWorkspaceLanguageSelection(workspacePath);
  assert.deepEqual(selection, {
    provider: "kimi",
    model: "kimi-k2.5",
    apiKeyEnvName: "KIMI_API_KEY",
  });
});

test("workspace model settings update selection without exposing API keys", async () => {
  const workspacePath = await fs.mkdtemp(path.join(os.tmpdir(), "heswe-providers-"));
  await createDefaultAgentConfig(workspacePath);

  const settings = await updateWorkspaceModelSettings(workspacePath, {
    provider: "anthropic",
    model: "claude-sonnet-4-6",
    apiKeys: {
      anthropic: "anthropic-secret",
      exa: "exa-secret",
    },
  });

  assert.equal(settings.provider, "anthropic");
  assert.equal(settings.model, "claude-sonnet-4-6");
  assert.equal(
    settings.providers.find((provider) => provider.id === "anthropic")?.apiKeySource,
    "workspace",
  );
  assert.equal(JSON.stringify(settings).includes("anthropic-secret"), false);
  assert.deepEqual(await resolveWorkspaceLanguageSelection(workspacePath), {
    provider: "anthropic",
    model: "claude-sonnet-4-6",
    apiKeyEnvName: "ANTHROPIC_API_KEY",
  });

  await updateWorkspaceModelSettings(workspacePath, {
    provider: "anthropic",
    model: "claude-sonnet-4-6",
    apiKeys: { anthropic: null },
  });
  const removed = await readWorkspaceModelSettings(workspacePath);
  assert.equal(
    removed.providers.find((provider) => provider.id === "anthropic")?.apiKeySource,
    "none",
  );
  assert.equal(
    removed.providers.find((provider) => provider.id === "exa")?.apiKeySource,
    "workspace",
  );
});
