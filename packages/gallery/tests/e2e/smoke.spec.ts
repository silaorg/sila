import { test, expect } from '@playwright/test';

test('gallery home loads', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByRole('heading', { name: /Sila Gallery/i })).toBeVisible();
});

test('app loads and shows sidebar quickly', async ({ page }) => {
	await page.goto('/app');
    // First loading text
    await expect(page.getByText(/Loading demo space/i)).toBeVisible({ timeout: 10000 });
    // Then app root should render
    await expect(page.getByTestId('app-root')).toBeVisible({ timeout: 15000 });
});

test('dual-state page renders two panes', async ({ page }) => {
    await page.goto('/components/dual-state');
    // Loading initially
    await expect(page.getByText(/Loading…/)).toBeVisible({ timeout: 10000 });
    // At least one card appears once state adopts demo space
    const cards = page.locator('div.border.rounded');
    await expect(cards.first()).toBeVisible({ timeout: 15000 });
});

