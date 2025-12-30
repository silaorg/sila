<script lang="ts">
  import type { Snippet } from "svelte";
  import { useClientState } from "@sila/client/state/clientStateContext";
  import { swinsLayout, type SwinsKey } from "../state/swinsLayout";
  const clientState = useClientState();

  let {
    children,
    component,
    props,
    title,
    className,
    pop,
    popTo,
    onclick,
    dataRole,
  }: {
    children: Snippet;
    component: SwinsKey;
    props?: Record<string, any>;
    title: string;
    className?: string;
    pop?: 'current' | 'all';
    popTo?: SwinsKey;
    onclick?: () => void;
    dataRole?: string;
  } = $props();

  function handleClick() {
    if (pop === 'current') {
      clientState.layout.swins.pop();
    } else if (pop === 'all') {
      clientState.layout.swins.clear();
    } else if (popTo) {
      clientState.layout.swins.popTo(swinsLayout[popTo].key);
    }

    clientState.layout.swins.open(swinsLayout[component].key, props, title);

    if (onclick) {
      onclick();
    }
  }
</script>

<button class={className} onclick={handleClick} data-role={dataRole}>
  {@render children?.()}
</button>
