export type RuntimeMode = "development" | "production" | "test" | "unknown";

function readModeString(): string | undefined {
  const metaMode = typeof import.meta !== "undefined" ? (import.meta as any).env?.MODE : undefined;
  if (typeof metaMode === "string") return metaMode;

  const nodeEnv = typeof process !== "undefined" ? process.env?.NODE_ENV : undefined;
  if (typeof nodeEnv === "string") return nodeEnv;

  return undefined;
}

export function getRuntimeMode(): RuntimeMode {
  const mode = readModeString();
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
