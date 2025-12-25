<script lang="ts">
  import { onDestroy, onMount, untrack } from "svelte";
  import Sidebar from "./Sidebar.svelte";
  import { useClientState } from "@sila/client/state/clientStateContext";

  let showHoverSidebar = $state(false);
  let hoverTriggerTimeout: ReturnType<typeof setTimeout> | null = null;
  let closeSidebarTimeout: ReturnType<typeof setTimeout> | null = null;
  let recentlyClosed = $state(false);
  // `bind:this` updates the variable; in Svelte 5 it should be `$state` to avoid non-reactive update warnings.
  let sidebarElement: HTMLElement | null = $state(null);

  const clientState = useClientState();
  let sidebarIsOpen = $derived(
    clientState.currentSpaceState?.layout.sidebar.isOpen
  );

  function handleHoverEnter() {
    if (!sidebarIsOpen && !recentlyClosed) {
      // Clear any closing timeout that might be active
      if (closeSidebarTimeout) {
        clearTimeout(closeSidebarTimeout);
        closeSidebarTimeout = null;
      }

      // Set timeout to show sidebar
      if (!showHoverSidebar) {
        hoverTriggerTimeout = setTimeout(() => {
          showHoverSidebar = true;
        }, 200);
      }
    }
  }

  function isOverContextMenu(event?: MouseEvent) {
    // If no event provided, check current mouse position
    if (!event) {
      const openContextMenus = document.querySelectorAll(
        ".context-menu, [data-popover-content]"
      );
      for (const menu of openContextMenus) {
        const rect = menu.getBoundingClientRect();
        // We don't have exact mouse position here, so just check if menu exists
        if (menu.matches(":hover")) {
          return true;
        }
      }
      return false;
    }

    // Check if the related target is inside a popover (context menu)
    const target = event.relatedTarget as HTMLElement;
    if (!target) return false;

    // Check for context menu classes and popover elements
    const popover = target.closest(
      ".context-menu, [data-popover-content], [role='dialog']"
    );
    return !!popover;
  }

  function hasOpenContextMenu() {
    // Check if any context menus are currently open in the document
    const openContextMenus = document.querySelectorAll(
      ".context-menu, [data-popover-content][data-state='open']"
    );
    return openContextMenus.length > 0;
  }

  function isMouseOverSidebarArea(event: MouseEvent) {
    if (!sidebarElement) return false;

    const rect = sidebarElement.getBoundingClientRect();
    const { clientX, clientY } = event;

    return (
      clientX >= rect.left &&
      clientX <= rect.right &&
      clientY >= rect.top &&
      clientY <= rect.bottom
    );
  }

  function isMouseOverAnyContextMenu(event: MouseEvent) {
    const openContextMenus = document.querySelectorAll(
      ".context-menu, [data-popover-content]"
    );
    const { clientX, clientY } = event;

    for (const menu of openContextMenus) {
      const rect = menu.getBoundingClientRect();
      if (
        clientX >= rect.left &&
        clientX <= rect.right &&
        clientY >= rect.top &&
        clientY <= rect.bottom
      ) {
        return true;
      }
    }
    return false;
  }

  function handleGlobalMouseMove(event: MouseEvent) {
    // Only track when hover sidebar is open
    if (!showHoverSidebar) return;

    const overSidebar = isMouseOverSidebarArea(event);
    const overContextMenu = isMouseOverAnyContextMenu(event);

    // If mouse is not over sidebar or any context menu, start closing
    if (!overSidebar && !overContextMenu) {
      if (closeSidebarTimeout) {
        clearTimeout(closeSidebarTimeout);
      }

      closeSidebarTimeout = setTimeout(() => {
        // Double-check before closing
        if (!hasOpenContextMenu()) {
          showHoverSidebar = false;
        }
      }, 200);
    } else {
      // Mouse is over sidebar or context menu, cancel any pending close
      if (closeSidebarTimeout) {
        clearTimeout(closeSidebarTimeout);
        closeSidebarTimeout = null;
      }
    }
  }

  function handleHoverLeave(event: MouseEvent) {
    // Clear the show timeout if it's active
    if (hoverTriggerTimeout) {
      clearTimeout(hoverTriggerTimeout);
      hoverTriggerTimeout = null;
    }

    // Don't close if we're over a context menu or if any context menu is open
    if (!isOverContextMenu(event) && !hasOpenContextMenu()) {
      closeSidebarTimeout = setTimeout(() => {
        // Double-check that no context menus opened during the delay
        if (!hasOpenContextMenu()) {
          showHoverSidebar = false;
        }
      }, 200);
    }
  }

  function handleSidebarLeave(event: MouseEvent) {
    // Don't close if we're over a context menu or if any context menu is open
    if (!isOverContextMenu(event) && !hasOpenContextMenu()) {
      closeSidebarTimeout = setTimeout(() => {
        // Double-check that no context menus opened during the delay
        if (!hasOpenContextMenu()) {
          showHoverSidebar = false;
        }
      }, 200);
    }
  }

  // Watch for sidebar state changes
  $effect(() => {
    if (!sidebarIsOpen) {
      untrack(() => {
        // Force the hover sidebar in a closed state just in case
        showHoverSidebar = false;
        // Set recently closed flag
        recentlyClosed = true;
        // Clear the flag after a delay
        setTimeout(() => {
          recentlyClosed = false;
        }, 500); // Half-second delay
      });
    }
  });

  // Add global mouse tracking when hover sidebar is open
  $effect(() => {
    if (showHoverSidebar) {
      document.addEventListener("mousemove", handleGlobalMouseMove);
      return () => {
        document.removeEventListener("mousemove", handleGlobalMouseMove);
      };
    }
  });

  onDestroy(() => {
    if (hoverTriggerTimeout) clearTimeout(hoverTriggerTimeout);
    if (closeSidebarTimeout) clearTimeout(closeSidebarTimeout);
    document.removeEventListener("mousemove", handleGlobalMouseMove);
  });
</script>

<!-- Hover trigger area - only present when sidebar is closed and not recently (500ms or so) closed -->
{#if !sidebarIsOpen && !recentlyClosed}
  <div
    class="fixed z-10 w-5 left-0 opacity-0 cursor-auto"
    style="top: calc(2.5rem + var(--sila-chrome-top, 0px)); height: calc(100vh - 2.5rem - var(--sila-chrome-top, 0px));"
    onmouseenter={handleHoverEnter}
    onmouseleave={handleHoverLeave}
    tabindex="0"
    role="button"
  ></div>
{/if}

<!-- Hoverable sidebar - always rendered but only visible when triggered -->
{#if !sidebarIsOpen}
  <div
    bind:this={sidebarElement}
    class="hover-sidebar fixed p-1 w-[300px] z-10 cursor-default"
    style="top: var(--sila-chrome-top, 0px); height: calc(100vh - var(--sila-chrome-top, 0px));"
    class:show-sidebar={showHoverSidebar}
    onmouseenter={handleHoverEnter}
    onmouseleave={handleSidebarLeave}
    tabindex="0"
    role="button"
  >
    <div
      class="bg-surface-50-950 h-full rounded-lg"
      class:border={showHoverSidebar}
      class:border-surface-300-700={showHoverSidebar}
      class:shadow-2xl={showHoverSidebar}
    >
      <Sidebar />
    </div>
  </div>
{/if}

<style>
  .hover-sidebar {
    transform: translateX(-300px);
    transition:
      transform 100ms ease-out,
      border-color 100ms,
      box-shadow 100ms;
  }

  .hover-sidebar.show-sidebar {
    transform: translateX(0);
  }
</style>
