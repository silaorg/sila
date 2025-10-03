<script lang="ts">
  import { useClientState } from "@sila/client/state/clientStateContext";
  const clientState = useClientState();
  import {
    applyColorSchemeToDocument,
    getOSColorScheme,
    DARK_MODE_MATCH_MEDIA_STR,
  } from "@sila/client/utils/updateColorScheme";
  import { onMount } from "svelte";

  // Works in pair with theme.svelte.ts: 
  // uses effects and applies the actual color scheme to the document and persists themes.

  function applyThemeToDocument(themeName: string) {
    document.documentElement.setAttribute("data-theme", themeName);
  }

  function computeActualColorScheme(): "light" | "dark" {
    if (clientState.theme.colorScheme === "system") return getOSColorScheme();
    return clientState.theme.colorScheme === "dark" ? "dark" : "light";
  }

  function applyActualColorScheme() {
    const resolved = computeActualColorScheme();
    clientState.theme.setActualColorScheme(resolved);
    applyColorSchemeToDocument(resolved);
  }

  onMount(() => {
    applyActualColorScheme();

    const mq = window.matchMedia(DARK_MODE_MATCH_MEDIA_STR);
    const handler = () => {
      if (clientState.theme.colorScheme === "system") {
        applyActualColorScheme();
      }
    };
    mq.addEventListener("change", handler);

    return () => {
      mq.removeEventListener("change", handler);
    };
  });

  $effect(() => {
    applyThemeToDocument(clientState.theme.themeName);
  });

  $effect(() => {
    // Save to localStorage for the next app launch so it doesn't flash and shows
    // the latest theme and color scheme of the current space
    if (clientState.currentSpaceState?.isConnected) {
      localStorage.setItem("themeName", clientState.theme.themeName);
      localStorage.setItem("colorScheme", clientState.theme.colorScheme);
    }
  });
</script>
