<script lang="ts">
  import { onMount } from "svelte";
  import { useClientState } from "@sila/client/state/clientStateContext";

  const clientState = useClientState();

  // Keep height aligned with main-process titleBarOverlay height.
  // This also visually aligns macOS traffic lights better (they are shorter).
  const TITLEBAR_HEIGHT =
    typeof process !== "undefined" && (process as any).platform === "darwin"
      ? 32
      : 36;

  let titleBarEl: HTMLDivElement | null = $state(null);
  let isFullScreen: boolean = $state(false);

  function updateOverlayColors() {
    const api = (globalThis as any)?.desktopTitlebar;
    if (!api?.setOverlay) return;
    if (!titleBarEl) return;

    const styles = getComputedStyle(titleBarEl);
    const bg = styles.backgroundColor;
    const fg = styles.color;

    api.setOverlay({ color: bg, symbolColor: fg, height: TITLEBAR_HEIGHT });
  }

  // Update on theme changes (themeName + resolved color scheme).
  $effect(() => {
    clientState.theme.themeName;
    clientState.theme.actualColorScheme;
    // Delay one tick so document theme attributes/styles have applied.
    queueMicrotask(updateOverlayColors);
  });

  onMount(() => {
    const winApi = (globalThis as any)?.desktopWindow;
    if (winApi?.isFullScreen) {
      winApi.isFullScreen().then((v: boolean) => {
        isFullScreen = !!v;
      });
    }

    const off =
      winApi?.onFullScreenChanged?.((payload: { isFullScreen: boolean }) => {
        isFullScreen = !!payload?.isFullScreen;
      }) ?? null;

    updateOverlayColors();

    return () => {
      off?.();
    };
  });

  const workspaceTitle = $derived(
    clientState.currentSpaceState?.pointer.name || "Workspace",
  );
</script>

<!--
  Custom, draggable title bar region.
  - Use a real CSS property for Electron drag: -webkit-app-region: drag
  - Keep it desktop-only by mounting from DesktopApp.svelte.
-->
{#if !isFullScreen}
  <div
    bind:this={titleBarEl}
    class="w-full flex items-center justify-center bg-surface-50-950 text-surface-900-50"
    style={`height: ${TITLEBAR_HEIGHT}px; -webkit-app-region: drag;`}
  >
    <div class="truncate max-w-[70vw] text-xs font-medium opacity-80">
      Sila / {workspaceTitle}
    </div>
  </div>
{/if}


