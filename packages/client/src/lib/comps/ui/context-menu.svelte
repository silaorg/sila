<script lang="ts">
	import { Popover } from '@skeletonlabs/skeleton-svelte';
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';
	import { TargetVisibilityMonitor } from '../../utils/visibility-monitor';

	let {
		open = false,
		onOpenChange,
		placement = 'bottom',
		zIndex = '50',
		closeOnInteractOutside = true,
		closeOnEscape = true,
		triggerClassNames = '',
		maxWidth = '320px',
		content,
		trigger,
		arrow = true,
		onTargetHidden
	}: {
		open: boolean;
		onOpenChange: (event: { open: boolean }) => void;
		placement?: 'top' | 'right' | 'bottom' | 'left';
		zIndex?: string;
		closeOnInteractOutside?: boolean;
		closeOnEscape?: boolean;
		triggerClassNames?: string;
		maxWidth?: string;
		content: Snippet<[]>;
		trigger: Snippet<[HTMLButtonAttributes]>;
		arrow?: boolean;
		onTargetHidden?: () => void;
	} = $props();

	let wrapperElement: HTMLElement;
	let visibilityMonitor: TargetVisibilityMonitor | null = null;

	function findTriggerElement() {
		const candidate = wrapperElement?.querySelector(
			'[data-popover-trigger], [role="button"], button'
		);
		if (candidate instanceof HTMLElement) return candidate;
		const firstChild = wrapperElement?.firstElementChild;
		return firstChild instanceof HTMLElement ? firstChild : null;
	}

	$effect(() => {
		if (open) {
			const triggerElement = findTriggerElement();
			if (triggerElement) {
				visibilityMonitor = new TargetVisibilityMonitor(triggerElement, () => {
					onOpenChange({ open: false });
					onTargetHidden?.();
				});
				visibilityMonitor.start();
			}
		} else {
			visibilityMonitor?.stop();
			visibilityMonitor = null;
		}

		return () => visibilityMonitor?.stop();
	});
</script>

<div bind:this={wrapperElement}>
	<Popover
		{open}
		{onOpenChange}
		positioning={{ placement }}
		{closeOnInteractOutside}
		{closeOnEscape}
	>
		<Popover.Trigger element={trigger} class={triggerClassNames} />
		<Popover.Positioner style={`z-index: ${zIndex}`}>
			<Popover.Content
				class="context-menu card space-y-2 border border-surface-100-900 bg-surface-50-950 p-2 shadow-lg"
				style={`max-width: ${maxWidth}`}
			>
				{@render content()}
				{#if arrow}
					<Popover.Arrow class="bg-surface-50-950">
						<Popover.ArrowTip class="bg-surface-50-950" />
					</Popover.Arrow>
				{/if}
			</Popover.Content>
		</Popover.Positioner>
	</Popover>
</div>
