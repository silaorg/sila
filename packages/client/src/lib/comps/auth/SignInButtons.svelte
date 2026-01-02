<script lang="ts">
  import { API_BASE_URL } from "@sila/client/utils/api";
  import { i18n } from "@sila/client";

  let serverOnline = $state(true);
  let checkingServer = $state(true);

  // Check if server is online
  $effect(() => {
    checkServerHealth();
  });

  const checkServerHealth = async () => {
    try {
      checkingServer = true;
      const response = await fetch(`${API_BASE_URL}/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      serverOnline = response.ok;
    } catch (error) {
      console.warn('Server health check failed:', error);
      serverOnline = false;
    } finally {
      checkingServer = false;
    }
  };

  const handleGoogleLogin = async () => {
    if (!serverOnline) return;
    
    try {
      // Redirect to the API server's Google OAuth endpoint
      // The server will handle the OAuth flow and redirect back with a token
      window.location.href = `${API_BASE_URL}/auth/login/google`;
    } catch (error) {
      console.error('Google login error:', error);
    }
  };

  const handleGithubLogin = async () => {
    if (!serverOnline) return;
    // TODO: Implement GitHub OAuth
    console.log('GitHub OAuth not implemented yet');
  };

  const handleXLogin = async () => {
    if (!serverOnline) return;
    // TODO: Implement X/Twitter OAuth  
    console.log('X OAuth not implemented yet');
  };
</script>

{#if !serverOnline}
  <div class="text-center p-4 mb-4">
    <div class="bg-warning-100-900 border border-warning-300-700 rounded-lg p-4">
      <p class="font-medium mb-2">{i18n.texts.auth.serversOfflineTitle}</p>
      <p class="text-sm">{i18n.texts.auth.serversOfflineMessage}</p>
    </div>
  </div>
{/if}

<button
  type="button"
  class="btn flex w-full bg-blue-600 text-white mb-4"
  class:opacity-50={!serverOnline}
  class:cursor-not-allowed={!serverOnline}
  onclick={handleGoogleLogin}
  disabled={!serverOnline}
>
  <span class="bg-white p-1 rounded mr-2">
    <img
      src="/auth-providers-icons/google.svg"
      alt={i18n.texts.auth.googleAlt}
      class="w-6 h-6"
    />
  </span>
  {i18n.texts.auth.continueWithGoogle}
</button>

<button
  type="button"
  class="btn bg-black text-white flex w-full mb-4"
  class:opacity-50={!serverOnline}
  class:cursor-not-allowed={!serverOnline}
  onclick={handleGithubLogin}
  disabled={!serverOnline}
>
  <span class="bg-white p-1 rounded mr-2">
    <img
      src="/auth-providers-icons/github.svg"
      alt={i18n.texts.auth.githubAlt}
      class="w-6 h-6"
    />
  </span>
  {i18n.texts.auth.continueWithGithubComingSoon}
</button>

<button
  type="button"
  class="btn bg-black text-white flex w-full mb-4"
  class:opacity-50={!serverOnline}
  class:cursor-not-allowed={!serverOnline}
  onclick={handleXLogin}
  disabled={!serverOnline}
>
  <span class="bg-black p-1 rounded mr-2">
    <img src="/auth-providers-icons/x.svg" alt={i18n.texts.auth.xAlt} class="w-6 h-6" />
  </span>
  {i18n.texts.auth.continueWithXComingSoon}
</button>
