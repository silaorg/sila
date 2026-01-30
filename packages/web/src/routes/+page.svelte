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

	const ACCESS_TOKEN_COOKIE = "access_token";
	const REFRESH_TOKEN_COOKIE = "refresh_token";
	const USER_STORAGE_KEY = "user";

	function normalizeEmail(value: string): string {
		return value.trim().toLowerCase();
	}

	function getCookieValue(name: string): string | null {
		if (typeof document === "undefined") return null;
		const parts = document.cookie.split("; ");
		for (const part of parts) {
			const [key, value] = part.split("=");
			if (key === name) return decodeURIComponent(value || "");
		}
		return null;
	}

	function setCookieValue(name: string, value: string | null, days: number): void {
		if (typeof document === "undefined") return;
		const secure = typeof location !== "undefined" && location.protocol === "https:";
		if (!value) {
			document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; samesite=strict${
				secure ? "; secure" : ""
			}`;
			return;
		}

		const date = new Date();
		date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
		document.cookie = `${name}=${encodeURIComponent(value)}; expires=${date.toUTCString()}; path=/; samesite=strict${
			secure ? "; secure" : ""
		}`;
	}

	function getJwtExpirySeconds(token: string): number | null {
		try {
			const parts = token.split(".");
			if (parts.length !== 3) return null;
			const payload = JSON.parse(atob(parts[1]));
			return typeof payload?.exp === "number" ? payload.exp : null;
		} catch {
			return null;
		}
	}

	async function hydrateAuthFromCookies(): Promise<void> {
		if (typeof document === "undefined") return;
		if (clientState.auth.isAuthenticated) return;

		const accessToken = getCookieValue(ACCESS_TOKEN_COOKIE);
		const refreshToken = getCookieValue(REFRESH_TOKEN_COOKIE);
		const userJson = localStorage.getItem(USER_STORAGE_KEY);
		if (!accessToken || !userJson) return;

		const exp = getJwtExpirySeconds(accessToken);
		if (exp && exp * 1000 <= Date.now()) return;

		const user = JSON.parse(userJson);
		const expiresIn = exp ? Math.max(1, Math.floor((exp * 1000 - Date.now()) / 1000)) : 7 * 24 * 60 * 60;

		await clientState.auth.setAuth(
			{
				access_token: accessToken,
				refresh_token: refreshToken || accessToken,
				expires_in: expiresIn,
			},
			user,
		);
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
      const targetEmail = normalizeEmail(email);
			const response = await fetch(
				`${API_BASE_URL}/dev-only/users/by-email/${encodeURIComponent(targetEmail)}`,
			);
			if (!response.ok) {
				throw new Error(`Failed to get a user: ${response.status}`);
			}
			const data = await response.json();

			const user = data?.user;
			const token = data?.token;
			if (!user?.id || !token) {
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

			const cookieDays = 7;
			setCookieValue(ACCESS_TOKEN_COOKIE, token, cookieDays);
			setCookieValue(REFRESH_TOKEN_COOKIE, token, 30);
			localStorage.setItem(
				USER_STORAGE_KEY,
				JSON.stringify({ id: user.id, email: user.email, name: user.email }),
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
		hydrateAuthFromCookies().catch(console.error);
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
