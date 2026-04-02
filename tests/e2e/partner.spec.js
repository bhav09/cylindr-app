import { test, expect } from '@playwright/test';

test.describe('Partner & Registration Flows', () => {

    test('Should navigate to Partner Portal via nav icon', async ({ page }) => {
        await page.goto('/');

        // Click consumer to load map UI
        await page.locator('#btn-consumer').click();

        // Click the partner navigation link
        const navLink = page.locator('#nav-partner-link');
        await expect(navLink).toBeVisible();
        await navLink.click();

        // Verify we arrived at partner portal
        await expect(page).toHaveURL(/partner.html/);
        const heading = page.locator('h2', { hasText: 'Agency Login' });
        await expect(heading).toBeVisible();
    });

    test('Partner Login validates empty inputs correctly', async ({ page }) => {
        await page.goto('/partner.html');

        const loginForm = page.locator('#login-form');
        await expect(loginForm).toBeVisible();

        // Submitting raw form should trigger HTML5 validation because of 'required' attribute
        await page.locator('button[type="submit"]').click();
        
        // HTML5 validation prevents submission if empty, so URL shouldn't change
        await expect(page).toHaveURL(/partner.html/);

        // Check the register link is present
        const regLink = page.locator('a[href="register.html"]');
        await expect(regLink).toBeVisible();
    });

    test('Registration Form bot protections are present', async ({ page }) => {
        await page.goto('/register.html');

        // Check if honeypot is in DOM but visually hidden via CSS (.hp-field)
        const hpInput = page.locator('#website');
        await expect(hpInput).toBeAttached(); // Exists in DOM
        
        // Assert CSS hides it via opacity
        await expect(hpInput.locator('..')).toHaveCSS('opacity', '0');

        // Check OTP Request section is visible
        const otpRequestArea = page.locator('#otp-request-area');
        await expect(otpRequestArea).toBeVisible();

        // Check OTP Input is hidden initially
        const otpVerifyArea = page.locator('#otp-verify-area');
        await expect(otpVerifyArea).toBeHidden();

        // Assert that the submit button is disabled by default
        const submitBtn = page.locator('#submit-btn');
        await expect(submitBtn).toBeDisabled();
    });
});
