<script lang="ts">
	import ChevronLeft from 'lucide-svelte/icons/chevron-left';
	import X from 'lucide-svelte/icons/x';
	import { useWorkspaceUi } from '../workspace-ui-context';

	const workspaceUi = useWorkspaceUi();
	const swins = $derived(workspaceUi.swins);

	function closeAll() {
		swins.clear();
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key !== 'Escape' || swins.windows.length === 0) return;
		event.preventDefault();
		swins.pop();
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if swins.windows.length > 0}
	<div class="fixed inset-0 z-50 flex flex-col items-center overflow-y-auto p-4 pb-20 pt-20">
		<button
			type="button"
			class="absolute inset-0 size-full cursor-auto bg-surface-50/80 transition-opacity dark:bg-surface-950/80"
			class:opacity-0={!swins.overlayEnabled}
			aria-label="Close windows"
			onclick={closeAll}
		></button>

		{#each swins.windows as window, index (window.id)}
			{@const entry = swins.componentRegistry[window.componentId]}
			<div
				class="card relative flex max-h-[calc(100vh-10rem)] w-full max-w-[800px] flex-col overflow-hidden rounded-lg border border-surface-200-800 bg-surface-50-950 shadow-2xl"
				class:hidden={index !== swins.windows.length - 1}
				role="dialog"
				aria-modal="true"
				aria-label={window.title ?? window.componentId}
			>
				{#if entry}
					<header class="flex shrink-0 items-center justify-between p-2">
						<div class="w-9">
							{#if index > 0}
								<button
									type="button"
									class="rounded p-2 hover:preset-tonal"
									aria-label="Go back"
									onclick={() => swins.pop()}
								>
									<ChevronLeft size={18} />
								</button>
							{/if}
						</div>

						<ol class="flex flex-1 items-center justify-center gap-4 text-sm">
							{#each swins.windows.slice(0, index + 1) as breadcrumb, breadcrumbIndex}
								{#if breadcrumbIndex > 0}
									<li class="opacity-50" aria-hidden="true">&rsaquo;</li>
								{/if}
								<li>
									{#if breadcrumbIndex === index}
										{breadcrumb.title ?? breadcrumb.componentId}
									{:else}
										<button
											type="button"
											class="opacity-60 hover:underline"
											onclick={() => swins.popToWindow(breadcrumb.id)}
										>
											{breadcrumb.title ?? breadcrumb.componentId}
										</button>
									{/if}
								</li>
							{/each}
						</ol>

						<div class="w-9">
							<button
								type="button"
								class="rounded p-2 hover:preset-tonal"
								aria-label="Close all"
								onclick={closeAll}
							>
								<X size={18} />
							</button>
						</div>
					</header>

					<div class="min-h-0 flex-1 overflow-y-auto p-3 pt-0">
						<entry.component {...entry.defaultProps} {...window.props} />
					</div>
				{:else}
					<p class="p-3 text-center text-error-500">
						Component not found: {window.componentId}
					</p>
				{/if}
			</div>
		{/each}
	</div>
{/if}
