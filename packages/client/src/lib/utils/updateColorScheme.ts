export const DARK_MODE_MATCH_MEDIA_STR = "(prefers-color-scheme: dark)"; 
export const COLOR_SCHEMA_STORAGE_KEY = "colorScheme";

// This function applies the color scheme to the document without updating the theme store
// to avoid circular dependencies
export function applyColorSchemeToDocument(colorScheme: 'light' | 'dark') {
  if (colorScheme === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}

export function getCurrentColorScheme(): 'dark' | 'light' {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

export function getOSColorScheme(): 'dark' | 'light' {
  const darkModeIsOnInOS = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  return darkModeIsOnInOS ? 'dark' : 'light';
}