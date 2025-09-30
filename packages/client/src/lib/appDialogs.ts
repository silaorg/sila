export interface OpenDialogOptions {
  title?: string;
  directory?: boolean;
  multiple?: boolean;
  defaultPath?: string;
  filters?: { name: string; extensions: string[] }[];
}

export interface SaveDialogOptions {
  title?: string;
  defaultPath?: string;
  filters?: { name: string; extensions: string[] }[];
}

export interface MessageDialogOptions {
  title?: string;
  message: string;
  detail?: string;
  buttons?: string[];
  defaultId?: number;
  cancelId?: number;
  checkboxLabel?: string;
  checkboxChecked?: boolean;
}

export interface MessageDialogResult {
  response: number;
  checkboxChecked?: boolean;
}

export interface AppDialogs {
  openDialog(opts: OpenDialogOptions): Promise<string | string[] | null>;
  saveDialog(opts: SaveDialogOptions): Promise<string | null>;
  
  // Message dialogs
  showInfo(opts: MessageDialogOptions): Promise<MessageDialogResult>;
  showWarning(opts: MessageDialogOptions): Promise<MessageDialogResult>;
  showError(opts: MessageDialogOptions): Promise<MessageDialogResult>;
  showQuestion(opts: MessageDialogOptions): Promise<MessageDialogResult>;
  
  // Simple error dialog (non-blocking, for early startup errors)
  showErrorBox(title: string, content: string): void;
} 