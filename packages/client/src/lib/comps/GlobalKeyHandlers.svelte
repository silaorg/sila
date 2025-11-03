<script lang="ts">
  import { onMount } from "svelte";
  import { useClientState } from "@sila/client/state/clientStateContext";

  const clientState = useClientState();

  onMount(() => {
    // Single global Esc emitter (bubbling). Inputs/contenteditable are ignored;
    // the most recently opened overlay handles the "close" via the event stack.
    const listener = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.key !== "Escape") return;
      const target = e.target as HTMLElement | null;
      if (target) {
        const tn = target.tagName?.toLowerCase();
        const isForm = tn === 'input' || tn === 'textarea' || tn === 'select';
        const isEditable = target.getAttribute?.('contenteditable') === 'true' || target.getAttribute?.('role') === 'textbox';
        if (isForm || isEditable) return;
      }
      if (clientState.requestClose()) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  });
</script>

