<script lang="ts">
  import { fly, fade } from "svelte/transition";
  import ChevronLeft from "lucide-svelte/icons/chevron-left";
  import X from "lucide-svelte/icons/x";
  import { onMount } from "svelte";
  import { useClientState } from "@sila/client/state/clientStateContext";

  const clientState = useClientState();
  const swins = $derived(clientState.layout.swins);

  // Function to handle breadcrumb navigation
  function handleBreadcrumbClick(pageIndex: number) {
    if (pageIndex < swins.windows.length - 1) {
      // If not the last page, use popTo to navigate to this page
      swins.popToWindow(swins.windows[pageIndex].id);
    }
  }

  // Function to close all pages
  function closeAll() {
    swins.clear();
  }

  // @TODO: review and delete if we don't actually need this
  // Function to check if we should ignore Esc key
  function shouldIgnoreEsc(activeElement: Element | null): boolean {
    if (!activeElement) return false;

    const tagName = activeElement.tagName.toLowerCase();
    
    // Check for form elements that might be in use
    if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') {
      return true;
    }

    // Check for contenteditable elements
    if (activeElement.getAttribute('contenteditable') === 'true') {
      return true;
    }

    // Check for elements with textbox role
    if (activeElement.getAttribute('role') === 'textbox') {
      return true;
    }

    // Check if we're inside a modal or dialog (higher z-index than swins)
    const elementZIndex = window.getComputedStyle(activeElement).zIndex;
    if (elementZIndex && parseInt(elementZIndex) > 49) {
      return true;
    }

    // Check if parent has a higher z-index (for nested modals)
    let parent = activeElement.parentElement;
    while (parent) {
      const parentZIndex = window.getComputedStyle(parent).zIndex;
      if (parentZIndex && parseInt(parentZIndex) > 49) {
        return true;
      }
      parent = parent.parentElement;
    }

    return false;
  }

  // Handle Esc key to close current swin
  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape' && swins.windows.length > 0) {
      const activeElement = document.activeElement;
      
      if (true/*!shouldIgnoreEsc(activeElement)*/) {
        event.preventDefault();
        swins.pop(); // Close the current (top) swin
      }
    }
  }

  onMount(() => {
    // Add global keydown listener when component mounts
    document.addEventListener('keydown', handleKeydown);

    // Cleanup on unmount
    return () => {
      document.removeEventListener('keydown', handleKeydown);
    };
  });
</script>

{#if swins.windows.length > 0}
  <!-- Stack of pages -->
  <div
    class="fixed inset-0 z-49 flex flex-col items-center p-4 pt-20 pb-20 overflow-y-auto"
    in:fly={{ y: 50, duration: 200 }}
    out:fly={{ y: 50, duration: 200 }}
  >
    <div
      class="absolute left-0 top-0 w-full h-full cursor-auto bg-surface-50/80 dark:bg-surface-950/80"
      onclick={closeAll}
      onkeydown={(e) => e.key === "Enter" && closeAll}
      role="button"
      tabindex="0"
      in:fade={{ duration: 100 }}
      out:fade={{ duration: 100 }}
    ></div>
    {#each swins.windows as page, i (page.id)}
      <div
        class="relative card selectable-text rounded-lg bg-surface-50-950 border-1 border-surface-200-800 shadow-2xl max-w-[800px] w-full flex flex-col overflow-hidden max-h-[calc(100vh-10rem)]"
        style="display: {i === swins.windows.length - 1 ? 'flex' : 'none'};"
      >
        {#if page}
          {@const Component = swins.componentRegistry[page.componentId]}

          {#if Component}
            <!-- Header with title and breadcrumb navigation -->
            <div
              class="flex justify-between items-center p-2 flex-shrink-0"
            >
              <!-- Left section with back button (only visible on sub-pages) -->
              <div class="flex-none">
                {#if i > 0}
                  <button
                    class="btn-icon hover:preset-tonal"
                    onclick={() => swins.pop()}
                    aria-label="Go back"
                  >
                    <ChevronLeft size={18} />
                  </button>
                {/if}
              </div>

              <!-- Center section with breadcrumbs -->
              <div class="flex-1 flex justify-center text-sm">
                <ol class="flex items-center gap-4">
                  {#each swins.windows.slice(0, i + 1) as breadcrumb, index}
                    {#if index > 0}
                      <li class="opacity-50" aria-hidden>&rsaquo;</li>
                    {/if}
                    {#if index === i}
                      <li>{breadcrumb.title || breadcrumb.componentId}</li>
                    {:else}
                      <li>
                        <a
                          class="opacity-60 hover:underline"
                          href="#"
                          onclick={(e) => {
                            e.preventDefault();
                            handleBreadcrumbClick(index);
                          }}
                        >
                          {breadcrumb.title || breadcrumb.componentId}
                        </a>
                      </li>
                    {/if}
                  {/each}
                </ol>
              </div>

              <!-- Right section with close button -->
              <div class="flex-none">
                <button
                  class="btn-icon hover:preset-tonal"
                  onclick={closeAll}
                  aria-label="Close all"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <!-- Render the component with its props -->
            <div class="p-3 pt-0 overflow-y-auto flex-1">
              <Component.component
                {...Component.defaultProps}
                {...page.props}
              />
            </div>
          {:else}
            <div class="p-3 text-error-500 text-center">
              Component not found: {page.componentId}
            </div>
          {/if}
        {/if}
      </div>
    {/each}
  </div>
{/if}
