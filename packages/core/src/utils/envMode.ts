export type RuntimeMode = "development" | "production" | "test" | "unknown";

function readMetaMode(): string | undefined {
  if (typeof import.meta === "undefined") return undefined;
  const env = (import.meta as any).env;
  if (env && typeof env.MODE === "string") {
    return env.MODE;
  }
  return undefined;
}

function readNodeEnv(): string | undefined {
  if (typeof process === "undefined" || !process.env) return undefined;
  const mode = process.env.NODE_ENV;
  return typeof mode === "string" ? mode : undefined;
}

export function getRuntimeMode(): RuntimeMode {
  const mode = readMetaMode() || readNodeEnv();
  if (mode === "development" || mode === "production" || mode === "test") {
    return mode;
  }
  return "unknown";
}

export function isDevMode(): boolean {
  return getRuntimeMode() === "development";
}

export function isProdMode(): boolean {
  return getRuntimeMode() === "production";
}

export function readEnv(key: string): string | undefined {
  const metaEnv = typeof import.meta !== "undefined" ? (import.meta as any).env : undefined;
  const processEnv = typeof process !== "undefined" ? process.env : undefined;
  const candidates = [
    metaEnv?.[`VITE_${key}`],
    metaEnv?.[key],
    processEnv?.[`VITE_${key}`],
    processEnv?.[key],
  ];
  for (const value of candidates) {
    if (typeof value === "string" && value.length > 0) return value;
  }
  return undefined;
}

// Helper to pick the appropriate env var for a given mode, e.g. SOME_KEY vs SOME_KEY_DEV.
export function readEnvForMode(key: string, mode: RuntimeMode): string | undefined {
  const value = mode === "production" ? readEnv(key) : readEnv(`${key}_DEV`);
  if (!value) {
    const expected = mode === "production" ? [key] : [`${key}_DEV`];
    console.error("Missing env var", expected);
  }
  return value;
}
