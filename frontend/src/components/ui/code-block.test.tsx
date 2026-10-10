// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { CodeBlock } from './code-block';

afterEach(cleanup);

it.each(['ltr', 'rtl'] as const)('keeps code LTR within a %s container', (dir) => {
  render(
    <div dir={dir}>
      <CodeBlock testId="sample">{'const x = 1;'}</CodeBlock>
    </div>,
  );
  expect(screen.getByTestId('sample').getAttribute('dir')).toBe('ltr');
});

it('keeps direction for an empty sample', () => {
  render(<CodeBlock testId="sample">{''}</CodeBlock>);
  expect(screen.getByTestId('sample').getAttribute('dir')).toBe('ltr');
});
