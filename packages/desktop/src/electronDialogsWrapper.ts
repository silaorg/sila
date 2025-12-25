import type { AppDialogs, OpenDialogOptions, SaveDialogOptions, MessageDialogOptions, MessageDialogResult } from '@sila/client/appDialogs';

export class ElectronDialogsWrapper implements AppDialogs {
  private get api() {
    if (!window.electronDialog) {
      throw new Error('electronDialog is not available. Ensure preload exposes it.');
    }
    return window.electronDialog;
  }

  async openDialog(opts: OpenDialogOptions): Promise<string | string[] | null> {
    return this.api.openDialog(opts);
  }

  async saveDialog(opts: SaveDialogOptions): Promise<string | null> {
    return this.api.saveDialog(opts);
  }

  async showInfo(opts: MessageDialogOptions): Promise<MessageDialogResult> {
    return this.api.showInfo(opts);
  }

  async showWarning(opts: MessageDialogOptions): Promise<MessageDialogResult> {
    return this.api.showWarning(opts);
  }

  async showError(opts: MessageDialogOptions): Promise<MessageDialogResult> {
    return this.api.showError(opts);
  }

  async showQuestion(opts: MessageDialogOptions): Promise<MessageDialogResult> {
    return this.api.showQuestion(opts);
  }

  showErrorBox(title: string, content: string): void {
    this.api.showErrorBox(title, content);
  }
}

export const electronDialogsWrapper = new ElectronDialogsWrapper(); 