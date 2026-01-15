# Workbench screenshots with Playwright

We capture screenshots in Playwright e2e tests.
Use the same flow for docs images and UI confirmation.

## Why

- Visual confirmation for new UI features.
- Screenshots for user docs.

## Workflow

1) Create or update a workbench e2e test.
2) Navigate to the workbench route for the feature.
3) Wait for the UI to be ready.
4) Call `page.screenshot` with a path under `screenshots/`.

Example from existing tests:

```ts
import { expect, test } from '@playwright/test';

test('captures app UI', async ({ page }) => {
  await page.goto('/app');
  await page.waitForLoadState('networkidle');
  await expect(page.getByTestId('space-root')).toBeVisible();
  await page.screenshot({ path: 'screenshots/app.png' });
});
```