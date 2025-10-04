<script lang="ts">
  // @TODO: at the moment the toast function works with toastState that is signletone,
  // we try not to use signletones in Sila and instead pack everything in
  // clientState that lives in a shared context. So we would need to refactor
  // toasts at some point to use clientState as well.
  // Perhaps make our own version of https://github.com/wobsoriano/svelte-sonner/
  import { Toaster } from "svelte-sonner";
  import { useClientState } from "@sila/client/state/clientStateContext";

  const clientState = useClientState();
</script>

<Toaster position="top-right" theme={clientState.theme.actualColorScheme} />
