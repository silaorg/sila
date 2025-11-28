import posthog from "posthog-js";
import { getAnalyticsBase } from "./analyticsBase";
import type { AnalyticsName } from "./analyticsEvents";

export type AnalyticsConfig = {
  enabled?: boolean;
  apiKey: string;
  host: string;
  debug?: boolean;
};

export class AppTelemetry {
  private base: Record<string, unknown> = {};

  init(config: AnalyticsConfig | null): void {
    if (typeof window === "undefined") return;
    if (!config || config.enabled === false) return;

    const apiKey = config.apiKey;
    const host = config.host;
    if (!apiKey || !host) return;

    try {
      this.base = getAnalyticsBase();
      posthog.init(apiKey, {
        api_host: host,
        debug: config.debug,
      });
    } catch (err) {
      console.error("Failed to init analytics", err);
    }
  }

  capture(event: AnalyticsName, props?: Record<string, unknown>): void {
    try {
      posthog.capture(event, { ...this.base, ...(props ?? {}) });
    } catch (err) {
      console.error("Failed to track analytics event", err);
    }
  }
}
