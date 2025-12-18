import { Menu, app } from "electron";

/**
 * Show a native context menu for editable fields, including spellcheck suggestions.
 * This is required because Electron does not show a default context menu.
 *
 * @param {import("electron").BrowserWindow} win
 */
export function setupElectronContextMenu(win) {
  const wc = win.webContents;

  // Best-effort: align spellchecker language with OS locale (when supported).
  try {
    const locale = app.getLocale?.();
    const lang = typeof locale === "string" ? locale.replaceAll("_", "-") : null;
    if (lang && wc.session?.setSpellCheckerLanguages) {
      wc.session.setSpellCheckerLanguages([lang]);
    }
  } catch {
    // ignore
  }

  wc.on("context-menu", (event, params) => {
    const {
      isEditable,
      selectionText,
      frame,
      misspelledWord,
      dictionarySuggestions = [],
    } = params;

    const hasSelection = Boolean(selectionText && selectionText.trim().length > 0);

    // Electron does not show a default context menu, so we must explicitly
    // show one for:
    // - editable fields (spellcheck, editing)
    // - selected text (copy / look up)
    //
    // Otherwise, don't interfere (the renderer may implement its own menus).
    if (!isEditable && !hasSelection) return;

    /** @type {import("electron").MenuItemConstructorOptions[]} */
    const template = [];

    if (isEditable) {
      if (misspelledWord && dictionarySuggestions.length > 0) {
        for (const suggestion of dictionarySuggestions.slice(0, 8)) {
          template.push({
            label: suggestion,
            click: () => wc.replaceMisspelling(suggestion),
          });
        }
        template.push({ type: "separator" });
      } else if (misspelledWord) {
        template.push({ label: "No suggestions", enabled: false });
        template.push({ type: "separator" });
      }

      if (misspelledWord) {
        template.push({
          label: `Add "${misspelledWord}" to Dictionary`,
          click: () => {
            try {
              wc.session.addWordToSpellCheckerDictionary(misspelledWord);
            } catch {
              // ignore
            }
          },
        });
        template.push({ type: "separator" });
      }

      // Standard editing actions
      template.push({ role: "undo" });
      template.push({ role: "redo" });
      template.push({ type: "separator" });
      template.push({ role: "cut" });
      template.push({ role: "copy", enabled: hasSelection });
      template.push({ role: "paste" });
      template.push({ role: "selectAll" });
    } else {
      // Selected text in non-editable content (e.g., chat messages)
      template.push({ role: "copy", enabled: hasSelection });

      if (process.platform === "darwin") {
        template.push({ type: "separator" });
        // macOS native "Look Up" (dictionary / definition).
        // Use webContents API instead of a role to keep typings happy under `checkJs`.
        template.push({
          label: "Look Up",
          click: () => {
            try {
              wc.showDefinitionForSelection?.();
            } catch {
              // ignore
            }
          },
        });
        template.push({ role: "services" });
      } else {
        // Reasonable cross-platform fallback
        template.push({ type: "separator" });
        template.push({ role: "selectAll" });
      }
    }

    const menu = Menu.buildFromTemplate(template);
    // On macOS, passing `frame` enables native Services / Look Up integration.
    // (See Electron "Context Menu" tutorial.)
    menu.popup(frame ? { window: win, frame } : { window: win });
  });
}





