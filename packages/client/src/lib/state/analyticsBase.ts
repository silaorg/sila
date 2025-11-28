const detectPlatform = (): string => {
  if (typeof navigator === "undefined") return "unknown";
  const ua = navigator.userAgent || "";
  if (/Android/i.test(ua)) return "android";
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  if (/Win/i.test(ua)) return "windows";
  if (/Mac/i.test(ua)) return "mac";
  if (/Linux/i.test(ua)) return "linux";
  return "web";
};

let cached: Record<string, unknown> | null = null;

export const getAnalyticsBase = (): Record<string, unknown> => {
  if (cached) return cached;

  const version =
    (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_APP_VERSION) ||
    (typeof process !== "undefined" && process.env?.VITE_APP_VERSION) ||
    "dev";

  cached = {
    app_version: version,
    platform: detectPlatform()
  };

  return cached;
};
