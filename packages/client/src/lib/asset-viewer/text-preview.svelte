<script lang="ts">
	let { url, size }: { url: string; size: number } = $props();
	let text = $state('');
	let errorMessage = $state('');
	let loading = $state(true);

	$effect(() => {
		text = '';
		errorMessage = '';
		loading = true;
		if (size > 2 * 1024 * 1024) {
			errorMessage = 'This file is too large to preview.';
			loading = false;
			return;
		}

		const controller = new AbortController();
		void fetch(url, { signal: controller.signal })
			.then((response) => {
				if (!response.ok) throw new Error(`Preview failed with HTTP ${response.status}.`);
				return response.text();
			})
			.then((value) => {
				if (!controller.signal.aborted) text = value;
			})
			.catch((error) => {
				if (!controller.signal.aborted) {
					errorMessage = error instanceof Error ? error.message : 'Could not preview file.';
				}
			})
			.finally(() => {
				if (!controller.signal.aborted) loading = false;
			});
		return () => controller.abort();
	});
</script>

{#if errorMessage}
	<p class="text-sm text-surface-500">{errorMessage}</p>
{:else if loading}
	<p class="text-sm text-surface-500" role="status">Loading preview…</p>
{:else}
	<pre class="whitespace-pre-wrap break-words font-mono text-sm">{text}</pre>
{/if}
