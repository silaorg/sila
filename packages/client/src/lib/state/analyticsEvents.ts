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
  ChatOpened: "chat_opened",
  ChatSent: "chat_sent",
  ChatEdited: "chat_edited",
  ChatBranchCreated: "chat_branch_created",
  ChatDeleted: "chat_deleted",
  TabOpened: "tab_opened",
  TabSplit: "tab_split",
  TabClosed: "tab_closed",
  FileAttached: "file_attached",
  FilePreviewed: "file_previewed",
  ThemeChanged: "theme_changed",
  LanguageChanged: "language_changed",
  ModelSelected: "model_selected",
  SyncEnabled: "sync_enabled",
  SettingsOpened: "settings_opened",
  SettingsSaved: "settings_saved",
  OnboardingOpened: "onboarding_opened",
  OnboardingProviderConnected: "onboarding_provider_connected",
  OnboardingCompleted: "onboarding_completed"
} as const;

export const AnalyticsErrors = {
  StorageWriteFailed: "error_storage_write_failed",
  SpaceLoadFailed: "error_space_load_failed",
  AssistantToolFailed: "error_assistant_tool_failed",
  FileAttachFailed: "error_file_attach_failed"
} as const;

export type AnalyticsEventName = typeof AnalyticsEvents[keyof typeof AnalyticsEvents];
export type AnalyticsErrorName = typeof AnalyticsErrors[keyof typeof AnalyticsErrors];
export type AnalyticsName = AnalyticsEventName | AnalyticsErrorName;
