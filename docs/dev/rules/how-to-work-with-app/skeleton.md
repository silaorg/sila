# Skeleton

The app uses Skeleton with SvelteKit and Tailwind.

Current setup lives in:

- `packages/app/src/routes/layout.css`
- `packages/app/src/app.html`

Rules for writing UI:

- use Skeleton color tokens for surfaces, borders, and text instead of raw Tailwind colors when possible
- prefer paired tokens like `bg-surface-50-950`, `border-surface-200-800`, and `text-surface-900-50`
- layout, spacing, sizing, and typography can still use normal Tailwind utilities like `flex`, `grid`, `gap-*`, `p-*`, and `text-*`
- keep the theme imports in `layout.css`
- set the active theme with `data-theme` in `app.html`

Examples:

```svelte
<div class="rounded-2xl border border-surface-200-800 bg-surface-50-950 text-surface-900-50">
	Content
</div>
```

Avoid:

- `bg-slate-900`
- `text-zinc-100`
- mixing random raw Tailwind colors into Skeleton surfaces unless there is a clear reason

When unsure:

- copy patterns from existing frontend files in `packages/app`
- check the Skeleton docs
- use the Skeleton Svelte reference: https://www.skeleton.dev/llms-svelte.txt
