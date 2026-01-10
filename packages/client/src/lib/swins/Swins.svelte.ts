import { type Component } from 'svelte';

/**
 * Represents a component entry in the registry
 */
export interface ComponentEntry<T extends Record<string, any> = Record<string, any>> {
  /** The actual Svelte component */
  component: Component<T>;
  /** Default props to pass to the component */
  defaultProps?: T;
}

/**
 * Represents a window entry in the stack
 */
export interface WindowEntry<T extends Record<string, any> = Record<string, any>> {
  /** Unique identifier for this window instance */
  id: string;
  /** ID of the component in the registry */
  componentId: string;
  /** Title to display in the header */
  title?: string;
  /** Props to pass to the component */
  props?: T;
}

/**
 * SWins - Stack-Based Windows Manager
 * 
 * This class handles a stack of windows and component registry.
 * It uses Svelte's $state for reactivity.
 */
export class SWins {
  // Component registry - stores all available components
  componentRegistry: Record<string, ComponentEntry<any>> = $state({});
  
  // Stack of windows
  windows: WindowEntry<any>[] = $state([]);

  // Overlay for the swins stack
  overlayEnabled: boolean = $state(true);
  
  /**
   * Register a component that can be used in windows
   * 
   * @param id Unique ID for the component
   * @param component The Svelte component to register
   * @param defaultProps Default props to pass to the component
   */
  register<T extends Record<string, any> = Record<string, any>>(id: string, component: Component<T>, defaultProps: T = {} as T) {
    this.componentRegistry[id] = { component, defaultProps };
    return this;
  }
  
  /**
   * Open a new window on top of the stack
   * 
   * @param componentId ID of the registered component
   * @param props Props to pass to the component
   * @param title Optional title for the window
   */
  open<T extends Record<string, any> = Record<string, any>>(componentId: string, props: Partial<T> = {}, title?: string) {    
    // Check if component exists
    if (!this.componentRegistry[componentId]) {
      console.error(`Component with ID "${componentId}" not found in registry`);
      return this;
    }

    this.overlayEnabled = true;

    // Create a unique ID for this window instance
    const id = `${componentId}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    
    // Add to stack
    this.windows = [...this.windows, { id, componentId, props, title }];
    
    return this;
  }
  
  /**
   * Remove the top window from the stack
   */
  pop() {
    if (this.windows.length > 0) {
      this.windows = this.windows.slice(0, -1);
    }
    if (this.windows.length === 0) {
      this.overlayEnabled = true;
    }
    return this;
  }
  
  /**
   * Pop until reaching a window with the specified component ID
   * 
   * @param componentId ID of the component to navigate to
   */
  popTo(componentId: string): boolean {
    const windowIndex = this.windows.findLastIndex(window => window.componentId === componentId);
    if (windowIndex !== -1) {
      this.windows = this.windows.slice(0, windowIndex + 1);
      if (this.windows.length === 0) {
        this.overlayEnabled = true;
      }
      return true;
    }
    
    return false;
  }

  /**
   * Pop until reaching a window with the specified ID
   * 
   * @param id ID of the window to navigate to
   */
  popToWindow(id: string): boolean {
    const windowIndex = this.windows.findIndex(window => window.id === id);
    if (windowIndex !== -1) {
      this.windows = this.windows.slice(0, windowIndex + 1);
      if (this.windows.length === 0) {
        this.overlayEnabled = true;
      }

      return true;
    }
    
    return false;
  }
  
  /**
   * Replace the current window with a new one
   * 
   * @param componentId ID of the component to use
   * @param props Props for the component
   * @param title Optional title for the window
   */
  replace<T extends Record<string, any> = Record<string, any>>(componentId: string, props: Partial<T> = {}, title?: string) {
    if (this.windows.length === 0) {
      return this.open(componentId, props, title);
    }

    this.overlayEnabled = true;
    
    // Create a unique ID for this window instance
    const id = `${componentId}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    
    // Replace the top window
    this.windows = [
      ...this.windows.slice(0, -1),
      { id, componentId, props, title }
    ];
    
    return this;
  }
  
  /**
   * Clear all windows from the stack
   */
  clear() {
    this.windows = [];
    this.overlayEnabled = true;
    return this;
  }

  clearRegistry() {
    this.componentRegistry = {};
    return this;
  }

  setOverlayEnabled(enabled: boolean) {
    this.overlayEnabled = enabled;
    return this;
  }

  disableOverlay() {
    return this.setOverlayEnabled(false);
  }

  enableOverlay() {
    return this.setOverlayEnabled(true);
  }
  
  /**
   * Check if a specific component is currently shown
   * 
   * @param componentId ID of the component to check
   */
  isShowing(componentId: string): boolean {
    return this.windows.some(win => win.componentId === componentId);
  }
  
  /**
   * Get the current top window if exists
   */
  get current(): WindowEntry | undefined {
    if (this.windows.length === 0) return undefined;
    return this.windows[this.windows.length - 1];
  }
}
