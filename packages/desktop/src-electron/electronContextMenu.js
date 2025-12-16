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
      misspelledWord,
      dictionarySuggestions = [],
    } = params;

    // Don't interfere with app-level custom context menus outside editable fields.
    // Spellcheck suggestions only matter for editable content anyway.
    if (!isEditable) return;

    /** @type {import("electron").MenuItemConstructorOptions[]} */
    const template = [];

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
    template.push({ role: "copy", enabled: Boolean(selectionText) });
    template.push({ role: "paste" });
    template.push({ role: "selectAll" });

    const menu = Menu.buildFromTemplate(template);
    menu.popup({ window: win });
  });
}


