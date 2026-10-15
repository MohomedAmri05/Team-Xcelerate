import { test, expect } from '@playwright/test';

/*
| Browser smoke tests. Start the API and run `npm run e2e` from the project
| root (Playwright starts the Vite dev server automatically).
*/

test('mobile navigation opens', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://localhost:5173');
  await page.getByLabel('Toggle navigation').click();
  await expect(
    page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Inventory' })
  ).toBeVisible();
});

test('404 is useful', async ({ page }) => {
  await page.goto('http://localhost:5173/not-real');
  await expect(page.getByText(/road ends here/i)).toBeVisible();
});

test('customer-only pages redirect guests to log in', async ({ page }) => {
  for (const path of ['/my-complaints', '/my-documents', '/my-bookings']) {
    await page.goto(`http://localhost:5173${path}`);
    await expect(page).toHaveURL(new RegExp(`/login\\?redirect=${encodeURIComponent(path)}`));
  }
});

test('dashboard requires staff or admin', async ({ page }) => {
  await page.goto('http://localhost:5173/admin');
  await expect(page).toHaveURL(/\/login/);
});

test('contact page never shows placeholder contact details', async ({ page }) => {
  await page.goto('http://localhost:5173/contact');
  await expect(page.locator('.contact-info-card')).toBeVisible();
  await expect(page.locator('.contact-info-card')).not.toContainText('000 0000');
});

test('inventory search filters results', async ({ page }) => {
  await page.goto('http://localhost:5173/inventory');
  await page.getByLabel('Search make or model').fill('zzzz-no-such-vehicle');
  await expect(page.getByText(/No vehicles found/i)).toBeVisible();
});

// October 2026 – the account owner resets their own password
test('login links to "Forgot password?" and the reset page refuses a broken link', async ({ page }) => {
  await page.goto('http://localhost:5173/login');
  await page.getByRole('link', { name: 'Forgot password?' }).click();
  await expect(page.getByRole('heading', { name: /forgot your password/i })).toBeVisible();
  await page.goto('http://localhost:5173/reset-password?token=broken');
  await expect(page.getByText(/this link cannot be used/i)).toBeVisible();
});

// 15 October 2026 – every home page tile opens the page for that task
test('home tiles open Inventory, Finance, Book a test drive and Contact', async ({ page }) => {
  const tiles = [
    ['Browse and save', '/inventory'],
    ['Plan the finance', '/finance'],
    ['Book a test drive', '/book-test-drive'],
    ['Get support', '/contact']
  ];

  for (const [title, path] of tiles) {
    await page.goto('http://localhost:5173/');
    await page.locator('.journey-grid a', { hasText: title }).click();
    await expect(page).toHaveURL(new RegExp(`${path}$`));
  }

  await expect(page.locator('.cp-hero, .contact-page').first()).toBeVisible();
  await page.goto('http://localhost:5173/book-test-drive');
  await expect(page.getByRole('heading', { name: /log in to book a test drive/i })).toBeVisible();
});
