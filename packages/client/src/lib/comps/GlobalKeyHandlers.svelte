<script lang="ts">
  import { onMount } from "svelte";
  import { useClientState } from "@sila/client/state/clientStateContext";

  const clientState = useClientState();
  const isMac = typeof window !== "undefined" && /Mac|iPod|iPhone|iPad/.test(navigator.userAgent);

  type ShortcutId = "newConversation" | "toggleSidebar";

  const bindings: Record<ShortcutId, string> = {
    newConversation: isMac ? "meta+n" : "ctrl+n",
    toggleSidebar: isMac ? "meta+b" : "ctrl+b"
  };

  const normalize = (event: KeyboardEvent): string => {
    const parts: string[] = [];
    if (event.metaKey) parts.push("meta");
    if (event.ctrlKey) parts.push("ctrl");
    if (event.altKey) parts.push("alt");
    if (event.shiftKey) parts.push("shift");
    parts.push(event.key.toLowerCase());
    return parts.join("+");
  };

  const runAction = (action: ShortcutId) => {
    switch (action) {
      case "newConversation":
        clientState.layout.swins.replace("new-thread", {}, "New conversation");
        break;
      case "toggleSidebar":
        clientState.currentSpaceState?.layout.sidebar.toggle();
        break;
    }
  };

  const matches = (event: KeyboardEvent, action: ShortcutId) => normalize(event) === bindings[action];

  onMount(() => {
    // Single global Esc emitter (bubbling). Inputs/contenteditable are ignored;
    // the most recently opened overlay handles the "close" via the event stack.
    const escListener = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.key !== "Escape") return;
      const target = e.target as HTMLElement | null;
      if (target) {
        const tn = target.tagName?.toLowerCase();
        const isForm = tn === "input" || tn === "textarea" || tn === "select";
        const isEditable = target.getAttribute?.("contenteditable") === "true" || target.getAttribute?.("role") === "textbox";
        if (isForm || isEditable) return;
      }
      if (clientState.requestClose()) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    const shortcutListener = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if (matches(e, "newConversation")) {
        e.preventDefault();
        runAction("newConversation");
        return;
      }
      if (matches(e, "toggleSidebar")) {
        e.preventDefault();
        runAction("toggleSidebar");
      }
    };

    const electronMenuCleanup = (window as any)?.desktopMenu?.onAction?.((actionId: string) => {
      if (actionId === "new-conversation") {
        runAction("newConversation");
      } else if (actionId === "toggle-sidebar") {
        runAction("toggleSidebar");
      }
    });

    window.addEventListener("keydown", escListener);
    window.addEventListener("keydown", shortcutListener);

    return () => {
      window.removeEventListener("keydown", escListener);
      window.removeEventListener("keydown", shortcutListener);
      electronMenuCleanup?.();
    };
  });
</script>
