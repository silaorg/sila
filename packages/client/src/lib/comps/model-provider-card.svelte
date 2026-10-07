<script lang="ts">
	import ExternalLink from 'lucide-svelte/icons/external-link';
	import XCircle from 'lucide-svelte/icons/circle-x';
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
	const presentation = $derived(getProviderPresentation(provider.id));
	const providerName = $derived(presentation.name ?? provider.name);

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

<div
	class="provider-row"
>
	<div class="provider-logo bg-white">
		<img class="max-h-full max-w-full p-2" src={presentation.logoUrl} alt={providerName} />
	</div>

	<div class="provider-body">
		<div class="provider-name">
			<span class="font-medium">{providerName}</span>
			<a
				href={presentation.url}
				target="_blank"
				rel="noreferrer"
				class="text-surface-500 transition-colors hover:text-surface-700"
				title={`Visit ${providerName}`}
			>
				<ExternalLink size={14} />
			</a>

			{#if configured}
				<span class="badge badge-sm preset-filled-success-500">Connected</span>
			{:else if provider.local}
				<span class="badge badge-sm preset-tonal">Local</span>
			{/if}
		</div>

		{#if editing}
			<form class="provider-connect-form" onsubmit={connect}>
				<input
					class="input min-w-0 max-w-sm flex-1"
					type="password"
					aria-label={`${providerName} API key`}
					autocomplete="new-password"
					placeholder={`${providerName} API key`}
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
					class="p-1"
					aria-label={`Cancel connecting ${providerName}`}
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
					class="btn btn-sm border border-surface-200-800 hover:preset-tonal"
					disabled={busy}
					onclick={() => (editing = true)}
				>
					Connect
				</button>
				<a
					href={presentation.setupUrl}
					target="_blank"
					rel="noreferrer"
					class="provider-help"
					aria-label={`Get ${providerName} API key`}
				>
					Get key
				</a>
			</div>
		{/if}
	</div>
</div>

<script lang="ts" module>
	type ProviderPresentation = {
		name?: string;
		logoUrl: string;
		url: string;
		setupUrl: string;
	};

	const PRESENTATION: Record<string, ProviderPresentation> = {
		openrouter: {
			logoUrl: '/providers/openrouter.png',
			url: 'https://openrouter.ai/',
			setupUrl: 'https://openrouter.ai/settings/keys'
		},
		openai: {
			logoUrl: '/providers/openai.png',
			url: 'https://openai.com/',
			setupUrl: 'https://platform.openai.com/api-keys'
		},
		anthropic: {
			logoUrl: '/providers/anthropic.png',
			url: 'https://anthropic.com/',
			setupUrl: 'https://console.anthropic.com/settings/keys'
		},
		google: {
			name: 'Google Gemini',
			logoUrl: '/providers/google.png',
			url: 'https://gemini.google.com/',
			setupUrl: 'https://aistudio.google.com/app/apikey'
		},
		kimi: {
			logoUrl: '/providers/kimi.svg',
			url: 'https://platform.moonshot.ai/',
			setupUrl: 'https://platform.moonshot.ai/console/api-keys'
		},
		xai: {
			logoUrl: '/providers/xai.png',
			url: 'https://x.ai/',
			setupUrl: 'https://console.x.ai/'
		},
		deepseek: {
			logoUrl: '/providers/deepseek.png',
			url: 'https://deepseek.com/',
			setupUrl: 'https://platform.deepseek.com/api_keys'
		},
		groq: {
			logoUrl: '/providers/groq.png',
			url: 'https://groq.com/',
			setupUrl: 'https://console.groq.com/keys'
		},
		cohere: {
			logoUrl: '/providers/cohere.png',
			url: 'https://cohere.com/',
			setupUrl: 'https://dashboard.cohere.com/api-keys'
		},
		mistral: {
			logoUrl: '/providers/mistral.png',
			url: 'https://mistral.ai/',
			setupUrl: 'https://console.mistral.ai/api-keys'
		},
		ollama: {
			logoUrl: '/providers/ollama.png',
			url: 'https://ollama.com/',
			setupUrl: 'https://ollama.com/download'
		},
		falai: {
			name: 'Fal.ai',
			logoUrl: '/providers/falai.png',
			url: 'https://fal.ai/',
			setupUrl: 'https://fal.ai/dashboard/keys'
		},
		exa: {
			logoUrl: '/providers/exa.png',
			url: 'https://exa.ai/',
			setupUrl: 'https://dashboard.exa.ai/api-keys'
		}
	};

	function getProviderPresentation(providerId: string) {
		return (
			PRESENTATION[providerId] ?? {
				logoUrl: '/providers/openai-like.png',
				url: '#',
				setupUrl: '#'
			}
		);
	}
</script>
