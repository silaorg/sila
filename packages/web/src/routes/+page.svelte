<script lang="ts">
	import { onMount } from "svelte";
	import { ClientState, SilaApp, type ClientStateConfig } from "@sila/client";
	import { API_BASE_URL, fetchSpaces } from "@sila/client/utils/api";

	const clientState = new ClientState();
	const config: ClientStateConfig = {
		initState: clientState,
	};

	let email = $state("");
	let loginError = $state<string | null>(null);
	let isLoggingIn = $state(false);
	let isReady = $state(false);
	let didAutoConnect = $state(false);

	function normalizeEmail(value: string): string {
		return value.trim().toLowerCase();
	}

	async function connectFirstSpace(): Promise<void> {
		await fetchSpaces(clientState);
		if (clientState.pointers.length > 0) {
			await clientState.switchToSpace(clientState.pointers[0].uri);
		}
	}

	async function loginWithEmail(): Promise<void> {
		if (isLoggingIn) return;

		loginError = null;
		isLoggingIn = true;

		try {
			const response = await fetch(`${API_BASE_URL}/dev-only/users`);
			if (!response.ok) {
				throw new Error(`Failed to load users: ${response.status}`);
			}
			const data = await response.json();
			const targetEmail = normalizeEmail(email);
			const existing = (data?.users || []).find(
				(user: { email?: string }) =>
					normalizeEmail(user.email || "") === targetEmail,
			);

			if (!existing?.id) {
				throw new Error("Email not found on server.");
			}

			const token = existing.id;
			const user = existing;
			if (!token || !user?.id) {
				throw new Error("Invalid auth response.");
			}

			await clientState.auth.setAuth(
				{
					access_token: token,
					refresh_token: token,
					expires_in: 7 * 24 * 60 * 60,
				},
				{
					id: user.id,
					email: user.email,
					name: user.email,
				},
			);

			await connectFirstSpace();
		} catch (error) {
			loginError = error instanceof Error ? error.message : "Login failed.";
		} finally {
			isLoggingIn = false;
		}
	}

	function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		loginWithEmail();
	}

	$effect(() => {
		isReady = !clientState.isInitializing;
	});

	$effect(() => {
		if (!isReady || didAutoConnect) return;
		if (clientState.auth.isAuthenticated) {
			didAutoConnect = true;
			connectFirstSpace().catch(console.error);
		}
	});

	onMount(() => {
		isReady = true;
	});
</script>

{#if isReady && !clientState.auth.isAuthenticated}
	<div class="min-h-screen bg-surface-50-950 text-surface-900-50">
		<div class="mx-auto flex max-w-xl flex-col gap-6 px-6 py-20">
			<div class="rounded-2xl border border-surface-200-800 bg-surface-50-950 p-8 shadow-lg">
				<h1 class="text-2xl font-semibold">Sign in (dev)</h1>
				<p class="mt-2 text-sm text-surface-600-400">
					Enter a known email from the dev-only server users list.
				</p>

				<form class="mt-6 flex flex-col gap-4" onsubmit={handleSubmit}>
					<label class="text-sm font-medium text-surface-700-300" for="email">
						Email
					</label>
					<input
						id="email"
						class="w-full rounded-lg border border-surface-200-800 bg-surface-50-950 px-3 py-2 text-surface-900-50"
						type="email"
						placeholder="you@example.com"
						bind:value={email}
						required
					/>

					<button
						class="rounded-lg preset-filled-primary-500 px-4 py-2"
						type="submit"
						disabled={isLoggingIn}
					>
						{isLoggingIn ? "Signing in..." : "Sign in"}
					</button>

					{#if loginError}
						<p class="text-sm text-error-500">{loginError}</p>
					{/if}
				</form>
			</div>
		</div>
	</div>
{:else}
	<SilaApp {config} state={clientState} />
{/if}
