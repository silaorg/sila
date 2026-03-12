# SvelteKit

The app uses Svelte 5 and SvelteKit 2.

Prefer current Svelte 5 patterns:

- use `$state(...)` for reactive local state
- use `$derived(...)` or `$derived.by(...)` for derived values
- use `$effect(...)` for effects
- use `$props()` for props
- use `onclick`, `oninput`, and other property-style event handlers, not `on:click`
- use `{@render children()}` instead of old slot patterns when a component accepts children

Examples:

```svelte
<script lang="ts">
	let count = $state(0);
	let doubled = $derived(count * 2);

	let { title = 'App' }: { title?: string } = $props();
</script>

<button onclick={() => count += 1}>
	{title}: {doubled}
</button>
```

Notes:

- top-level `let x = ...` is not reactive by itself in Svelte 5
- do not use `$props<T>()` for prop typing
- keep components small and easy to scan

For package-specific context, also check `packages/app/README.md`.
