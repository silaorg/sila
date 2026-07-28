<script lang="ts">
	import Check from 'lucide-svelte/icons/check';
	import X from 'lucide-svelte/icons/x';
	import {
		getWorkspaceModelSettings,
		updateWorkspaceModelSettings,
		type WorkspaceModelSettings
	} from '../api-client';
	import { useWorkspaceUi } from '../workspace-ui-context';
	import ModelProviderCard from './model-provider-card.svelte';
	import SettingsSidebar from './settings-sidebar.svelte';

	let { onClose }: { onClose: () => void } = $props();
	const workspaceUi = useWorkspaceUi();

	let settings = $state<WorkspaceModelSettings | null>(null);
	let activePage = $state<'preferences' | 'providers'>('providers');
	let provider = $state('auto');
	let model = $state('auto');
	let loading = $state(true);
	let savingPreferences = $state(false);
	let savingProviderId = $state<string | null>(null);
	let errorMessage = $state('');
	let saved = $state(false);
	let loadRequest = 0;

	const busy = $derived(savingPreferences || savingProviderId !== null);
	const title = $derived(activePage === 'providers' ? 'Model Providers' : 'Preferences');
	const languageProviders = $derived(
		settings?.providers.filter((item) => item.kind === 'language') ?? []
	);
	const providers = $derived.by(() => {
		if (!settings) return [];
		return [...settings.providers].sort(
			(left, right) => providerOrder(left.id) - providerOrder(right.id)
		);
	});

	$effect(() => {
		const workspaceId = workspaceUi.currentWorkspaceId;
		if (!workspaceId) {
			onClose();
			return;
		}
		void load(workspaceId);
	});

	async function load(workspaceId: string) {
		const request = ++loadRequest;
		loading = true;
		errorMessage = '';
		try {
			const loaded = await getWorkspaceModelSettings(workspaceId);
			if (request !== loadRequest || workspaceUi.currentWorkspaceId !== workspaceId) return;
			applySettings(loaded);
		} catch (error) {
			if (request === loadRequest) setError(error);
		} finally {
			if (request === loadRequest) loading = false;
		}
	}

	function applySettings(loaded: WorkspaceModelSettings) {
		settings = loaded;
		provider = loaded.provider;
		model = loaded.model;
	}

	function selectPage(page: 'preferences' | 'providers') {
		activePage = page;
		errorMessage = '';
		saved = false;
	}

	function selectProvider(event: Event) {
		const selectedProvider = (event.currentTarget as HTMLSelectElement).value;
		provider = selectedProvider;
		saved = false;
		if (selectedProvider === 'auto') {
			model = 'auto';
			return;
		}
		const selected = languageProviders.find((item) => item.id === selectedProvider);
		model = selected?.model ?? selected?.defaultModel ?? '';
	}

	async function savePreferences(event: SubmitEvent) {
		event.preventDefault();
		const workspaceId = workspaceUi.currentWorkspaceId;
		if (!workspaceId || busy) return;

		savingPreferences = true;
		saved = false;
		errorMessage = '';
		try {
			const updated = await updateWorkspaceModelSettings(workspaceId, {
				provider,
				model: provider === 'auto' ? 'auto' : model.trim(),
				apiKeys: {}
			});
			if (workspaceUi.currentWorkspaceId !== workspaceId) return;
			applySettings(updated);
			saved = true;
		} catch (error) {
			setError(error);
		} finally {
			savingPreferences = false;
		}
	}

	async function connectProvider(providerId: string, apiKey: string) {
		return updateProviderKey(providerId, apiKey);
	}

	async function disconnectProvider(providerId: string) {
		return updateProviderKey(providerId, null);
	}

	async function updateProviderKey(providerId: string, apiKey: string | null) {
		const workspaceId = workspaceUi.currentWorkspaceId;
		if (!workspaceId || busy) return false;

		savingProviderId = providerId;
		errorMessage = '';
		try {
			const updated = await updateWorkspaceModelSettings(workspaceId, {
				provider,
				model,
				apiKeys: { [providerId]: apiKey }
			});
			if (workspaceUi.currentWorkspaceId !== workspaceId) return false;
			applySettings(updated);
			return true;
		} catch (error) {
			setError(error);
			return false;
		} finally {
			savingProviderId = null;
		}
	}

	function setError(error: unknown) {
		errorMessage = error instanceof Error ? error.message : 'Could not save workspace settings.';
	}
</script>

<svelte:window
	onkeydown={(event) => {
		if (event.key === 'Escape' && !busy) onClose();
	}}
/>

<div class="fixed inset-0 z-50 flex items-center justify-center p-4">
	<button
		type="button"
		class="absolute inset-0 bg-surface-50/80 backdrop-blur-[1px] dark:bg-surface-950/80"
		aria-label="Close workspace settings"
		disabled={busy}
		onclick={onClose}
	></button>

	<div
		class="relative flex h-[min(48rem,calc(100vh-2rem))] w-[min(100rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl border border-surface-300-700 bg-surface-50-950 shadow-2xl"
		role="dialog"
		aria-modal="true"
		aria-labelledby="workspace-settings-title"
	>
		<header class="relative flex items-center justify-center px-6 py-5">
			<h2 id="workspace-settings-title" class="text-xl font-medium">{title}</h2>
			<button
				type="button"
				class="absolute right-6 rounded p-2 hover:preset-tonal"
				aria-label="Close settings"
				disabled={busy}
				onclick={onClose}
			>
				<X size={24} />
			</button>
		</header>

		<div class="flex min-h-0 w-full flex-1 gap-4 px-6 pb-6">
			<SettingsSidebar active={activePage} onSelect={selectPage} />

			<div class="min-h-0 flex-1 overflow-y-auto pr-2">
				{#if loading}
					<p class="py-10 text-center text-sm text-surface-500">Loading settings…</p>
				{:else if settings && activePage === 'providers'}
					<div class="space-y-4">
						<p class="text-sm">
							Connect AI model providers to power your assistants. We recommend setting up
							OpenAI, Anthropic, or Google first.
						</p>
						<p class="text-xs text-surface-500">
							Keys stay in this workspace and are never returned to the browser.
						</p>

						<div class="grid grid-cols-1 gap-2">
							{#each providers as item (item.id)}
								<ModelProviderCard
									provider={item}
									busy={savingProviderId === item.id}
									onConnect={connectProvider}
									onDisconnect={disconnectProvider}
								/>
							{/each}
						</div>
					</div>
				{:else if settings}
					<form class="max-w-3xl space-y-4" onsubmit={savePreferences}>
						<div>
							<h3 class="font-semibold">Default agent model</h3>
							<p class="mt-1 text-sm text-surface-500">
								New agent sessions use this provider and model.
							</p>
						</div>

						<div class="grid grid-cols-2 gap-4 rounded border border-surface-100-900 p-4">
							<label class="block">
								<span class="text-sm font-medium">Provider</span>
								<select
									class="select mt-2 w-full"
									value={provider}
									disabled={busy}
									onchange={selectProvider}
								>
									<option value="auto">Automatic</option>
									{#each languageProviders as item (item.id)}
										<option value={item.id}>{item.name}</option>
									{/each}
								</select>
							</label>
							<label class="block">
								<span class="text-sm font-medium">Model</span>
								<input
									class="input mt-2 w-full"
									type="text"
									placeholder="Provider default"
									disabled={busy || provider === 'auto'}
									bind:value={model}
									oninput={() => (saved = false)}
								/>
							</label>
						</div>

						<div class="flex items-center justify-between">
							<div class="flex items-center gap-2 text-sm text-success-500">
								{#if saved}
									<Check size={16} />
									Saved
								{/if}
							</div>
							<button
								type="submit"
								class="btn preset-filled-primary-500"
								disabled={busy || (provider !== 'auto' && !model.trim())}
							>
								{savingPreferences ? 'Saving…' : 'Save preferences'}
							</button>
						</div>
					</form>
				{/if}

				{#if errorMessage}
					<p class="mt-4 rounded bg-error-100-900 px-3 py-2 text-sm text-error-500" role="alert">
						{errorMessage}
					</p>
				{/if}
			</div>
		</div>
	</div>
</div>

<script lang="ts" module>
	const PROVIDER_ORDER = [
		'openrouter',
		'openai',
		'anthropic',
		'google',
		'kimi',
		'xai',
		'falai',
		'exa',
		'deepseek',
		'groq',
		'cohere',
		'mistral',
		'ollama'
	];

	function providerOrder(providerId: string) {
		const index = PROVIDER_ORDER.indexOf(providerId);
		return index === -1 ? PROVIDER_ORDER.length : index;
	}
</script>
