import { test, expect } from './fixtures/authenticated';

const profile = (url: string) => url.endsWith('/api/user/profile');

for (const actor of [
  { email: 'admin@seed.local', password: 'Admin123!', landing: '/admin/dashboard' },
  { email: 'user@seed.local', password: 'User123!', landing: '/dashboard' },
]) {
  test.describe(`Validated ${actor.email} session`, () => {
    test.use({ actor });
    test('keeps its destination and identity across three full reloads', async ({
      page,
    }, testInfo) => {
      for (let attempt = 0; attempt < 3; attempt++) {
        if (attempt > 0) {
          await page.context().clearCookies();
          await page.goto('/en/auth/login');
          await page.getByTestId('login-email-input').fill(actor.email);
          await page.getByTestId('login-password-input').fill(actor.password);
          await page.getByTestId('login-submit').click();
          await expect(page).toHaveURL(`http://127.0.0.1:3107/en${actor.landing}`);
        }
        const validated = page.waitForResponse(
          (response) => profile(response.url()) && response.status() === 200,
        );
        await page.reload();
        const response = await validated;
        const profileBody = (await response.json()) as { data: { email: string } };
        expect(profileBody.data.email).toBe(actor.email);
        await expect(page.getByTestId('dashboard-main')).toBeVisible();
        await expect(page).toHaveURL(`http://127.0.0.1:3107/en${actor.landing}`);
        await expect(page.getByTestId('auth-guard-loading')).not.toBeVisible();
      }
      const keys = await page.evaluate(() =>
        Object.keys(JSON.parse(localStorage.getItem('persist:auth')!) as object).sort(),
      );
      expect(keys).toEqual(['_persist', 'isAuthenticated']);
      await testInfo.attach('validated-reloads', {
        body: await page.screenshot({ path: testInfo.outputPath('page.png'), fullPage: true }),
        contentType: 'image/png',
      });
    });
  });
}

test.describe('Explicit destination', () => {
  test.use({ returnPath: '/sessions' });
  test('honors the return path after real login and reload', async ({ page }) => {
    await expect(page.getByTestId('sessions-list')).toBeVisible();
    await page.reload();
    await expect(page.getByTestId('sessions-list')).toBeVisible();
    await expect(page).toHaveURL('http://127.0.0.1:3107/en/sessions');
  });
});

test('healthy anonymous profile 401 leaves login usable without an error toast', async ({
  page,
  context,
}, testInfo) => {
  await context.clearCookies();
  const anonymous = page.waitForResponse(
    (response) => profile(response.url()) && response.status() === 401,
  );
  await page.goto('/en/auth/login');
  await anonymous;
  await expect(page.getByTestId('login-submit')).toBeVisible();
  await expect(
    page.getByRole('region', { name: /Notifications/ }).getByRole('listitem'),
  ).toHaveCount(0);
  await testInfo.attach('healthy-anonymous', {
    body: await page.screenshot({ path: testInfo.outputPath('page.png'), fullPage: true }),
    contentType: 'image/png',
  });
});

for (const mobile of [false, true]) {
  test.describe(`Arabic ${mobile ? 'mobile' : 'desktop'}`, () => {
    test.use({
      appLocale: 'ar',
      viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 800 },
      hasTouch: mobile,
    });
    test('supports localized session navigation and keyboard controls without overflow', async ({
      page,
    }, testInfo) => {
      await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
      await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
      if (mobile) {
        await page.getByTestId('mobile-menu-button').tap();
        await expect(page.getByTestId('mobile-sidebar')).toBeVisible();
      }
      const navigation = page.getByTestId('dashboard-nav').filter({ visible: true });
      const sessions = navigation.getByTestId('nav-link-sessions');
      await sessions.focus();
      await page.keyboard.press('Enter');
      await expect(page).toHaveURL('http://127.0.0.1:3107/ar/sessions');
      await expect(page.getByTestId(/^session-card-timeline-/)).toHaveCount(2);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
      await testInfo.attach('arabic-session', {
        body: await page.screenshot({ path: testInfo.outputPath('page.png'), fullPage: true }),
        contentType: 'image/png',
      });
    });
  });
}
