import { test, expect } from '@playwright/test';

test('gallery home loads', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByRole('heading', { name: /Sila Gallery/i })).toBeVisible();
});

test('app loads and shows sidebar quickly', async ({ page }) => {
	await page.goto('/app');
	await page.waitForLoadState('networkidle');
	const sidebar = page.getByTestId('sidebar');
	await expect(sidebar).toBeAttached();
	// Sidebar toggle presence is a good proxy that layout initialized
	const toggle = page.locator('button[aria-label*="Expand sidebar" i], button[aria-label*="Collapse sidebar" i]');
	await expect(toggle).toBeVisible({ timeout: 3000 });
});

test('dual-state page renders two panes', async ({ page }) => {
	await page.goto('/components/dual-state');
	const panes = page.locator('.border.rounded');
	await expect(panes).toHaveCount(2);
});

