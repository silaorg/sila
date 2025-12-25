import type { AppFileSystem } from "@sila/client/appFs";
import type { AppDialogs } from "@sila/client/appDialogs";

declare global {
  interface Window {
    electronFs: AppFileSystem;
    electronDialog: AppDialogs;

    desktopWindow?: {
      onFullScreenChanged?: (callback: (payload: { isFullScreen: boolean }) => void) => () => void;
      isFullScreen?: () => Promise<boolean>;
    };

    desktopTitlebar?: {
      setOverlay?: (overlay: {
        color?: string;
        symbolColor?: string;
        height?: number;
      }) => Promise<boolean>;
    };
  }
}

export {};


