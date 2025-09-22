## Proposal: Playwright E2E for Gallery (fast setup)

### Problem
- We need reliable, browser-level tests for gallery components to validate UI flows across Chromium/WebKit/Firefox.
- Current tests run in Vitest/JS DOM and miss real browser behavior (layouts, focus, uploads, drag/drop, clipboard, etc.).

### Goals
- Add quick, low-friction Playwright E2E to `packages/gallery` that anyone can run locally and in CI.
- Test the real gallery app (SvelteKit) on localhost with realistic data (demo space) and minimal mocks.
- Keep the setup small and incremental. Avoid overbuilding.

### Non-Goals (for v1)
- Full component testing (CT) for every Svelte component.
- Visual regression testing and complex cross-page navigation suites.

## Approach

### v1: E2E against running SvelteKit gallery
- Install Playwright in the `packages/gallery` workspace.
- Use Playwright’s `webServer` to boot the gallery dev server on port 5173 and reuse if already running.
- Target a small set of routes with good coverage:
  - `/` (landing)
  - `/components/chat-sandbox` (existing chat demo)
  - `/components/dual-state` (two client states side-by-side)
  - `/app` (if relevant)
- Use built-in `/api/demo-space` to seed an in-memory space. Avoid DB/FS persistence in tests.

### Optional v2: Playwright Component Testing (CT)
- Add CT for critical leaf components (buttons, menus, simple forms) with Svelte 5.
- Keep E2E as the backbone; CT supplements.

## Files to add (v1)
- `packages/gallery/playwright.config.ts`
- `packages/gallery/tests/e2e/*.spec.ts` (start with `smoke.spec.ts` and `chat-sandbox.spec.ts`)

## Config (v1)

```ts
// packages/gallery/playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    cwd: __dirname,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
});
```

## Example tests (v1)

```ts
// packages/gallery/tests/e2e/smoke.spec.ts
import { test, expect } from '@playwright/test';

test('home page loads', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Sila|Gallery/i);
});

test('chat sandbox renders', async ({ page }) => {
  await page.goto('/components/chat-sandbox');
  await expect(page.getByText(/Loading/i)).toBeVisible();
  await expect(page.locator('body')).toBeVisible();
});
```

```ts
// packages/gallery/tests/e2e/dual-state.spec.ts
import { test, expect } from '@playwright/test';

test('dual-state page shows two independent panes', async ({ page }) => {
  await page.goto('/components/dual-state');
  const panes = page.locator('.border.rounded');
  await expect(panes).toHaveCount(2);
});
```

## Installation & scripts

```bash
# from repo root
npm i -w packages/gallery -D @playwright/test
npx -w packages/gallery playwright install --with-deps

# add scripts to packages/gallery/package.json
"scripts": {
  "dev": "vite dev",
  "build": "vite build",
  "preview": "vite preview",
  "check": "svelte-kit sync && svelte-check",
  "test:e2e": "playwright test",
  "test:e2e:ui": "playwright test --ui"
}

# run locally
npm run -w packages/gallery test:e2e
```

## CI setup (GitHub Actions)

```yaml
# .github/workflows/gallery-e2e.yml
name: Gallery E2E
on: [push, pull_request]

jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npx -w packages/gallery playwright install --with-deps
      - run: npm run -w packages/gallery test:e2e
      - if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: packages/gallery/playwright-report
```

## Data & fixtures
- The gallery already exposes `/api/demo-space` which builds an in-memory space. This is ideal for deterministic tests.
- For specialized scenarios, add `/routes/api/demo-space?variant=...` return branches and drive tests via query params.

## Gotchas and mitigations
- SvelteKit dev server hot reload can interfere with tests: set `reuseExistingServer: !CI` (already done) and use retries.
- File uploads: prefer `page.setInputFiles` and wire components’ file inputs with stable `data-testid` attributes.
- Flakiness: keep selectors data-test-id based, avoid arbitrary timeouts, use `expect(...).toBeVisible()`.

## Timeline (minimal)
- Day 1: install, config, smoke test, add CI job.
- Day 2: add 2-3 critical flows (chat sandbox load, send message stubbed, dual-state isolation visible).
- Later: optional CT for a few leaf components.

## Rollout checklist
- [ ] Add Playwright deps and config under `packages/gallery/`
- [ ] Add basic E2E tests and wire CI job
- [ ] Document `npm run -w packages/gallery test:e2e` in `docs/dev/components-gallery.md`
- [ ] Add `data-testid` attributes where selectors are flaky

