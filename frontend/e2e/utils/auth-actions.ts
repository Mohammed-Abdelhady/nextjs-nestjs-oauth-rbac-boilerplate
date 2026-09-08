import { expect, type Page } from '@playwright/test';

export type AppLocale = 'en' | 'ar';
export type AuthRoute = 'login' | 'register' | 'forgot-password' | 'reset-password';

export class AnonymousAuthActions {
  constructor(
    readonly page: Page,
    readonly locale: AppLocale,
    readonly hasTouch: boolean,
  ) {}

  path(route: AuthRoute): string {
    return `/${this.locale}/auth/${route}`;
  }

  async open(route: AuthRoute, query = ''): Promise<void> {
    await this.page.goto(`${this.path(route)}${query}`);
  }

  async expectRoute(route: AuthRoute): Promise<void> {
    await expect(this.page).toHaveURL((url) => url.pathname === this.path(route));
  }

  async activateLink(testId: string): Promise<void> {
    const link = this.page.getByTestId(testId);
    if (this.hasTouch) {
      await link.tap();
    } else {
      await link.click();
    }
  }

  async expectInvalid(testIds: readonly string[]): Promise<void> {
    for (const id of testIds) {
      const input = this.page.getByTestId(id);
      await expect(input).toHaveAttribute('aria-invalid', 'true');
      await expect(input).toHaveAccessibleName(/\S+/);
      await expect(input).toHaveAccessibleDescription(/\S+/);
    }
  }
}
