import { defineConfig, devices } from '@playwright/test';
import type { AnonymousOptions } from './e2e/frontend-only/fixtures';

const origin = 'http://127.0.0.1:3107';

export default defineConfig<AnonymousOptions>({
  testDir: './e2e/frontend-only',
  fullyParallel: true,
  forbidOnly: true,
  retries: 0,
  workers: 2,
  timeout: 30_000,
  globalTimeout: 10 * 60_000,
  outputDir: '../output/playwright/frontend-only',
  reporter: [['list'], ['html', { outputFolder: '../output/playwright/report', open: 'never' }]],
  use: {
    baseURL: origin,
    channel: process.env.PLAYWRIGHT_CHROMIUM_CHANNEL,
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: (['en', 'ar'] as const).flatMap((appLocale) => [
    {
      name: `${appLocale}-desktop`,
      use: { ...devices['Desktop Chrome'], locale: appLocale, appLocale },
    },
    {
      name: `${appLocale}-mobile`,
      use: { ...devices['Pixel 5'], locale: appLocale, appLocale },
    },
  ]),
  webServer: {
    command: 'node e2e/utils/serve-frontend.mjs',
    url: `${origin}/en/auth/login`,
    reuseExistingServer: false,
    timeout: 60_000,
    gracefulShutdown: { signal: 'SIGTERM', timeout: 5_000 },
  },
});
