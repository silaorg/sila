import type { Space } from "@sila/core";
import {
  AnalyticsErrors,
  AnalyticsEvents,
  type AnalyticsName,
} from "./analyticsEvents";
import { AppTelemetry } from "./clientTelemetry";

export class SpaceTelemetry {
  constructor(
    private analytics: AppTelemetry,
    private getSpace: () => Space | null = () => null,
  ) {}

  private capture(event: AnalyticsName, props?: Record<string, unknown>) {
    if (!this.analytics) return;
    const space = this.getSpace();
    const merged = { ...(props ?? {}) };

    const spaceId = space?.getId();

    if (spaceId) {
      merged.space_id = spaceId;
    }
    this.analytics.capture(event, merged);
  }

  spaceEntered(props: { space_id: string }) {
    this.capture(AnalyticsEvents.SpaceEntered, props);
  }

  spaceSwitched(props: { from_space_id?: string | null; to_space_id: string }) {
    this.capture(AnalyticsEvents.SpaceSwitched, props);
  }

  spaceRenamed(props: { space_id: string }) {
    this.capture(AnalyticsEvents.SpaceRenamed, props);
  }

  assistantCreated(
    props: { assistant_id: string; model?: string; tools?: string[] },
  ) {
    this.capture(AnalyticsEvents.AssistantCreated, props);
  }

  assistantUpdated(
    props: { assistant_id: string; model?: string; tools?: string[] },
  ) {
    this.capture(AnalyticsEvents.AssistantUpdated, props);
  }

  assistantDeleted(props: { assistant_id: string }) {
    this.capture(AnalyticsEvents.AssistantDeleted, props);
  }

  chatStarted(props: { chat_id: string; assistant_id?: string }) {
    this.capture(AnalyticsEvents.ChatStarted, props);
  }

  chatSent(props: {
    thread_id: string;
    message_length: number;
    attachments_count?: number;
    config_id?: string;
    model?: string;
    provider?: string;
    role?: "user" | "assistant";
  }) {
    this.capture(AnalyticsEvents.ChatSent, props);
  }

  chatEdited(props: { chat_id: string; message_length: number }) {
    this.capture(AnalyticsEvents.ChatEdited, props);
  }

  chatBranchCreated(
    props: { chat_id: string; branch_id: string; parent_id?: string },
  ) {
    this.capture(AnalyticsEvents.ChatBranchCreated, props);
  }

  modelSelected(
    props: { assistant_id?: string; provider: string; model: string },
  ) {
    this.capture(AnalyticsEvents.ModelSelected, props);
  }
  
  modelRequestStarted(props: {
    provider: string;
    model: string;
    temperature?: number;
    stream?: boolean;
  }) {
    this.capture(AnalyticsEvents.ModelRequestStarted, props);
  }

  modelResponseReceived(props: {
    provider: string;
    model: string;
    latency_ms?: number;
    prompt_tokens?: number;
    completion_tokens?: number;
  }) {
    this.capture(AnalyticsEvents.ModelResponseReceived, props);
  }

  modelRequestFailed(props: {
    provider: string;
    model: string;
    status?: number;
    code?: string;
    message?: string;
    latency_ms?: number;
    network?: boolean;
  }) {
    this.capture(AnalyticsErrors.ModelRequestFailed, props);
  }

  modelTimeout(
    props: {
      provider: string;
      model: string;
      timeout_ms: number;
      retry_count?: number;
    },
  ) {
    this.capture(AnalyticsErrors.ModelTimeout, props);
  }

  fileAttached(
    props: { file_type: string; size_mb?: number; source?: string },
  ) {
    this.capture(AnalyticsEvents.FileAttached, props);
  }

  filePreviewed(props: { file_type: string }) {
    this.capture(AnalyticsEvents.FilePreviewed, props);
  }

  fileAttachFailed(
    props: { file_type?: string; size_mb?: number; reason?: string },
  ) {
    this.capture(AnalyticsErrors.FileAttachFailed, props);
  }

  syncConflictResolved(
    props: { resolution: "auto" | "manual"; conflict_count?: number },
  ) {
    this.capture(AnalyticsEvents.SyncConflictResolved, props);
  }

  syncConflictError(props: { conflict_count?: number; reason?: string }) {
    this.capture(AnalyticsErrors.SyncConflict, props);
  }

  storageWriteFailed(
    props: { path?: string; reason?: string; available_space_mb?: number },
  ) {
    this.capture(AnalyticsErrors.StorageWriteFailed, props);
  }

  spaceLoadFailed(props: { reason?: string }) {
    this.capture(AnalyticsErrors.SpaceLoadFailed, props);
  }

  onboardingOpened(props?: Record<string, unknown>) {
    this.capture(AnalyticsEvents.OnboardingOpened, props);
  }
  onboardingProviderConnected(props: { provider_id: string }) {
    this.capture(AnalyticsEvents.OnboardingProviderConnected, props);
  }
  onboardingCompleted(props?: { provider_connected?: boolean }) {
    this.capture(AnalyticsEvents.OnboardingCompleted, props);
  }
}
