import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, test } from "node:test";
import {
  createDefaultAgentConfig,
  createProviderConfig,
  loadLandLanguageProvider,
  resolveLandLanguageSelection,
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

test("resolveLandLanguageSelection falls back to openai for legacy lands", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "silaland-providers-"));
  const landPath = path.join(tempRoot, "land");
  await fs.mkdir(landPath, { recursive: true });

  const selection = await resolveLandLanguageSelection(landPath);
  assert.deepEqual(selection, {
    provider: "openai",
    model: "gpt-5.4",
    apiKeyEnvName: "OPENAI_API_KEY",
  });
});

test("resolveLandLanguageSelection uses old sila auto priority order", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "silaland-providers-"));
  const landPath = path.join(tempRoot, "land");
  await createDefaultAgentConfig(landPath);
  await createProviderConfig(landPath, "openrouter");
  await createProviderConfig(landPath, "anthropic");

  const selection = await resolveLandLanguageSelection(landPath);
  assert.deepEqual(selection, {
    provider: "anthropic",
    model: "claude-sonnet-4-6",
    apiKeyEnvName: "ANTHROPIC_API_KEY",
  });
});

test("resolveLandLanguageSelection respects explicit provider config", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "silaland-providers-"));
  const landPath = path.join(tempRoot, "land");
  await createDefaultAgentConfig(landPath, { provider: "openrouter" });
  await createProviderConfig(landPath, "openrouter", { model: "anthropic/claude-3.5-sonnet" });
  await createProviderConfig(landPath, "openai");

  const selection = await resolveLandLanguageSelection(landPath);
  assert.deepEqual(selection, {
    provider: "openrouter",
    model: "anthropic/claude-3.5-sonnet",
    apiKeyEnvName: "OPENROUTER_API_KEY",
  });
});

test("resolveLandLanguageSelection includes kimi in auto priority", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "silaland-providers-"));
  const landPath = path.join(tempRoot, "land");
  await createDefaultAgentConfig(landPath);
  await createProviderConfig(landPath, "kimi");
  await createProviderConfig(landPath, "openrouter");

  const selection = await resolveLandLanguageSelection(landPath);
  assert.deepEqual(selection, {
    provider: "kimi",
    model: "kimi-k2.5",
    apiKeyEnvName: "KIMI_API_KEY",
  });
});

test("loadLandLanguageProvider supports kimi via openai-like adapter", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "silaland-providers-"));
  const landPath = path.join(tempRoot, "land");
  await createDefaultAgentConfig(landPath, { provider: "kimi" });
  await createProviderConfig(landPath, "kimi");
  await fs.writeFile(path.join(landPath, ".env"), "KIMI_API_KEY=test-kimi-key\n", "utf8");

  const provider = await loadLandLanguageProvider(landPath);
  assert.equal(provider.provider, "kimi");
  assert.equal(provider.model, "kimi-k2.5");
  assert.ok(provider.lang);
});

test("resolveLandLanguageSelection rejects non-language providers for default agent", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "silaland-providers-"));
  const landPath = path.join(tempRoot, "land");
  await createDefaultAgentConfig(landPath, { provider: "exa" });
  await createProviderConfig(landPath, "exa");

  await assert.rejects(
    () => resolveLandLanguageSelection(landPath),
    /not a language provider/,
  );
});

test("resolveLandLanguageSelection allows explicit provider from env without provider config", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "silaland-providers-"));
  const landPath = path.join(tempRoot, "land");
  await createDefaultAgentConfig(landPath, { provider: "openai" });
  await fs.writeFile(path.join(landPath, ".env"), "OPENAI_API_KEY=test-openai-key\n", "utf8");

  const selection = await resolveLandLanguageSelection(landPath);
  assert.deepEqual(selection, {
    provider: "openai",
    model: "gpt-5.4",
    apiKeyEnvName: "OPENAI_API_KEY",
  });
});

test("resolveLandLanguageSelection auto-detects providers from env without provider config", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "silaland-providers-"));
  const landPath = path.join(tempRoot, "land");
  await createDefaultAgentConfig(landPath);
  await fs.writeFile(path.join(landPath, ".env"), "KIMI_API_KEY=test-kimi-key\n", "utf8");

  const selection = await resolveLandLanguageSelection(landPath);
  assert.deepEqual(selection, {
    provider: "kimi",
    model: "kimi-k2.5",
    apiKeyEnvName: "KIMI_API_KEY",
  });
});

test("explicitly disabled provider stays disabled even when env key exists", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "silaland-providers-"));
  const landPath = path.join(tempRoot, "land");
  await createDefaultAgentConfig(landPath);
  await createProviderConfig(landPath, "openai", { enabled: false });
  await fs.writeFile(path.join(landPath, ".env"), "OPENAI_API_KEY=test-openai-key\nKIMI_API_KEY=test-kimi-key\n", "utf8");

  const selection = await resolveLandLanguageSelection(landPath);
  assert.deepEqual(selection, {
    provider: "kimi",
    model: "kimi-k2.5",
    apiKeyEnvName: "KIMI_API_KEY",
  });
});
