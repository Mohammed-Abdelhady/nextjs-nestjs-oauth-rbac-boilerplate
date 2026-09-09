import { test, expect, API } from './fixtures/authenticated';

test.use({ authenticate: false });

test.describe('Local OAuth application integration', () => {
  test('consent creates a real session and returns to the requested page', async ({ page }) => {
    await page.goto('/en/auth/login?redirect=%2Fsessions');
    await page.getByTestId('oauth-google-button').click();
    await expect(page).toHaveURL(/^http:\/\/127\.0\.0\.1:5108\/authorize/);
    await page.getByTestId('consent-continue').click();
    await expect(page).toHaveURL('http://127.0.0.1:3107/en/sessions');
    await expect(page.getByTestId('sessions-page')).toBeVisible();
    expect((await (await page.request.get(`${API}/user/profile`)).json()).data.email).toBe(
      'oauth@example.test',
    );
  });

  for (const outcome of ['cancel', 'error'] as const) {
    test(`${outcome} shows a recoverable callback error without a session`, async ({ page }) => {
      await page.goto('/en/auth/login');
      await page.getByTestId('oauth-google-button').click();
      await page.getByTestId(`consent-${outcome}`).click();
      await expect(page.getByTestId('oauth-callback-error')).toBeVisible();
      expect((await page.request.get(`${API}/user/profile`)).status()).toBe(401);
      await page.getByTestId('oauth-back-to-sign-in').focus();
      await page.keyboard.press('Enter');
      await expect(page.getByTestId('login-submit')).toBeVisible();
    });
  }
});

test.describe('Captured magic-link mail', () => {
  for (const expired of [false, true]) {
    test(`${expired ? 'expired' : 'valid'} link has the expected user outcome`, async ({
      page,
      fixtureMail,
      expireMagicLinks,
    }, info) => {
      if (expired) {
        info.annotations.push({
          type: 'expected-api-error',
          description: JSON.stringify({ path: '/api/auth/magic-link/verify', status: 400 }),
        });
      }
      await page.goto('/en/auth/login');
      await page.getByTestId('magic-link-email-input').fill('user@seed.local');
      await page.getByTestId('magic-link-submit').click();
      await expect(page.getByTestId('magic-link-sent')).toBeVisible();
      let link = '';
      await expect
        .poll(async () => {
          link =
            (await fixtureMail())
              .findLast((mail) => mail.to === 'user@seed.local')
              ?.text?.match(/http:\/\/127\.0\.0\.1:3107\S+/)?.[0] ?? '';
          return link;
        })
        .not.toBe('');
      if (expired) await expireMagicLinks();
      await page.goto(link);
      if (expired) {
        await expect(page.getByTestId('magic-link-verify-error')).toBeVisible();
        expect((await page.request.get(`${API}/user/profile`)).status()).toBe(401);
        await page.getByTestId('magic-link-request-new').click();
        await expect(page.getByTestId('magic-link-email-input')).toBeVisible();
      } else {
        await expect(page).toHaveURL('http://127.0.0.1:3107/en/dashboard');
        expect((await (await page.request.get(`${API}/user/profile`)).json()).data.email).toBe(
          'user@seed.local',
        );
      }
    });
  }
});
