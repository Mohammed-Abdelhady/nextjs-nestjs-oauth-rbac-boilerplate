// @vitest-environment jsdom
import { createRef } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { UNSAFE_MARKUP_PROP } from '@/lib/unsafeMarkup';
import { Description } from './Description';
import { Heading } from './Heading';

const INJECTED_TEST_ID = 'injected-markup';
const UNSAFE_PROPS: Record<string, unknown> = {
  [UNSAFE_MARKUP_PROP]: { __html: `<b data-testid="${INJECTED_TEST_ID}">injected</b>` },
};

afterEach(cleanup);

describe('Heading', () => {
  it.each([
    { level: 1, variant: 'subsectionTitle' },
    { level: 2, variant: 'display' },
    { level: 3, variant: 'pageTitle' },
    { level: 4, variant: 'eyebrow' },
    { level: 5, variant: 'sectionTitle' },
    { level: 6, variant: 'display' },
  ] as const)('renders level $level whatever the visual role ($variant)', ({ level, variant }) => {
    render(
      <Heading level={level} variant={variant}>
        Title
      </Heading>,
    );

    expect(screen.getAllByRole('heading')).toHaveLength(1);
    expect(screen.getByRole('heading', { level }).textContent).toBe('Title');
  });

  it('hands the heading element to a forwarded ref', () => {
    const ref = createRef<HTMLHeadingElement>();

    render(
      <Heading ref={ref} level={3} variant="sectionTitle">
        Title
      </Heading>,
    );

    expect(ref.current).toBe(screen.getByRole('heading', { level: 3 }));
  });

  it('passes id, test id, tab index and ARIA attributes through', () => {
    render(
      <Heading
        level={1}
        variant="display"
        id="login-heading"
        data-testid="login-title"
        tabIndex={-1}
        aria-describedby="login-status"
      >
        Title
      </Heading>,
    );

    const heading = screen.getByTestId('login-title');

    expect(heading.id).toBe('login-heading');
    expect(heading.tabIndex).toBe(-1);
    expect(heading.getAttribute('aria-describedby')).toBe('login-status');
  });

  it('drops raw markup spread in through rest props', () => {
    render(<Heading level={2} variant="sectionTitle" {...UNSAFE_PROPS} />);

    expect(screen.queryByTestId(INJECTED_TEST_ID)).toBeNull();
    expect(screen.getByRole('heading', { level: 2 }).childNodes).toHaveLength(0);
  });
});

describe('Description', () => {
  it.each(['description', 'lead'] as const)('renders a paragraph for the %s role', (variant) => {
    render(
      <Description variant={variant} data-testid="copy">
        Body
      </Description>,
    );

    const paragraph = screen.getByTestId('copy');

    expect(paragraph.tagName).toBe('P');
    expect(paragraph.textContent).toBe('Body');
  });

  it('keeps the id a dialog points at and forwards the ref', () => {
    const ref = createRef<HTMLParagraphElement>();

    render(
      <Description ref={ref} id="welcome-description">
        Body
      </Description>,
    );

    expect(ref.current?.id).toBe('welcome-description');
  });

  it('drops raw markup spread in through rest props', () => {
    render(<Description data-testid="copy" {...UNSAFE_PROPS} />);

    expect(screen.queryByTestId(INJECTED_TEST_ID)).toBeNull();
    expect(screen.getByTestId('copy').childNodes).toHaveLength(0);
  });
});
