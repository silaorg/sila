# Proposal: Minimal Skeleton-like CSS for Sila

## Goal
Build a smaller CSS foundation that keeps Sila's current look and behavior, but removes unused Skeleton CSS scope.

## Why now
Current usage is narrow, but current imports are broad.

- We import `@skeletonlabs/skeleton` and `@skeletonlabs/skeleton/optional/presets` in `/Users/dk/repos/sila/packages/client/src/app.css`.
- We import 22 Skeleton themes in `/Users/dk/repos/sila/packages/client/src/app.css`.
- We use only a small subset of Skeleton CSS utilities and presets.

## How Skeleton is structured today
Skeleton is split into two main parts:

1. CSS package (`@skeletonlabs/skeleton`)
- Tailwind v4-first CSS utilities.
- Defines token system with `@theme` variables (colors, radius, typography, spacing).
- Defines utility classes with `@utility` (`btn`, `card`, `input`, `select`, `textarea`, `anchor`, etc.).
- Defines optional preset utilities in `optional/presets.css` (`preset-filled-*`, `preset-outlined-*`, `preset-tonal`).
- Ships themes as separate CSS files, activated by `data-theme="<name>"`.

2. Svelte package (`@skeletonlabs/skeleton-svelte`)
- Not in scope for this proposal.

## How color generation works
Skeleton color output is mostly generated at build time, then selected at runtime.

1. Theme tokens (build time)
- Each theme file (for example `themes/modern.css`) defines raw semantic scales in OKLCH:
  - `--color-primary-50 ... --color-primary-950`
  - same for `secondary`, `tertiary`, `success`, `warning`, `error`, `surface`.
- It also defines contrast tokens:
  - `--color-primary-contrast-50 ... --color-primary-contrast-950`.

2. Pair tokens (build time)
- Base CSS creates pair variables with `light-dark(...)`, for example:
  - `--color-primary-50-950: light-dark(var(--color-primary-50), var(--color-primary-950))`
  - `--color-surface-100-900: light-dark(var(--color-surface-100), var(--color-surface-900))`.
- This produces one token that works in both light and dark schemes.

3. Utility/preset generation (build time)
- Utility classes use raw or pair tokens (`bg-surface-50-950`, `text-surface-900-50`).
- Presets map semantic color + contrast pairs (`preset-filled-primary-500`, `preset-outlined-surface-500`).

4. Runtime resolution
- `data-theme="<name>"` selects which raw token values are active.
- Color scheme (`light`/`dark`) controls which side of `light-dark(...)` is used.
- In Sila, `.dark` is applied on the document and sets `color-scheme: dark`.

For a smaller custom version, keep the same 4-step model but reduce:
- number of themes,
- number of shades/pairs you emit,
- number of preset classes you generate.

## Sila usage snapshot (focus scope)
Based on current source usage in `/Users/dk/repos/sila/packages/client/src/lib`:

- Most used utility classes: `btn`, `input`, `select`, `card`, `anchor`, `h1-h4`, `label`.
- Preset classes used most: `preset-tonal`, `preset-filled-primary-500`, `preset-outlined-surface-500`, `preset-filled`.
- This proposal only targets the CSS layer (`@skeletonlabs/skeleton` + optional presets + themes).

## Size signals
Measured with Tailwind build:

- Current full stylesheet: ~365.8 KB raw, ~40.4 KB gzip.
- Same app CSS with one theme and no optional presets: ~107.8 KB raw, ~15.6 KB gzip.
- Base + one theme only: ~94.6 KB raw, ~13.7 KB gzip.

Conclusion: most weight is not from app-specific classes; it is from multi-theme + broad preset surface.

## Proposal: build a focused "Sila UI Core CSS"

### 1) Foundation tokens (must-have)
Create a small token layer that mirrors current naming so migration is safe.

Keep:
- Color families: `primary`, `secondary`, `tertiary`, `success`, `warning`, `error`, `surface`
- Shades used now (`50..950`) and paired variables (`50-950`, `100-900`, etc.)
- Contrast variables (`--color-*-contrast-*`)
- `--spacing`, `--radius-base`, `--radius-container`, font tokens

How:
- Add `packages/client/src/lib/ui-core/tokens.css` with `@theme`.
- Keep `data-theme` switching contract.
- Start with 3 themes only (for example `cerberus`, `modern`, `terminus`).

### 2) Core utilities (must-have)
Implement only utilities Sila uses now.

Keep:
- Layout surface: `card`, `hr`, `table`, `anchor`, `h1-h4`
- Buttons: `btn`, `btn-sm`, `btn-lg`, `btn-icon`, `btn-icon-sm`, `btn-group`, `btn-group-vertical`
- Forms: `label`, `label-text`, `input`, `select`, `textarea`, `input-error`
- Basic state helpers used in app (`focused`, disabled behavior)

How:
- Add `packages/client/src/lib/ui-core/utilities.css` with `@utility`.
- Preserve current class names first. Do not rename in phase 1.

### 3) Presets subset (must-have)
Keep only preset classes that Sila actually uses.

Initial set:
- `preset-filled`
- `preset-filled-primary-500`
- `preset-filled-secondary-500`
- `preset-filled-success-500`
- `preset-filled-warning-500`
- `preset-filled-error-500`
- `preset-filled-surface-500`
- `preset-outlined`
- `preset-outlined-primary-500`
- `preset-outlined-surface-500`
- `preset-outlined-surface-100-900`
- `preset-outlined-error-500`
- `preset-tonal`
- `preset-ghost` (if still needed)

How:
- Add `packages/client/src/lib/ui-core/presets.css`.
- Generate from a small source map to avoid manual drift.

## Phased plan

### Phase 0: inventory and freeze
- Lock current class/theme surface in one markdown spec.
- Capture screenshots for key screens (chat, settings, popups, model config).

### Phase 1: CSS foundation
- Add `ui-core` CSS files (tokens, utilities, presets, 3 themes).
- Switch `/Users/dk/repos/sila/packages/client/src/app.css` imports from Skeleton to `ui-core`.
- Keep all existing class names working.

### Phase 2: cleanup and shrink
- Remove unused preset classes and dead aliases.
- Reduce theme list from 22 to selected set.
- Keep `@skeletonlabs/skeleton-svelte` untouched.

### Phase 3: extraction (optional)
- If stable, extract to new workspace package (for reuse across projects).

## Risks and controls
- Theme drift:
  - Snapshot token outputs and compare old/new computed values on key screens.
- Hidden class dependencies:
  - Run class usage audit before deleting any utility.

## Success criteria
- No UI regressions in key flows (chat, settings, file picker, provider setup).
- CSS output under 140 KB raw in default build.
- Keep existing theme switching behavior (`data-theme` + dark class).
- Keep `@skeletonlabs/skeleton-svelte` usage unchanged.

## Open decisions
1. Keep 3 themes or 5 themes in v1?
2. Preserve all legacy utility aliases (`variant-*`, `preset-outline`) or remove with codemod?
