import { test, expect } from '@playwright/test';

test('gallery home loads', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByRole('heading', { name: /Sila Gallery/i })).toBeVisible();
});

test('app loads and shows sidebar quickly', async ({ page }) => {
	await page.goto('/app');
    // Wait for readiness marker, then app root should render
    await expect(page.getByTestId('ready')).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('app-root')).toBeVisible({ timeout: 15000 });
});

test('dual-state page renders two panes', async ({ page }) => {
    await page.goto('/components/dual-state');
    // At least one card appears once state adopts demo space
    const cards = page.locator('div.border.rounded');
    await expect(cards.first()).toBeVisible({ timeout: 15000 });
});

