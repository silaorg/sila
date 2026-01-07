import { saveSpaceTheme, saveSpaceColorScheme, getSpaceSetup } from "@sila/client/localDb";

const DEFAULT_THEME = 'cerberus';

export class ThemeStore {
  colorScheme: 'system' | 'light' | 'dark' = $state(localStorage.getItem('colorScheme') as 'system' | 'light' | 'dark' || 'system');
  themeName: string = $state(localStorage.getItem('themeName') || DEFAULT_THEME);
  // Resolved scheme used by the UI; computed and set by ThemeManager
  // It's like colorScheme but the "system" value is resolved to the actual system color scheme.
  actualColorScheme: 'light' | 'dark' = $state('light');

  private currentSpaceUri: string | null = null;

  // Load theme and color scheme for the current space
  async loadSpaceTheme(currentSpaceUri: string | null) {
    this.currentSpaceUri = currentSpaceUri;

    if (!currentSpaceUri) {
      this.setDefaultTheme();
      return;
    }

    try {
      const spaceSetup = await getSpaceSetup(currentSpaceUri);

      // Load theme name
      if (spaceSetup?.theme) {
        this.themeName = spaceSetup.theme;
      } else {
        // If no theme is set for this space, try to load from localStorage
        const savedThemeName = localStorage.getItem('themeName');
        this.themeName = savedThemeName || DEFAULT_THEME;
      }

      // Load color scheme if available
      if (spaceSetup?.colorScheme) {
        this.colorScheme = spaceSetup.colorScheme;
      } else {
        // If no color scheme is set for this space, try to load from localStorage
        const savedColorScheme = localStorage.getItem('colorScheme');
        if (savedColorScheme && (savedColorScheme === 'system' || savedColorScheme === 'light' || savedColorScheme === 'dark')) {
          this.colorScheme = savedColorScheme as 'system' | 'light' | 'dark';
        } else {
          // Final fallback to system preference
          this.colorScheme = 'system';
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
    if (this.currentSpaceUri) {
      await saveSpaceTheme(this.currentSpaceUri, name);
    }
  }

  // Update the color scheme and persist it to the current space
  async setColorScheme(colorScheme: 'system' | 'light' | 'dark') {
    this.colorScheme = colorScheme;

    // Save to the current space if available
    if (this.currentSpaceUri) {
      await saveSpaceColorScheme(this.currentSpaceUri, colorScheme);
    }
  }

  setActualColorScheme(scheme: 'light' | 'dark') {
    this.actualColorScheme = scheme;
  }
}
