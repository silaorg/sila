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

	const getWidth = async () => await sidebar.evaluate((el) => {
		const w = parseFloat(getComputedStyle(el as HTMLElement).width || '0');
		return isFinite(w) ? w : 0;
	});

	let width = await getWidth();
	if (width <= 50) {
		// Try toggling the sidebar open if it's collapsed
		const expandBtn = page.locator('button[aria-label*="Expand sidebar" i]');
		if (await expandBtn.count()) {
			await expandBtn.first().click({ timeout: 1000 });
		}
		width = await expect.poll(getWidth, { timeout: 5000 }).toBeGreaterThan(50);
	} else {
		await expect(width).toBeGreaterThan(50);
	}
});

test('dual-state page renders two panes', async ({ page }) => {
	await page.goto('/components/dual-state');
	const panes = page.locator('.border.rounded');
	await expect(panes).toHaveCount(2);
});

