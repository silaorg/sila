<script lang="ts">
  import { onMount } from "svelte";

  onMount(() => {
    document.addEventListener("contextmenu", handleContextMenu);

    return () => {
      document.removeEventListener("contextmenu", handleContextMenu);
    };
  });

  function handleContextMenu(event: MouseEvent) {
    // Some build contexts don't type `import.meta.env` (Vite). Keep it safe.
    if ((import.meta as any)?.env?.DEV) return;
    if (window === null) return;

    // Check if there's selected text
    const selectedText = window.getSelection()?.toString();

    // Check if the target is a form element that would benefit from context menu
    const target = event.target;
    const isFormElement =
      target instanceof Element
        ? Boolean(
            target.closest(
              'input, textarea, select, [contenteditable], [role="textbox"]',
            ),
          )
        : false;

    // Allow OS context menu in explicitly opted-in areas (e.g., chat messages)
    const allowOsContextMenu =
      target instanceof Element
        ? Boolean(target.closest("[data-allow-os-context-menu]"))
        : false;

    // Allow context menu for text selections, form elements, or opted-in regions
    if (selectedText || isFormElement || allowOsContextMenu) {
      // Let the default context menu appear
      return;
    }

    // Otherwise prevent the default context menu
    event.preventDefault();

    // @TODO: detect if the element has a context menu and show it
  }
</script>
