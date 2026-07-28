<script lang="ts">
	import '../compiled-style.css';
	import { authClient } from '../auth-client';
	import AuthScreen from './AuthScreen.svelte';
	import WorkspaceApp from './WorkspaceApp.svelte';

	const session = authClient.useSession();
</script>

{#if $session.isPending}
	<main class="flex min-h-screen items-center justify-center bg-surface-50-950 text-surface-500">
		Connecting to Heswe…
	</main>
{:else if $session.data?.user}
	<WorkspaceApp user={$session.data.user} />
{:else}
	<AuthScreen />
{/if}
