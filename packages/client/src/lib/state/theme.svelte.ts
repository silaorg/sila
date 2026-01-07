import type { Space } from "@sila/core";

const DEFAULT_THEME = 'cerberus';
const ALLOWED_COLOR_SCHEMES = ["system", "light", "dark"] as const;
type AllowedColorScheme = (typeof ALLOWED_COLOR_SCHEMES)[number];

export class ThemeStore {
  // Startup fallback: used before a workspace is loaded and `root.theme` / `root.colorScheme`
  // are available. Prevents a visible theme/color-scheme flash on app launch.
  colorScheme: AllowedColorScheme = $state(
    isAllowedColorScheme(localStorage.getItem("colorScheme"))
      ? (localStorage.getItem("colorScheme") as AllowedColorScheme)
      : "system",
  );
  themeName: string = $state(localStorage.getItem('themeName') || DEFAULT_THEME);
  // Resolved scheme used by the UI; computed and set by ThemeManager
  // It's like colorScheme but the "system" value is resolved to the actual system color scheme.
  actualColorScheme: 'light' | 'dark' = $state('light');

  private currentSpace: Space | null = null;

  // Load theme and color scheme for the current space
  async loadSpaceTheme(space: Space | null) {
    this.currentSpace = space;

    if (!space) {
      this.setDefaultTheme();
      return;
    }

    try {
      // Prefer space root-vertex values (syncable, local-first)
      const rootTheme = typeof space.workspaceTheme === "string" ? space.workspaceTheme.trim() : "";
      const rootScheme = typeof space.workspaceColorScheme === "string" ? space.workspaceColorScheme.trim() : "";

      if (rootTheme) this.themeName = rootTheme;
      if (isAllowedColorScheme(rootScheme)) this.colorScheme = rootScheme;

      // If missing, fall back to localStorage (avoid flash on app load)
      if (!this.themeName) {
        const savedThemeName = localStorage.getItem("themeName");
        this.themeName = savedThemeName || DEFAULT_THEME;
      }

      if (!this.colorScheme || !isAllowedColorScheme(this.colorScheme)) {
        const savedColorScheme = localStorage.getItem("colorScheme");
        if (savedColorScheme && isAllowedColorScheme(savedColorScheme)) {
          this.colorScheme = savedColorScheme;
        } else {
          this.colorScheme = "system";
        }
      }
    } catch (error) {
      console.error('Failed to load space theme:', error);
      // Fall back to defaults
      this.setDefaultTheme();
    }
  }

  private setDefaultTheme() {
    // Try to load from localStorage first, then fall back to hardcoded defaults
    const savedThemeName = localStorage.getItem('themeName');
    const savedColorScheme = localStorage.getItem('colorScheme');

    this.themeName = savedThemeName || DEFAULT_THEME;

    if (savedColorScheme && (savedColorScheme === 'system' || savedColorScheme === 'light' || savedColorScheme === 'dark')) {
      this.colorScheme = savedColorScheme as 'system' | 'light' | 'dark';
    } else {
      this.colorScheme = 'system';
    }
  }

  // Update the themeName and persist it to the current space
  async setThemeName(name: string) {
    this.themeName = name;

    // Save to the current space if available
    if (this.currentSpace) {
      this.currentSpace.workspaceTheme = name;
    }
  }

  // Update the color scheme and persist it to the current space
  async setColorScheme(colorScheme: AllowedColorScheme) {
    this.colorScheme = colorScheme;

    // Save to the current space if available
    if (this.currentSpace) {
      this.currentSpace.workspaceColorScheme = colorScheme;
    }
  }

  setActualColorScheme(scheme: 'light' | 'dark') {
    this.actualColorScheme = scheme;
  }
}

function isAllowedColorScheme(x: unknown): x is AllowedColorScheme {
  return (
    typeof x === "string" &&
    (ALLOWED_COLOR_SCHEMES as ReadonlyArray<string>).includes(x)
  );
}
