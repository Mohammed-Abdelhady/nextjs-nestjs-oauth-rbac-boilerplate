import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, type TestInfo } from '@playwright/test';

export async function settleAnimations(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await Promise.all(
      document
        .getAnimations()
        .filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity)
        .map((animation) => animation.finished.catch(() => undefined)),
    );
  });
}

export async function auditAccessibility(page: Page, info: TestInfo, name: string): Promise<void> {
  await settleAnimations(page);
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  await info.attach(`axe-${name}`, {
    body: JSON.stringify({
      violations: result.violations,
      contrast: result.passes.filter((item) => item.id === 'color-contrast'),
    }),
    contentType: 'application/json',
  });
  expect(
    result.violations.map((violation) => ({
      id: violation.id,
      nodes: violation.nodes.map((node) => ({ target: node.target, summary: node.failureSummary })),
    })),
    `${name} automated accessibility violations`,
  ).toEqual([]);
}
