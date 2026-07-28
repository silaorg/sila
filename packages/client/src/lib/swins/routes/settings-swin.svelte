<script lang="ts">
	import Check from 'lucide-svelte/icons/check';
	import {
		getWorkspaceModelSettings,
		updateWorkspaceModelSettings,
		type WorkspaceModelSettings
	} from '../../api-client';
	import ModelProviderCard from '../../comps/model-provider-card.svelte';
	import SettingsSidebar from '../../comps/settings-sidebar.svelte';
	import { useWorkspaceUi } from '../../workspace-ui-context';

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
	const languageProviders = $derived(
		settings?.providers.filter((item) => item.kind === 'language') ?? []
	);
	const providers = $derived(settings?.providers ?? []);

	$effect(() => {
		const workspaceId = workspaceUi.currentWorkspaceId;
		if (workspaceId) void load(workspaceId);
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

	async function savePreferences(event: SubmitEvent) {
		event.preventDefault();
		const workspaceId = workspaceUi.currentWorkspaceId;
		if (!workspaceId || busy) return;
		savingPreferences = true;
		saved = false;
		errorMessage = '';
		try {
			applySettings(await updateWorkspaceModelSettings(workspaceId, {
				provider,
				model: provider === 'auto' ? 'auto' : model.trim(),
				apiKeys: {}
			}));
			saved = true;
		} catch (error) {
			setError(error);
		} finally {
			savingPreferences = false;
		}
	}

	async function updateProviderKey(providerId: string, apiKey: string | null) {
		const workspaceId = workspaceUi.currentWorkspaceId;
		if (!workspaceId || busy) return false;
		savingProviderId = providerId;
		errorMessage = '';
		try {
			applySettings(await updateWorkspaceModelSettings(workspaceId, {
				provider,
				model,
				apiKeys: { [providerId]: apiKey }
			}));
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

<div class="flex w-full gap-4">
	<SettingsSidebar
		active={activePage}
		onSelect={(page) => {
			activePage = page;
			errorMessage = '';
			saved = false;
		}}
	/>

	<div class="min-h-72 flex-1 space-y-4">
		{#if loading}
			<p class="py-10 text-center text-sm text-surface-500">Loading settings…</p>
		{:else if settings && activePage === 'providers'}
			<p class="text-sm">Connect AI model providers to power your assistants.</p>
			<p class="text-xs text-surface-500">
				Keys stay in this workspace and are never returned to the browser.
			</p>
			<div class="grid grid-cols-1 gap-2">
				{#each providers as item (item.id)}
					<ModelProviderCard
						provider={item}
						busy={savingProviderId === item.id}
						onConnect={(id, key) => updateProviderKey(id, key)}
						onDisconnect={(id) => updateProviderKey(id, null)}
					/>
				{/each}
			</div>
		{:else if settings}
			<form class="space-y-4" onsubmit={savePreferences}>
				<p class="text-sm">Choose the default language model for new agent sessions.</p>
				<label class="label">
					<span>Provider</span>
					<select
						class="select"
						value={provider}
						disabled={busy}
						onchange={(event) => {
							provider = event.currentTarget.value;
							if (provider === 'auto') model = 'auto';
							else {
								const selected = languageProviders.find((item) => item.id === provider);
								model = selected?.model ?? selected?.defaultModel ?? '';
							}
						}}
					>
						<option value="auto">Automatic</option>
						{#each languageProviders as item (item.id)}
							<option value={item.id}>{item.name}</option>
						{/each}
					</select>
				</label>
				<label class="label">
					<span>Model</span>
					<input
						class="input"
						disabled={busy || provider === 'auto'}
						bind:value={model}
						oninput={() => (saved = false)}
					/>
				</label>
				<div class="flex items-center justify-between">
					<span class="flex items-center gap-2 text-sm text-success-500">
						{#if saved}<Check size={16} /> Saved{/if}
					</span>
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
			<p class="rounded bg-error-100-900 px-3 py-2 text-sm text-error-500" role="alert">
				{errorMessage}
			</p>
		{/if}
	</div>
</div>
