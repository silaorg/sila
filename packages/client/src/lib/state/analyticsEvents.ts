export const AnalyticsEvents = {
  AppOpened: "app_opened",
  AppClosed: "app_closed",
  SpaceCreated: "space_created",
  SpaceCreatedDemo: "space_created_demo",
  SpaceEntered: "space_entered",
  SpaceSwitched: "space_switched",
  SpaceRenamed: "space_renamed",
  AssistantCreated: "assistant_created",
  AssistantUpdated: "assistant_updated",
  AssistantDeleted: "assistant_deleted",
  ChatStarted: "chat_started",
  ChatSent: "chat_sent",
  ChatEdited: "chat_edited",
  ChatBranchCreated: "chat_branch_created",
  TabOpened: "tab_opened",
  TabSplit: "tab_split",
  TabClosed: "tab_closed",
  FileAttached: "file_attached",
  FilePreviewed: "file_previewed",
  ThemeChanged: "theme_changed",
  LanguageChanged: "language_changed",
  ModelSelected: "model_selected",
  ModelRequestStarted: "model_request_started",
  ModelResponseReceived: "model_response_received",
  SyncEnabled: "sync_enabled",
  SyncConflictResolved: "sync_conflict_resolved",
  SettingsOpened: "settings_opened",
  SettingsSaved: "settings_saved",
  OnboardingOpened: "onboarding_opened",
  OnboardingProviderConnected: "onboarding_provider_connected",
  OnboardingCompleted: "onboarding_completed"
} as const;

export const AnalyticsErrors = {
  ModelRequestFailed: "error_model_request_failed",
  ModelTimeout: "error_model_timeout",
  SyncConflict: "error_sync_conflict",
  StorageWriteFailed: "error_storage_write_failed",
  SpaceLoadFailed: "error_space_load_failed",
  AssistantToolFailed: "error_assistant_tool_failed",
  FileAttachFailed: "error_file_attach_failed"
} as const;

export type AnalyticsEventName = typeof AnalyticsEvents[keyof typeof AnalyticsEvents];
export type AnalyticsErrorName = typeof AnalyticsErrors[keyof typeof AnalyticsErrors];
export type AnalyticsName = AnalyticsEventName | AnalyticsErrorName;
