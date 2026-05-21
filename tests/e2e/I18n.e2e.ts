import { expect, test } from '@playwright/test';

test.describe('I18n', () => {
  test.describe('Language switching', () => {
    test('should display French homepage text when locale is French', async ({ page }) => {
      await page.goto('/');

      await expect(page.getByText('Album content soon')).toBeVisible();

      await page.goto('/fr');

      await expect(page.getByText('Contenu album bientôt')).toBeVisible();
    });

    test('should switch language from English to French using URL and verify text on the sign-in page', async ({
      page,
    }) => {
      await page.goto('/sign-in');

      await expect(page.getByText('Email address')).toBeVisible();

      await page.goto('/fr/sign-in');

      await expect(page.getByText('Adresse e-mail')).toBeVisible();
    });
  });
});
