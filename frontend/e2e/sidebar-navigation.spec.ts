import type { Page } from '@playwright/test';
const navigation = (page: Page) => page.getByTestId('dashboard-nav').filter({ visible: true });
import { test, expect } from './fixtures/authenticated';

/**
 * E2E tests for Sidebar Navigation functionality
 * Tests responsive sidebar, collapsible sections, and mobile menu
 */

test.describe('Sidebar Navigation - Desktop', () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test.beforeEach(async ({ page }) => {
    await page.goto('/en/dashboard');
    await expect(page.getByTestId('dashboard-main')).toBeVisible();
  });

  test('should display desktop sidebar on large screens', async ({ page }) => {
    // Desktop sidebar should be visible
    const desktopSidebar = page.getByTestId('dashboard-sidebar');
    await expect(desktopSidebar).toBeVisible();

    // Mobile hamburger menu should not be visible
    const mobileMenuButton = page.getByTestId('mobile-menu-button');
    await expect(mobileMenuButton).not.toBeVisible();
  });

  test('should display all navigation items in sidebar', async ({ page }) => {
    const nav = navigation(page);

    // Top-level items
    await expect(nav.getByTestId('nav-link-dashboard')).toBeVisible();
    await expect(nav.getByTestId('nav-link-settings')).toBeVisible();

    // Section headers
    await expect(nav.getByTestId('nav-section-admin')).toBeVisible();
    await expect(nav.getByTestId('nav-section-activity')).toBeVisible();
  });

  test('should highlight active navigation item', async ({ page }) => {
    // Dashboard link should be active
    const dashboardLink = navigation(page).getByTestId('nav-link-dashboard');
    await expect(dashboardLink).toHaveAttribute('aria-current', 'page');

    // Navigate to settings
    await navigation(page).getByTestId('nav-link-settings').click();
    await page.waitForURL('**/settings');

    // Settings link should now be active
    const settingsLink = navigation(page).getByTestId('nav-link-settings');
    await expect(settingsLink).toHaveAttribute('aria-current', 'page');

    // Dashboard link should no longer be active
    await expect(dashboardLink).not.toHaveAttribute('aria-current', 'page');
  });

  test('should collapse and expand Admin section', async ({ page }) => {
    const adminSection = navigation(page).getByTestId('nav-section-admin');

    // Admin section should be expanded by default (unless localStorage says otherwise)
    // Items should be visible
    const usersLink = navigation(page).getByTestId('nav-link-users');
    await expect(usersLink).toBeVisible();
    const initialVisibility = await usersLink.isVisible();

    // Click to toggle
    await adminSection.click();
    await expect(usersLink).toBeVisible({ visible: !initialVisibility });

    // Visibility should change
    const newVisibility = await usersLink.isVisible();
    expect(newVisibility).toBe(!initialVisibility);

    await expect(adminSection).toHaveAttribute('aria-expanded', String(!initialVisibility));
  });

  test('should persist collapsed state in localStorage', async ({ page }) => {
    const adminSection = navigation(page).getByTestId('nav-section-admin');
    const usersLink = navigation(page).getByTestId('nav-link-users');

    // Get initial state
    await expect(usersLink).toBeVisible();
    const initialVisibility = await usersLink.isVisible();

    // Toggle section
    await adminSection.click();
    await expect(usersLink).toBeVisible({ visible: !initialVisibility });

    // Reload page
    await page.reload();
    await expect(page.getByTestId('dashboard-main')).toBeVisible();

    // State should be persisted
    const newUsersLink = navigation(page).getByTestId('nav-link-users');
    const newVisibility = await newUsersLink.isVisible();
    expect(newVisibility).toBe(!initialVisibility);
  });

  test('should collapse and expand Activity section independently', async ({ page }) => {
    const activitySection = navigation(page).getByTestId('nav-section-activity');
    const sessionsLink = navigation(page).getByTestId('nav-link-sessions');

    // Get initial state
    await expect(sessionsLink).toBeVisible();
    const initialVisibility = await sessionsLink.isVisible();

    // Toggle Activity section
    await activitySection.click();
    await expect(sessionsLink).toBeVisible({ visible: !initialVisibility });

    // Sessions link visibility should change
    const newVisibility = await sessionsLink.isVisible();
    expect(newVisibility).toBe(!initialVisibility);
  });

  test('should navigate to correct page when clicking nav items', async ({ page }) => {
    // Click Users link
    await navigation(page).getByTestId('nav-link-users').click();
    await expect(page).toHaveURL(/\/admin\/users/);

    // Click Roles link
    await navigation(page).getByTestId('nav-link-roles').click();
    await expect(page).toHaveURL(/\/admin\/roles/);

    // Click Sessions link
    await navigation(page).getByTestId('nav-link-sessions').click();
    await expect(page).toHaveURL(/\/sessions/);
  });
});

test.describe('Sidebar Navigation - Mobile', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test.beforeEach(async ({ page }) => {
    await page.goto('/en/dashboard');
    await expect(page.getByTestId('dashboard-main')).toBeVisible();
  });

  test('should hide desktop sidebar on mobile', async ({ page }) => {
    // Desktop sidebar should not be visible
    const desktopSidebar = page.getByTestId('dashboard-sidebar').first();
    await expect(desktopSidebar).not.toBeVisible();
  });

  test('should show mobile header with hamburger menu', async ({ page }) => {
    // Mobile header should be visible
    const mobileHeader = page.getByTestId('mobile-menu-button');
    await expect(mobileHeader).toBeVisible();

    // Hamburger menu button should be visible
    const menuButton = page.getByTestId('mobile-menu-button');
    await expect(menuButton).toBeVisible();

    // App title should be visible
    await expect(page.getByTestId('sidebar-brand-link').filter({ visible: true })).toBeVisible();
  });

  test('should open mobile sidebar when clicking hamburger menu', async ({ page }) => {
    // Mobile sidebar should not be visible initially
    const mobileSidebar = page.getByTestId('mobile-sidebar');
    await expect(mobileSidebar).not.toBeVisible();

    // Click hamburger menu
    await page.getByTestId('mobile-menu-button').click();

    // Mobile sidebar should be visible
    await expect(mobileSidebar).toBeVisible();

    // Backdrop should be visible
    const backdrop = page.getByTestId('mobile-menu-backdrop');
    await expect(backdrop).toBeVisible();
  });

  test('should close mobile sidebar when clicking backdrop', async ({ page }) => {
    // Open sidebar
    await page.getByTestId('mobile-menu-button').click();
    await expect(page.getByTestId('mobile-sidebar')).toBeVisible();

    // Click backdrop
    await page.getByTestId('mobile-menu-backdrop').click({ position: { x: 350, y: 600 } });

    // Sidebar should close
    await expect(page.getByTestId('mobile-sidebar')).not.toBeVisible();
  });

  test('should close mobile sidebar when clicking close button', async ({ page }) => {
    // Open sidebar
    await page.getByTestId('mobile-menu-button').click();
    await expect(page.getByTestId('mobile-sidebar')).toBeVisible();

    // Click close button
    await page.getByTestId('mobile-menu-close').click();

    // Sidebar should close
    await expect(page.getByTestId('mobile-sidebar')).not.toBeVisible();
  });

  test('should close mobile sidebar when pressing Escape key', async ({ page }) => {
    // Open sidebar
    await page.getByTestId('mobile-menu-button').click();
    await expect(page.getByTestId('mobile-sidebar')).toBeVisible();

    // Press Escape key
    await page.keyboard.press('Escape');

    // Sidebar should close
    await expect(page.getByTestId('mobile-sidebar')).not.toBeVisible();
  });

  test('should close mobile sidebar when navigating to a page', async ({ page }) => {
    // Open sidebar
    await page.getByTestId('mobile-menu-button').click();
    await expect(page.getByTestId('mobile-sidebar')).toBeVisible();

    // Click a navigation link
    await navigation(page).getByTestId('nav-link-settings').click();

    // Sidebar should close automatically
    await expect(page.getByTestId('mobile-sidebar')).not.toBeVisible();

    // URL should change
    await expect(page).toHaveURL(/\/settings/);
  });

  test('should prevent body scroll when mobile sidebar is open', async ({ page }) => {
    // Open sidebar
    await page.getByTestId('mobile-menu-button').click();

    // Body should have overflow hidden
    await expect
      .poll(() => page.evaluate(() => getComputedStyle(document.body).overflow))
      .toBe('hidden');

    // Close sidebar
    await page.getByTestId('mobile-menu-close').click();

    // Body overflow should be restored
    await expect
      .poll(() => page.evaluate(() => getComputedStyle(document.body).overflow))
      .not.toBe('hidden');
  });

  test('should show all navigation items in mobile sidebar', async ({ page }) => {
    // Open sidebar
    await page.getByTestId('mobile-menu-button').click();

    const nav = navigation(page);

    // All items should be accessible
    await expect(nav.getByTestId('nav-link-dashboard')).toBeVisible();
    await expect(nav.getByTestId('nav-link-settings')).toBeVisible();
    await expect(nav.getByTestId('nav-section-admin')).toBeVisible();
    await expect(nav.getByTestId('nav-section-activity')).toBeVisible();
  });

  test('should support collapsible sections in mobile sidebar', async ({ page }) => {
    // Open sidebar
    await page.getByTestId('mobile-menu-button').click();

    const adminSection = navigation(page).getByTestId('nav-section-admin');
    const usersLink = navigation(page).getByTestId('nav-link-users');

    // Get initial visibility
    await expect(usersLink).toBeVisible();
    const initialVisibility = await usersLink.isVisible();

    // Toggle section
    await adminSection.click();
    await expect(usersLink).toBeVisible({ visible: !initialVisibility });

    // Visibility should change
    const newVisibility = await usersLink.isVisible();
    expect(newVisibility).toBe(!initialVisibility);
  });
});

test.describe('Sidebar Navigation - Responsive Breakpoints', () => {
  test('should show desktop sidebar at 768px and above', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 720 });
    await page.goto('/en/dashboard');

    const desktopSidebar = page.getByTestId('dashboard-sidebar').first();
    await expect(desktopSidebar).toBeVisible();

    const mobileMenuButton = page.getByTestId('mobile-menu-button');
    await expect(mobileMenuButton).not.toBeVisible();
  });

  test('should show mobile menu at 767px and below', async ({ page }) => {
    await page.setViewportSize({ width: 767, height: 720 });
    await page.goto('/en/dashboard');

    const desktopSidebar = page.getByTestId('dashboard-sidebar').first();
    await expect(desktopSidebar).not.toBeVisible();

    const mobileMenuButton = page.getByTestId('mobile-menu-button');
    await expect(mobileMenuButton).toBeVisible();
  });

  test('should adjust layout when switching between desktop and mobile', async ({ page }) => {
    // Start desktop
    await page.setViewportSize({ width: 1024, height: 720 });
    await page.goto('/en/dashboard');

    const desktopSidebar = page.getByTestId('dashboard-sidebar').first();
    await expect(desktopSidebar).toBeVisible();

    // Resize to mobile
    await page.setViewportSize({ width: 375, height: 667 });

    // Desktop sidebar should hide
    await expect(desktopSidebar).not.toBeVisible();

    // Mobile menu should appear
    const mobileMenuButton = page.getByTestId('mobile-menu-button');
    await expect(mobileMenuButton).toBeVisible();
  });
});
