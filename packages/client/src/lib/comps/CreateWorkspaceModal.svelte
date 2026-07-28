<script lang="ts">
	import X from 'lucide-svelte/icons/x';

	let {
		onCreate,
		onClose
	}: {
		onCreate: (name: string) => Promise<void>;
		onClose: () => void;
	} = $props();

	const presets = ['Personal', 'Work', 'Studies'];
	let name = $state('Personal');
	let creating = $state(false);
	let errorMessage = $state('');

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		if (creating) return;
		const normalizedName = name.trim();
		if (!normalizedName) {
			errorMessage = 'Workspace name is required.';
			return;
		}

		creating = true;
		errorMessage = '';
		try {
			await onCreate(normalizedName);
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Could not create the workspace.';
		} finally {
			creating = false;
		}
	}
</script>

<svelte:window
	onkeydown={(event) => {
		if (event.key === 'Escape' && !creating) onClose();
	}}
/>

<div class="fixed inset-0 z-50 flex items-center justify-center p-4">
	<button
		type="button"
		class="absolute inset-0 bg-black/50"
		aria-label="Close create workspace"
		disabled={creating}
		onclick={onClose}
	></button>

	<div
		class="relative w-full max-w-lg rounded-xl border border-surface-100-900 bg-surface-50-950 p-6 shadow-xl"
		role="dialog"
		aria-modal="true"
		aria-labelledby="create-workspace-title"
	>
		<div class="flex items-start justify-between gap-4">
			<div>
				<h2 id="create-workspace-title" class="text-lg font-semibold">Create workspace</h2>
				<p class="mt-1 text-sm text-surface-500">
					Workspaces keep their threads, files, skills, and tools separate.
				</p>
			</div>
			<button
				type="button"
				class="btn-icon preset-tonal shrink-0"
				aria-label="Close"
				disabled={creating}
				onclick={onClose}
			><X size={18} /></button>
		</div>

		<form class="mt-5 space-y-4" onsubmit={submit}>
			<label class="form-control block">
				<span class="label-text">Workspace name</span>
				<input
					class="input mt-2 w-full"
					type="text"
					placeholder="My workspace"
					maxlength="100"
					autocomplete="off"
					disabled={creating}
					bind:value={name}
					oninput={() => (errorMessage = '')}
				/>
			</label>

			<div>
				<p class="text-sm">Choose a simple name that describes its purpose.</p>
				<div class="mt-2 flex flex-wrap gap-2">
					{#each presets as preset}
						<button
							type="button"
							class={[
								'btn btn-sm',
								name === preset ? 'preset-filled' : 'preset-outlined'
							]}
							disabled={creating}
							onclick={() => (name = preset)}
						>
							{preset}
						</button>
					{/each}
				</div>
			</div>

			{#if errorMessage}
				<p class="text-sm text-error-500" role="alert">
					{errorMessage}
				</p>
			{/if}

			<div class="flex flex-wrap items-center justify-between gap-3 pt-2">
				<button
					type="button"
					class="btn preset-ghost"
					disabled={creating}
					onclick={onClose}
				>
					Cancel
				</button>
				<div class="flex items-center gap-3">
					<button
						type="submit"
						class="btn preset-filled-primary-500"
						disabled={creating || !name.trim()}
					>
						{creating ? 'Creating…' : 'Create workspace'}
					</button>
				</div>
			</div>
		</form>
	</div>
</div>
