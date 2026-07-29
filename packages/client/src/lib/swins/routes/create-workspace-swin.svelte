<script lang="ts">
	import { useWorkspaceUi } from '../../workspace-ui-context';

	const workspaceUi = useWorkspaceUi();
	const presets = ['Personal', 'Work', 'Studies'];
	let name = $state('Personal');
	let creating = $state(false);
	let errorMessage = $state('');

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		if (creating || !name.trim()) return;
		creating = true;
		errorMessage = '';
		try {
			await workspaceUi.createWorkspace(name.trim());
			workspaceUi.swins.clear();
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Could not create the workspace.';
		} finally {
			creating = false;
		}
	}
</script>

<div class="space-y-4">
	<h3 class="text-lg font-semibold">Create workspace</h3>
	<form class="space-y-4" onsubmit={submit}>
		<div class="form-control">
			<label class="label" for="workspace-name">
				<span class="label-text">Workspace name</span>
			</label>
			<input
				id="workspace-name"
				class="input {errorMessage ? 'input-error' : ''}"
				type="text"
				maxlength="100"
				autocomplete="off"
				disabled={creating}
				bind:value={name}
				oninput={() => (errorMessage = '')}
			/>
			{#if errorMessage}
				<p class="mt-2 text-sm text-error-500">{errorMessage}</p>
			{/if}
		</div>

		<div>
			<p class="mb-2">
				A workspace holds your conversations, files, and agents. Choose a simple name for its
				purpose.
			</p>
			<div class="flex flex-wrap gap-2">
				{#each presets as preset}
					<button
						type="button"
						class="btn btn-sm preset-outlined"
						class:preset-filled={name === preset}
						disabled={creating}
						onclick={() => (name = preset)}
					>
						{preset}
					</button>
				{/each}
			</div>
		</div>

		<div class="flex flex-wrap items-center justify-between gap-3">
			<button
				type="button"
				class="btn preset-ghost"
				disabled={creating}
				onclick={() => workspaceUi.swins.pop()}
			>
				Cancel
			</button>
			<button
				type="submit"
				class="btn preset-filled-primary-500"
				disabled={creating || !name.trim()}
			>
				{creating ? 'Creating…' : 'Create workspace'}
			</button>
		</div>
	</form>
</div>
