<script lang="ts">
	import ExternalLink from 'lucide-svelte/icons/external-link';
	import XCircle from 'lucide-svelte/icons/circle-x';
	import Cpu from 'lucide-svelte/icons/cpu';
	import type { WorkspaceProviderSetting } from '../api-client';

	let {
		provider,
		busy = false,
		onConnect,
		onDisconnect
	}: {
		provider: WorkspaceProviderSetting;
		busy?: boolean;
		onConnect: (providerId: string, apiKey: string) => Promise<boolean>;
		onDisconnect: (providerId: string) => Promise<boolean>;
	} = $props();

	let editing = $state(false);
	let apiKey = $state('');

	const configured = $derived(provider.apiKeySource !== 'none');
	const presentation: ProviderPresentation = $derived(PRESENTATION[provider.id] ?? {});

	async function connect(event: SubmitEvent) {
		event.preventDefault();
		const key = apiKey.trim();
		if (!key || busy) return;
		if (await onConnect(provider.id, key)) {
			apiKey = '';
			editing = false;
		}
	}
</script>

<div class="provider-row">
	<div class="provider-logo bg-white">
		{#if presentation.logoUrl}
			<img src={presentation.logoUrl} alt="" width="22" height="22" />
		{:else}
			<Cpu size={22} class="text-surface-900" />
		{/if}
	</div>

	<div class="provider-body">
		<div class="provider-name">
			<span class="font-medium">{provider.name}</span>
			{#if presentation.url}
				<a
					href={presentation.url}
					target="_blank"
					rel="noreferrer"
					class="text-surface-500 transition-colors hover:text-surface-700"
					title={`Visit ${provider.name}`}
				>
					<ExternalLink size={14} />
				</a>
			{/if}

			{#if configured}
				<span class="badge badge-sm preset-filled-success-500">Connected</span>
			{:else if provider.local}
				<span class="badge badge-sm preset-tonal">{provider.id === 'mock' ? 'Built-in' : 'Local'}</span>
			{/if}
		</div>
		{#if provider.id === 'mock'}
			<span class="text-xs text-surface-600-400">10 predictable replies. No API key.</span>
		{/if}

		{#if editing}
			<form class="provider-connect-form" onsubmit={connect}>
				<input
					class="input min-w-0 max-w-sm flex-1"
					type="password"
					aria-label={`${provider.name} API key`}
					autocomplete="new-password"
					placeholder={`${provider.name} API key`}
					disabled={busy}
					bind:value={apiKey}
				/>
				<button
					type="submit"
					class="btn btn-sm preset-filled-primary-500"
					disabled={busy || !apiKey.trim()}
				>
					{busy ? 'Saving…' : 'Connect'}
				</button>
				<button
					type="button"
					class="chrome-icon-button"
					aria-label={`Cancel connecting ${provider.name}`}
					disabled={busy}
					onclick={() => {
						apiKey = '';
						editing = false;
					}}
				>
					<XCircle size={18} />
				</button>
			</form>
		{:else if provider.apiKeySource === 'workspace'}
			<button
				type="button"
				class="btn btn-sm preset-outlined-surface-500"
				disabled={busy}
				onclick={() => onDisconnect(provider.id)}
			>
				{busy ? 'Saving…' : 'Disconnect'}
			</button>
		{:else if provider.apiKeySource === 'server'}
			<button
				type="button"
				class="btn btn-sm preset-outlined-surface-500"
				disabled={busy}
				onclick={() => (editing = true)}
			>
				Override
			</button>
		{:else if !provider.local}
			<div class="provider-actions">
				<button
					type="button"
					class="btn btn-sm preset-outlined-surface-500"
					disabled={busy}
					onclick={() => (editing = true)}
				>
					Connect
				</button>
				{#if presentation.setupUrl}
					<a
						href={presentation.setupUrl}
						target="_blank"
						rel="noreferrer"
						class="provider-help"
						aria-label={`Get ${provider.name} API key`}
					>
						Get key
					</a>
				{/if}
			</div>
		{/if}
	</div>
</div>

<script lang="ts" module>
	type ProviderPresentation = {
		logoUrl?: string;
		url?: string;
		setupUrl?: string;
	};

	const PRESENTATION: Record<string, ProviderPresentation> = {
		openrouter: {
			logoUrl: new URL('../assets/providers/openrouter.png', import.meta.url).href,
			url: 'https://openrouter.ai/',
			setupUrl: 'https://openrouter.ai/settings/keys'
		},
		openai: {
			logoUrl: new URL('../assets/providers/openai.png', import.meta.url).href,
			url: 'https://openai.com/',
			setupUrl: 'https://platform.openai.com/api-keys'
		},
		anthropic: {
			logoUrl: new URL('../assets/providers/anthropic.png', import.meta.url).href,
			url: 'https://anthropic.com/',
			setupUrl: 'https://console.anthropic.com/settings/keys'
		},
		google: {
			logoUrl: new URL('../assets/providers/google.png', import.meta.url).href,
			url: 'https://gemini.google.com/',
			setupUrl: 'https://aistudio.google.com/app/apikey'
		},
		kimi: {
			logoUrl: new URL('../assets/providers/kimi.svg', import.meta.url).href,
			url: 'https://platform.moonshot.ai/',
			setupUrl: 'https://platform.moonshot.ai/console/api-keys'
		},
		xai: {
			logoUrl: new URL('../assets/providers/xai.png', import.meta.url).href,
			url: 'https://x.ai/',
			setupUrl: 'https://console.x.ai/'
		},
		deepseek: {
			logoUrl: new URL('../assets/providers/deepseek.png', import.meta.url).href,
			url: 'https://deepseek.com/',
			setupUrl: 'https://platform.deepseek.com/api_keys'
		},
		groq: {
			logoUrl: new URL('../assets/providers/groq.png', import.meta.url).href,
			url: 'https://groq.com/',
			setupUrl: 'https://console.groq.com/keys'
		},
		cohere: {
			logoUrl: new URL('../assets/providers/cohere.png', import.meta.url).href,
			url: 'https://cohere.com/',
			setupUrl: 'https://dashboard.cohere.com/api-keys'
		},
		mistral: {
			logoUrl: new URL('../assets/providers/mistral.png', import.meta.url).href,
			url: 'https://mistral.ai/',
			setupUrl: 'https://console.mistral.ai/api-keys'
		},
		ollama: {
			logoUrl: new URL('../assets/providers/ollama.png', import.meta.url).href,
			url: 'https://ollama.com/',
			setupUrl: 'https://ollama.com/download'
		},
		falai: {
			logoUrl: new URL('../assets/providers/falai.png', import.meta.url).href,
			url: 'https://fal.ai/',
			setupUrl: 'https://fal.ai/dashboard/keys'
		},
		exa: {
			logoUrl: new URL('../assets/providers/exa.png', import.meta.url).href,
			url: 'https://exa.ai/',
			setupUrl: 'https://dashboard.exa.ai/api-keys'
		}
	};
</script>
