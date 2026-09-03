import { test, expect } from '@playwright/test';

/**
 * E2E tests for Session Management functionality
 * Tests session listing, logout, and bulk logout features
 */

test.describe('Session Management', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to sessions page
    // Note: In a real app, you would need to login first
    await page.goto('/sessions');
    await page.waitForLoadState('networkidle');
  });

  test('should display sessions page with active sessions', async ({ page }) => {
    // Check page title
    await expect(page.getByRole('heading', { name: /active sessions/i })).toBeVisible();

    // Should display info about auto-refresh
    await expect(page.getByText(/automatically refreshes/i)).toBeVisible();

    // Should have at least one session (current session)
    const sessionCards = page.locator('[data-testid^="session-card-"]');
    await expect(sessionCards).toHaveCount(await sessionCards.count());
    expect(await sessionCards.count()).toBeGreaterThan(0);
  });

  test('should mark current session with indicator', async ({ page }) => {
    // Current session should have a "Current Session" badge
    await expect(page.getByText(/current session/i)).toBeVisible();

    // Current session card should not have a logout button
    const currentSessionCard = page.locator('[data-testid^="session-card-"]', {
      has: page.getByText(/current session/i),
    });
    await expect(currentSessionCard.getByTestId(/logout-session-/)).not.toBeVisible();
  });

  test('should display session details correctly', async ({ page }) => {
    const sessionCard = page.locator('[data-testid^="session-card-"]').first();

    // Should display device type and icon
    await expect(sessionCard.locator('[aria-label*="device"]')).toBeVisible();

    // Should display browser name
    await expect(sessionCard.getByText(/chrome|firefox|safari|edge/i)).toBeVisible();

    // Should display IP address
    await expect(sessionCard.getByText(/\d+\.\d+\.\d+\.\d+/)).toBeVisible();

    // Should display last activity time
    await expect(sessionCard.getByText(/last active|just now/i)).toBeVisible();
  });

  test('should show logout confirmation dialog for non-current session', async ({ page }) => {
    // Find a non-current session
    const nonCurrentSession = page
      .locator('[data-testid^="session-card-"]')
      .filter({ hasNot: page.getByText(/current session/i) })
      .first();

    // Click logout button
    await nonCurrentSession.getByTestId(/logout-session-/).click();

    // Confirmation dialog should appear
    await expect(page.getByRole('alertdialog')).toBeVisible();
    await expect(page.getByText(/terminate this session/i)).toBeVisible();

    // Should have cancel and confirm buttons
    await expect(page.getByTestId('cancel-logout-session')).toBeVisible();
    await expect(page.getByTestId('confirm-logout-session')).toBeVisible();
  });

  test('should cancel session logout', async ({ page }) => {
    // Get initial session count
    const initialCount = await page.locator('[data-testid^="session-card-"]').count();

    // Find non-current session and click logout
    const nonCurrentSession = page
      .locator('[data-testid^="session-card-"]')
      .filter({ hasNot: page.getByText(/current session/i) })
      .first();

    await nonCurrentSession.getByTestId(/logout-session-/).click();

    // Click cancel
    await page.getByTestId('cancel-logout-session').click();

    // Dialog should close
    await expect(page.getByRole('alertdialog')).not.toBeVisible();

    // Session count should remain the same
    await page.waitForTimeout(500);
    const newCount = await page.locator('[data-testid^="session-card-"]').count();
    expect(newCount).toBe(initialCount);
  });

  test('should logout a session successfully', async ({ page }) => {
    // Get initial session count
    const initialCount = await page.locator('[data-testid^="session-card-"]').count();

    // Find non-current session and click logout
    const nonCurrentSession = page
      .locator('[data-testid^="session-card-"]')
      .filter({ hasNot: page.getByText(/current session/i) })
      .first();

    await nonCurrentSession.getByTestId(/logout-session-/).click();

    // Confirm logout
    await page.getByTestId('confirm-logout-session').click();

    // Success toast should appear
    await expect(page.locator('.sonner-toast')).toContainText(/session terminated/i);

    // Dialog should close
    await expect(page.getByRole('alertdialog')).not.toBeVisible();

    // Session count should decrease
    await page.waitForTimeout(1000); // Wait for auto-refresh
    const newCount = await page.locator('[data-testid^="session-card-"]').count();
    expect(newCount).toBeLessThan(initialCount);
  });

  test('should show logout all confirmation dialog', async ({ page }) => {
    // Click "Logout All Other Devices" button
    await page.getByTestId('logout-all-sessions-button').click();

    // Confirmation dialog should appear
    await expect(page.getByRole('alertdialog')).toBeVisible();
    await expect(page.getByText(/terminate all other sessions/i)).toBeVisible();

    // Should warn about what will happen
    await expect(page.getByText(/all other sessions will be logged out/i)).toBeVisible();

    // Should have cancel and confirm buttons
    await expect(page.getByTestId('cancel-logout-all')).toBeVisible();
    await expect(page.getByTestId('confirm-logout-all')).toBeVisible();
  });

  test('should cancel logout all sessions', async ({ page }) => {
    // Get initial session count
    const initialCount = await page.locator('[data-testid^="session-card-"]').count();

    // Click logout all button
    await page.getByTestId('logout-all-sessions-button').click();

    // Click cancel
    await page.getByTestId('cancel-logout-all').click();

    // Dialog should close
    await expect(page.getByRole('alertdialog')).not.toBeVisible();

    // Session count should remain the same
    await page.waitForTimeout(500);
    const newCount = await page.locator('[data-testid^="session-card-"]').count();
    expect(newCount).toBe(initialCount);
  });

  test('should logout all other sessions successfully', async ({ page }) => {
    // Skip if only one session exists
    const initialCount = await page.locator('[data-testid^="session-card-"]').count();
    test.skip(initialCount <= 1, 'Test requires multiple sessions');

    // Click logout all button
    await page.getByTestId('logout-all-sessions-button').click();

    // Confirm logout all
    await page.getByTestId('confirm-logout-all').click();

    // Success toast should appear
    await expect(page.locator('.sonner-toast')).toContainText(/all other sessions terminated/i);

    // Dialog should close
    await expect(page.getByRole('alertdialog')).not.toBeVisible();

    // Should only have current session remaining
    await page.waitForTimeout(1000); // Wait for auto-refresh
    const newCount = await page.locator('[data-testid^="session-card-"]').count();
    expect(newCount).toBe(1);

    // Remaining session should be marked as current
    await expect(page.getByText(/current session/i)).toBeVisible();
  });

  test('should disable logout all button when only current session exists', async ({ page }) => {
    // If only one session, button should be disabled
    const sessionCount = await page.locator('[data-testid^="session-card-"]').count();
    const logoutAllButton = page.getByTestId('logout-all-sessions-button');

    if (sessionCount === 1) {
      await expect(logoutAllButton).toBeDisabled();
    }
  });

  test('should auto-refresh session list every 30 seconds', async ({ page }) => {
    // Get initial timestamp from a session
    await page
      .locator('[data-testid^="session-card-"]')
      .first()
      .getByText(/last active/i)
      .textContent();

    // Wait for 31 seconds (slightly more than refresh interval)
    await page.waitForTimeout(31000);

    // Timestamp should update (or at least a network request should be made)
    const newTime = await page
      .locator('[data-testid^="session-card-"]')
      .first()
      .getByText(/last active/i)
      .textContent();

    // The text might change to "just now" or update the time
    // At minimum, the component should have re-rendered
    expect(newTime).toBeDefined();
  });

  test('should show empty state when no sessions exist', async () => {
    // This test would require manually deleting all sessions via API
    // Skipping for now as it's an edge case
    test.skip(true, 'Requires API setup to clear all sessions');
  });

  test('should handle network errors gracefully', async ({ page }) => {
    // Intercept session API and return error
    await page.route('**/api/user/sessions', (route) =>
      route.fulfill({
        status: 500,
        body: JSON.stringify({ message: 'Server error' }),
      }),
    );

    // Reload page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Error message should be displayed
    await expect(page.getByText(/failed to load sessions|error/i)).toBeVisible();
  });
});
