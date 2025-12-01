import type { TtabsTheme } from 'ttabs-svelte';

/**
 * A theme for ttabs that integrates with Skeleton UI's theme system
 * Requires Skeleton UI to be installed and configured
 */
export const SKELETON_THEME: TtabsTheme = {
  name: 'skeleton',
  variables: {
    // Base
    '--ttabs-panel-bg': 'var(--color-surface-50-950)',
    '--ttabs-tab-bar-bg': 'color-mix(in oklab, var(--color-surface-50-950) 50%, var(--color-surface-100-900) 50%)',
    '--ttabs-active-tab-bg': 'var(--color-surface-50-950)',
    '--ttabs-active-tab-indicator': 'var(--color-primary-500)',
    '--ttabs-grid-bg': 'var(--color-surface-200-800)',
    '--ttabs-grid-border': 'none',
    '--ttabs-column-border': 'var(--default-border-width, 1px) solid var(--color-surface-300-700)',
    
    // Text colors
    '--ttabs-tab-text-color': 'var(--color-surface-700-300)',
    '--ttabs-tab-active-text-color': 'var(--color-surface-900-50)',
    
    // Content area
    '--ttabs-content-bg': 'var(--color-surface-50-950)',
    '--ttabs-content-border': 'var(--default-border-width, 1px) solid var(--color-surface-300-700)',
    '--ttabs-content-text-color': 'var(--color-surface-900-50)',
    '--ttabs-content-padding': 'var(--spacing, 1rem)',
    
    // Tab headers
    '--ttabs-tab-header-padding': '0.755rem 1rem',
    '--ttabs-tab-header-font-size': 'var(--base-font-size)',
    '--ttabs-tab-bar-border': 'none',
    '--ttabs-tab-indicator-size': '1px',
    '--ttabs-tab-indicator-offset': '0',
    '--ttabs-transition-duration': '0',
    '--ttabs-transition-timing': 'ease',
    
    // Controls
    '--ttabs-show-close-button': 'flex', 
    '--ttabs-close-button-color': 'var(--color-surface-500)',
    '--ttabs-close-button-hover-color': 'var(--color-surface-700-300)',
    '--ttabs-close-button-hover-bg': 'var(--color-surface-200-800)',
    '--ttabs-tab-close-margin': '8px',
    '--ttabs-tab-close-size': '16px',
    '--ttabs-tab-close-border-radius': '50%',
    
    // Error styling
    '--ttabs-error-bg': 'var(--color-error-100-900)',
    '--ttabs-error-color': 'var(--color-error-500)',
    '--ttabs-error-border': 'var(--default-border-width, 1px) solid var(--color-error-500)',
    '--ttabs-error-padding': 'var(--spacing, 1rem)',
    '--ttabs-error-border-radius': '0',
    
    // Empty state
    '--ttabs-empty-state-color': 'var(--color-surface-500)',
    
    // Utility elements
    '--ttabs-resizer-hover-color': 'var(--color-secondary-500)',
    '--ttabs-drop-indicator-color': 'var(--color-primary-500)',
    '--ttabs-drop-target-outline': '2px dashed color-mix(in oklab, var(--color-primary-500) 50%, transparent)',
    '--ttabs-split-indicator-color': 'color-mix(in oklab, var(--color-tertiary-500) 50%, transparent)',
    '--ttabs-row-resizer-size': '6px',
    '--ttabs-row-resizer-offset': '-3px',
    '--ttabs-column-resizer-size': '6px',
    '--ttabs-column-resizer-offset': '-3px',
    '--ttabs-drop-indicator-width': '4px',
    '--ttabs-drop-indicator-offset': '-2px',
    
    // Border radius
    '--ttabs-border-radius': '0',
    '--ttabs-border-radius-sm': '0'
  },
  
  // Optional classes that can be added
  classes: {
    // Add Skeleton-compatible classes here if needed
    'panel': 'overflow-hidden',
    'tab-header-focused': 'focus-visible:outline-none'
  }
};

// Glass effect variant
export const SKELETON_GLASS_THEME: TtabsTheme = {
  name: 'skeleton-glass',
  extends: SKELETON_THEME,
  variables: {
    '--ttabs-panel-bg': 'color-mix(in oklab, var(--color-surface-50-950) 30%, transparent)',
    '--ttabs-tab-bar-bg': 'color-mix(in oklab, var(--color-surface-100-900) 50%, transparent)',
    '--ttabs-active-tab-bg': 'color-mix(in oklab, var(--color-surface-50-950) 50%, transparent)',
    '--ttabs-grid-bg': 'color-mix(in oklab, var(--color-surface-200-800) 30%, transparent)'
  }
};

// Create a custom close button component for Skeleton UI
// Note: this should be implemented as a .svelte file, but included here for reference
/*
<!-- SkeletonCloseButton.svelte -->
<script lang="ts">
  export let tabId: string;
  export let ttabs: any;
  export let onClose: () => void;
</script>

<button
  class="btn-icon btn-icon-sm variant-ghost hover:variant-soft rounded-full"
  on:click={(e) => {
    e.stopPropagation();
    onClose();
  }}
  aria-label="Close tab"
>
  <span class="text-sm">✕</span>
</button>

<style>
  button {
    margin-left: 8px;
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
</style>
*/ 