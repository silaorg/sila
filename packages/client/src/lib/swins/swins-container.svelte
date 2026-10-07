<script lang="ts">
	import ChevronLeft from 'lucide-svelte/icons/chevron-left';
	import X from 'lucide-svelte/icons/x';
	import { tick } from 'svelte';
	import { useWorkspaceUi } from '../workspace-ui-context';

	const workspaceUi = useWorkspaceUi();
	const swins = $derived(workspaceUi.swins);
	let layer: HTMLDivElement | undefined = $state();

	$effect(() => {
		const id = swins.current?.id;
		if (!id) return;
		const previousFocus = document.activeElement;
		void tick().then(() => {
			if (swins.current?.id === id) {
				layer?.querySelector<HTMLElement>('[role="dialog"]:not(.hidden)')?.focus();
			}
		});
		return () => {
			void tick().then(() => {
				if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
			});
		};
	});

	function closeAll() {
		swins.clear();
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.defaultPrevented || event.key !== 'Escape' || swins.windows.length === 0 || workspaceUi.assetViewer.activeFile) return;
		event.preventDefault();
		swins.pop();
	}

	function trapFocus(event: KeyboardEvent) {
		if (event.key !== 'Tab') return;
		const dialog = event.currentTarget as HTMLElement;
		const controls = Array.from(dialog.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]'))
			.filter((element) => element.getClientRects().length > 0);
		const first = controls[0];
		const last = controls.at(-1);
		if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
			event.preventDefault();
			last?.focus();
		} else if (!event.shiftKey && document.activeElement === last) {
			event.preventDefault();
			first?.focus();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if swins.windows.length > 0}
	<div class="swins-layer" bind:this={layer} inert={Boolean(workspaceUi.assetViewer.activeFile)}>
		<button
			type="button"
			class="app-backdrop"
			class:opacity-0={!swins.overlayEnabled}
			aria-label="Close windows"
			onclick={closeAll}
		></button>

		{#each swins.windows as window, index (window.id)}
			{@const entry = swins.componentRegistry[window.componentId]}
			<div
				class="swins-window"
				class:settings-window={window.componentId === 'settings'}
				class:hidden={index !== swins.windows.length - 1}
				role="dialog"
				aria-modal="true"
				aria-label={window.title ?? window.componentId}
				tabindex="-1"
				onkeydown={trapFocus}
			>
				{#if entry}
					<header class="swins-header">
						<div class="w-9">
							{#if index > 0}
								<button
									type="button"
									class="chrome-icon-button"
									aria-label="Go back"
									onclick={() => swins.pop()}
								>
									<ChevronLeft size={18} />
								</button>
							{/if}
						</div>

						<ol class="flex min-w-0 flex-1 items-center justify-center gap-3 text-[13px] font-semibold">
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
								class="chrome-icon-button"
								aria-label="Close all"
								onclick={closeAll}
							>
								<X size={18} />
							</button>
						</div>
					</header>

					<div class="swins-content">
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
