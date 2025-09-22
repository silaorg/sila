<script lang="ts">
  import { useClientState } from "@sila/client/state/clientStateContext";
  import { LogOut, User } from "lucide-svelte";
  const clientState = useClientState();

  const handleSignOut = async () => {
    // Use orchestrated sign-out workflow
    // This handles: auth logout → space filtering → socket cleanup → theme reset
    await clientState.signOut();
  };
</script>

<div class="p-4">
  <div class="flex items-center gap-3 mb-3">
    <div class="w-8 h-8 rounded-full bg-surface-500 flex items-center justify-center">
      {#if clientState.auth.user?.avatarUrl}
        <img 
          src={clientState.auth.user.avatarUrl} 
          alt="User avatar" 
          class="w-8 h-8 rounded-full object-cover"
        />
      {:else}
        <User size={16} class="text-white" />
      {/if}
    </div>
    <div class="flex-1 min-w-0">
      <p class="text-sm font-medium truncate">
        {clientState.auth.user?.name || clientState.auth.user?.email || 'User'}
      </p>
      {#if clientState.auth.user?.email && clientState.auth.user?.name}
        <p class="text-xs text-surface-500 truncate">
          {clientState.auth.user.email}
        </p>
      {/if}
    </div>
  </div>
  
  <button
    type="button"
    class="btn btn-sm variant-ghost w-full flex items-center justify-center gap-2"
    onclick={handleSignOut}
  >
    <LogOut size={14} />
    Sign Out
  </button>
</div> 