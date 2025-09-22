<script lang="ts">
  import { useClientState } from "@sila/client/state/clientStateContext";
  import { User } from "lucide-svelte";
  const clientState = useClientState();

  const handleSignIn = () => {
    clientState.layout.swins.open('sign-in', {}, 'Sign In');
  };

  const handleUserProfile = () => {
    clientState.layout.swins.open('user-profile', {}, 'Profile');
  };
</script>

{#if clientState.auth.isAuthenticated}
  <button
    type="button"
    class="w-full text-left p-4"
    onclick={handleUserProfile}
  >
    <div class="flex items-center gap-3">
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
      </div>
    </div>
  </button>
{:else}
  <div class="p-4">
    <button
      type="button"
      class="btn variant-filled-primary w-full flex items-center justify-center gap-2"
      onclick={handleSignIn}
    >
      <User size={16} />
      Sign In
    </button>
  </div>
{/if} 