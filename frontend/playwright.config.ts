import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testIgnore: '**/frontend-only/**',
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  timeout: 45000,
  globalTimeout: 900000,
  reporter: [
    ['list'],
    ['html', { outputFolder: '../output/playwright/authenticated-report', open: 'never' }],
  ],
  outputDir: '../output/playwright/authenticated',
  use: {
    baseURL: 'http://127.0.0.1:3107',
    channel: process.env.PLAYWRIGHT_CHROMIUM_CHANNEL,
    colorScheme: 'light',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'node e2e/utils/serve-frontend.mjs',
    url: 'http://127.0.0.1:3107/en/auth/login',
    reuseExistingServer: false,
    timeout: 60000,
    gracefulShutdown: { signal: 'SIGTERM', timeout: 5000 },
  },
});
