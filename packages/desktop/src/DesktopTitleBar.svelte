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

  function updateWindowControlsOverlayInsets() {
    // Windows/Linux: keep title visually centered in the *available* titlebar area,
    // excluding the native window-controls region.
    if (typeof navigator === "undefined") return;
    const wco = (navigator as any).windowControlsOverlay;
    if (!wco?.getTitlebarAreaRect) return;
    if (!wco.visible) return;

    const r = wco.getTitlebarAreaRect(); // DOMRect-like
    const rightInset = window.innerWidth - (r.x + r.width);

    document.documentElement.style.setProperty("--wco-left", `${r.x}px`);
    document.documentElement.style.setProperty(
      "--wco-right",
      `${Math.max(0, rightInset)}px`,
    );
  }

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

    // Windows/Linux titlebar safe-area padding
    const wco = (navigator as any)?.windowControlsOverlay;
    const onGeometry = () => updateWindowControlsOverlayInsets();
    updateWindowControlsOverlayInsets();
    wco?.addEventListener?.("geometrychange", onGeometry);
    window.addEventListener("resize", onGeometry);

    updateOverlayColors();

    return () => {
      off?.();
      wco?.removeEventListener?.("geometrychange", onGeometry);
      window.removeEventListener("resize", onGeometry);
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
    style={`height: ${TITLEBAR_HEIGHT}px; -webkit-app-region: drag; padding-left: var(--wco-left, 0px); padding-right: var(--wco-right, 0px);`}
  >
    <div class="truncate max-w-[70vw] text-xs font-medium opacity-80">
      Sila / {workspaceTitle}
    </div>
  </div>
{/if}


