# Testing in Sila

This guide explains why we test and how to run the tests. It intentionally avoids details that change often.

## Why we test
- Ensure core functionality remains stable as the product evolves
- Catch regressions quickly with fast, local feedback
- Ship confidently across desktop and mobile

## Where tests live
- Core tests (unit/integration): `packages/core/tests/` (Vitest)
- UI integration tests: `packages/gallery` (Playwright)

## Run tests
From the repository root:

```bash
# Install deps
npm install

# Run all top-level tests (core + gallery)
npm test

# Run only core tests
npm -w packages/core run test

# Run a single core test file (example)
npm -w packages/core run test -- --run src/ai/ai-image.test.ts

# Optional: use a specific config (e.g., node environment)
npx vitest --config packages/core/tests/vitest.config.ts
```

### Playwright (gallery)
```bash
# Run gallery Playwright tests
npm -w packages/gallery run test

# Open Playwright UI runner
npm -w packages/gallery run test:ui
```

## AI provider keys (optional)
Some tests exercise AI integrations. Provide keys to enable them; tests auto-skip without keys.

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
- AI tests without keys are expected to skip.

Note: This document is deliberately brief and stable. See test files for current coverage.
