<script lang="ts">
  // @TODO: at the moment the toast function works with toastState that is signletone,
  // we try not to use signletones in Sila and instead pack everything in
  // clientState that lives in a shared context. So we would need to refactor
  // toasts at some point to use clientState as well.
  // Perhaps make our own version of https://github.com/wobsoriano/svelte-sonner/
  import { Toaster, toast } from "svelte-sonner";
  import { useClientState } from "@sila/client/state/clientStateContext";
  import { onMount } from "svelte";
 
  onMount(() => {
    toast.success("Yaaaay!", {
      dismissable: true,
      duration: Infinity,
      closeButton: true,
    });

    toast("This is a regular toast!");
    toast.success("Operation completed successfully.");
    toast.error("Something went wrong.");
    toast.info("Here is some information.");
    toast.warning("This is a warning toast.");
  });
</script>

<Toaster position="top-right" />
