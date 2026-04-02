import { test, expect } from '@playwright/test';

test.describe('Consumer Flow', () => {
    
    test('Should load welcome screen and navigate to map', async ({ page, context }) => {
        // Mock geolocation to simulate a Bangalore user
        await context.grantPermissions(['geolocation']);
        await context.setGeolocation({ latitude: 12.9716, longitude: 77.5946 });

        await page.goto('/');

        // 1. Verify Welcome Screen exists
        const welcomeCard = page.locator('#welcome-overlay');
        await expect(welcomeCard).toBeVisible();

        // 2. Select Consumer Role
        const consumerBtn = page.locator('#btn-consumer');
        await consumerBtn.click();

        // Welcome screen should hide
        await expect(welcomeCard).not.toBeVisible();

        // Map container should be visible
        const mapContainer = page.locator('#map');
        await expect(mapContainer).toBeVisible();

        // Top bar should be visible
        const appTitle = page.locator('header h1', { hasText: 'Cylindr' });
        await expect(appTitle).toBeVisible();

        // Bottom sheet should be hidden initially
        const bottomSheet = page.locator('#bottom-sheet');
        await expect(bottomSheet).toHaveClass(/hidden/);
    });

    test('Should toggle languages from the header dropdown', async ({ page }) => {
        await page.goto('/');
        await page.locator('#btn-consumer').click();

        const langSelect = page.locator('#lang-select');
        await expect(langSelect).toBeVisible();

        // Change to Hindi and verify selection
        await langSelect.selectOption('hi');
        await expect(langSelect).toHaveValue('hi');
    });
});
