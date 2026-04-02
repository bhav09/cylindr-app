import { test, expect } from '@playwright/test';

test.describe('Full Partner Onboarding Flow', () => {
    test.use({
        geolocation: { latitude: 28.6139, longitude: 77.2090 }, // New Delhi (Within India)
        permissions: ['geolocation']
    });

    test('Partner registers successfully', async ({ page }) => {
        let extractedOtp = '';

        // Intercept the JS alert to extract the OTP
        page.on('dialog', async dialog => {
            const message = dialog.message();
            const match = message.match(/Your code is ([0-9]{6})/);
            if (match) {
                extractedOtp = match[1];
            }
            await dialog.accept();
        });

        // 1. Visit Portal
        await page.goto('/register.html');

        // 2. Fill basic details
        await page.locator('#agency-name').fill('New Delhi Gas Partners');
        await page.locator('#company').selectOption('Indane');
        await page.locator('#dealer-code').fill('IND-778899');
        await page.locator('#phone').fill('+919876543210');
        await page.locator('#email').fill('partner@newdelhigas.com');

        // 3. Acquire location
        await page.locator('#get-location-btn').click();
        await expect(page.locator('#location-status')).toBeVisible();

        // 4. Request OTP
        await page.locator('#send-otp-btn').click();

        // Ensure we got the OTP from the interceptor
        expect(extractedOtp.length).toBe(6);

        // 5. Verify OTP
        const otpInput = page.locator('#otp-input');
        await expect(otpInput).toBeVisible({ timeout: 5000 });
        await otpInput.fill(extractedOtp);
        await page.locator('#verify-otp-btn').click();

        // 6. Ensure OTP success
        await expect(page.locator('#otp-success-area')).toBeVisible();
        await expect(page.locator('#submit-btn')).not.toBeDisabled();

        // Wait to pass the 3-second rapid-form-filling bot protection check!
        await page.waitForTimeout(3500);

        // 7. Submit Application
        await page.locator('#submit-btn').click();

        // 8. Verify Success
        await expect(page.locator('#success-card')).toBeVisible({ timeout: 10000 });
        const successText = page.locator('#success-card h2');
        await expect(successText).toHaveText('Registration Submitted!');
    });
});
