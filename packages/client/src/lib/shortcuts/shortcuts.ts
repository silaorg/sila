import type { ClientState } from "@sila/client/state/clientState.svelte";

// Platform detection (using userAgent instead of deprecated platform)
const isMac = typeof window !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.userAgent);

// Shortcut definitions
interface Shortcut {
  key: string;
  mac?: string; // Optional Mac-specific override
  ctrl?: boolean;
  meta?: boolean; // Cmd key on Mac
  shift?: boolean;
  alt?: boolean;
  action: () => void;
  description: string;
  preventDefault?: boolean;
}

let client: ClientState | null = null;

const shortcuts: Shortcut[] = [
  {
    key: 'b',
    meta: isMac,
    ctrl: !isMac,
    action: () => {
      const sidebar = client?.currentSpaceState?.layout.sidebar;
      if (sidebar) {
        sidebar.toggle();
      }
    },
    description: 'Toggle sidebar',
    preventDefault: true
  },
  {
    key: 'o',
    meta: isMac,
    ctrl: !isMac,
    shift: true,
    action: () => {
      client?.layout.swins.open("new-thread", {}, "New conversation");
    },
    description: 'Start new conversation',
    preventDefault: true
  }
];

// Check if a keyboard event matches a shortcut
function matchesShortcut(event: KeyboardEvent, shortcut: Shortcut): boolean {
  const keyMatches = event.key.toLowerCase() === shortcut.key.toLowerCase();
  const metaMatches = !!event.metaKey === !!shortcut.meta;
  const ctrlMatches = !!event.ctrlKey === !!shortcut.ctrl;
  const shiftMatches = !!event.shiftKey === !!shortcut.shift;
  const altMatches = !!event.altKey === !!shortcut.alt;
  
  return keyMatches && metaMatches && ctrlMatches && shiftMatches && altMatches;
}

// Global keyboard event handler
function handleKeydown(event: KeyboardEvent) {
  // Skip if user is typing in an input, textarea, or contenteditable
  /*
  const target = event.target as HTMLElement;
  if (
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.contentEditable === 'true'
  ) {
    return;
  }
  */

  for (const shortcut of shortcuts) {
    if (matchesShortcut(event, shortcut)) {
      if (shortcut.preventDefault) {
        event.preventDefault();
      }
      shortcut.action();
      break;
    }
  }
}

// Initialize shortcuts
export function initShortcuts(state: ClientState) {
  client = state;
  if (typeof window !== 'undefined') {
    window.addEventListener('keydown', handleKeydown);
  }
}

// Cleanup shortcuts
export function destroyShortcuts() {
  if (typeof window !== 'undefined') {
    window.removeEventListener('keydown', handleKeydown);
  }
  client = null;
}

// Get formatted shortcut strings for UI display
export function getShortcutString(shortcut: Shortcut): string {
  const parts: string[] = [];
  
  if (shortcut.meta && isMac) parts.push('⌘');
  if (shortcut.ctrl && !isMac) parts.push('Ctrl');
  if (shortcut.shift) parts.push('Shift');
  if (shortcut.alt) parts.push('Alt');
  parts.push(shortcut.key.toUpperCase());
  
  return parts.join(isMac ? '' : '+');
}

// Export shortcuts for documentation/help
export function getAllShortcuts() {
  return shortcuts.map(shortcut => ({
    description: shortcut.description,
    shortcut: getShortcutString(shortcut)
  }));
} 