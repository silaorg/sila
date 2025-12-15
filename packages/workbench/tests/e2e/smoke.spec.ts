import { test, expect } from '@playwright/test';

test('workbench root', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByRole('heading', { name: /Sila Workbench/i })).toBeVisible();
});

