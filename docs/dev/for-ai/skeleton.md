# Skeleton usage (AI)

- Use Skeleton tokens, not Tailwind colors, for backgrounds, text, borders, and surfaces. Example: `class="bg-surface-900 text-surface-50 border-surface-600"`. Prefer `preset-*` helpers (e.g., `preset-filled-primary-500`) for buttons/cards when they fit.
- Default to color pairings (light/dark) when possible: `bg-surface-50-950`, `border-surface-200-800`, `text-surface-900-50`, `preset-filled-primary-500`. Single-shade tokens are fine only when a pairing is impossible or not provided.
- Layout/spacing/typography can use the Tailwind utilities that Skeleton ships with (`flex`, `grid`, `gap-*`, `p-*`, `text-*`). The rule is only about color: use Skeleton tokens, no raw Tailwind colors like `bg-slate-500`.
- Import icons from `lucide-svelte`; render like `<Check size={14} />`.
- When unsure, open `packages/client/src/lib` components and copy their Skeleton class patterns. Keep Tailwind raw colors out of new code.
- Full reference: https://skeleton.dev/llms-svelte.txt
