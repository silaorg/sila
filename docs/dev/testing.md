# Testing in Sila

We have automated tests in two packages: `core` and the UI workbench.

`packages/core/tests` is for testing core (without the UI or any client-server logic).

`packages/workbench/tests` is for testing svelte components. The closest we get to e2e testing (via the UI workbench).

Perhaps we need to setup a proper testing for the `packages/desktop` (Electron app) but didn't do it yet.

## Testing frameworks

The core tests use Vitest and the workbench uses Playwright.

## Run tests

From the repository root:

```bash
# Install deps
npm install

# Run all top-level tests (core + workbench)
npm test

# Run only core tests
npm -w packages/core run test

# Run a single core test file (example)
npm -w packages/core run test -- --run src/ai/ai-image.test.ts

# Optional: use a specific config (e.g., node environment)
npx vitest --config packages/core/tests/vitest.config.ts
```

### Playwright (workbench)

```bash
# Run workbench Playwright tests
npm -w packages/workbench run test

# Open Playwright UI runner
npm -w packages/workbench run test:ui
```

#### Playwright browser install (required once per machine/CI image)

Playwright tests need a browser binary (Chromium) downloaded locally.

```bash
# Local dev (Chromium only)
npx playwright install chromium

# CI / Linux runners (installs Chromium + OS deps)
npx playwright install --with-deps chromium
```

## AI provider keys (optional)

Some tests use AI providers. Add API keys to enable them; tests auto-skip without keys.

- Create `.env` in repo root
- Supported keys (set whichever you use):
  - `OPENAI_API_KEY=...`
  - `OPENROUTER_API_KEY=...`

## Test assets

Small, deterministic fixtures live in:
```
packages/core/tests/assets/images/
packages/core/tests/assets/to-send/
```

## Troubleshooting

- If postinstall scripts are blocked:

  ```bash
  npm install --ignore-scripts
  npm -w packages/core run test
  ```

- If Playwright fails with "Executable doesn't exist ... run `npx playwright install`":
  
  ```bash
  npx playwright install chromium
  ```
  
- AI tests without keys are expected to skip.
