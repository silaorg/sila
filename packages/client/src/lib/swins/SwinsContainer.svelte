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

  import { closeStack } from '@sila/client/utils/closeStack';
  onMount(() => { return () => {}; });
</script>

{#if swins.windows.length > 0}
  <!-- Stack of pages -->
  <div
    class="fixed inset-0 z-49 flex flex-col items-center p-4 pt-20 pb-20 overflow-y-auto"
    use:closeStack={() => {
      if (swins.windows.length === 0) return false;
      swins.pop();
      return true;
    }}
  >
    <div
      class="absolute left-0 top-0 w-full h-full cursor-auto bg-surface-50/80 dark:bg-surface-950/80"
      onclick={closeAll}
      onkeydown={(e) => e.key === "Enter" && closeAll}
      role="button"
      tabindex="0"
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
                      <li class="opacity-50" aria-hidden="true">&rsaquo;</li>
                    {/if}
                    {#if index === i}
                      <li>{breadcrumb.title || breadcrumb.componentId}</li>
                    {:else}
                      <li>
                        <button
                          type="button"
                          class="opacity-60 hover:underline"
                          onclick={() => handleBreadcrumbClick(index)}
                        >
                          {breadcrumb.title || breadcrumb.componentId}
                        </button>
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
