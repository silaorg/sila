import { Dialog } from "@capacitor/dialog";
import type {
  AppDialogs,
  MessageDialogOptions,
  MessageDialogResult,
  OpenDialogOptions,
  SaveDialogOptions
} from "@sila/client/appDialogs";

function buildMessage(opts: MessageDialogOptions): string {
  return [opts.message, opts.detail].filter(Boolean).join("\n");
}

export class CapacitorDialogsWrapper implements AppDialogs {
  async openDialog(_opts: OpenDialogOptions): Promise<string | string[] | null> {
    return null;
  }

  async saveDialog(_opts: SaveDialogOptions): Promise<string | null> {
    return null;
  }

  async showInfo(opts: MessageDialogOptions): Promise<MessageDialogResult> {
    await Dialog.alert({
      title: opts.title,
      message: buildMessage(opts)
    });
    return { response: 0 };
  }

  async showWarning(opts: MessageDialogOptions): Promise<MessageDialogResult> {
    await Dialog.alert({
      title: opts.title,
      message: buildMessage(opts)
    });
    return { response: 0 };
  }

  async showError(opts: MessageDialogOptions): Promise<MessageDialogResult> {
    await Dialog.alert({
      title: opts.title,
      message: buildMessage(opts)
    });
    return { response: 0 };
  }

  async showQuestion(opts: MessageDialogOptions): Promise<MessageDialogResult> {
    const result = await Dialog.confirm({
      title: opts.title,
      message: buildMessage(opts)
    });

    return { response: result.value ? 0 : 1 };
  }

  showErrorBox(title: string, content: string): void {
    void Dialog.alert({
      title,
      message: content
    });
  }
}

export const capacitorDialogsWrapper = new CapacitorDialogsWrapper();
