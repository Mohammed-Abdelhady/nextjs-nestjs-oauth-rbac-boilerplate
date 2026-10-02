import { sanitizeRedirectPath } from './redirect.util';

const DEFAULT_PATH = '/';

// The validator's bound is 512 characters.
const LONGEST_SAFE_PATH = '/' + 'a'.repeat(511);
const LONGEST_UNSAFE_PATH = '/' + 'a'.repeat(512);

describe('sanitizeRedirectPath', () => {
  it.each([
    { label: 'root path', value: '/', expected: '/' },
    { label: 'simple path', value: '/dashboard', expected: '/dashboard' },
    {
      label: 'path with a query',
      value: '/en/settings?tab=security',
      expected: '/en/settings?tab=security',
    },
    {
      label: 'path with a fragment',
      value: '/a/b#section',
      expected: '/a/b#section',
    },
    {
      label: 'path at the length limit',
      value: LONGEST_SAFE_PATH,
      expected: LONGEST_SAFE_PATH,
    },
    {
      label: 'path with an inner double slash',
      value: '/a//b',
      expected: '/a//b',
    },
    {
      label: 'path with a parent segment and a double slash',
      value: '/..//evil.example',
      expected: '/..//evil.example',
    },
    { label: 'empty string', value: '', expected: DEFAULT_PATH },
    { label: 'undefined', value: undefined, expected: DEFAULT_PATH },
    { label: 'null', value: null, expected: DEFAULT_PATH },
    { label: 'number', value: 42, expected: DEFAULT_PATH },
    { label: 'object', value: {}, expected: DEFAULT_PATH },
    {
      label: 'protocol-relative host',
      value: '//evil.example',
      expected: DEFAULT_PATH,
    },
    {
      label: 'slash then backslash host',
      value: '/\\evil.example',
      expected: DEFAULT_PATH,
    },
    {
      label: 'backslash host',
      value: '\\\\evil.example',
      expected: DEFAULT_PATH,
    },
    {
      label: 'absolute https url',
      value: 'https://evil.example',
      expected: DEFAULT_PATH,
    },
    {
      label: 'javascript scheme',
      value: 'javascript:alert(1)',
      expected: DEFAULT_PATH,
    },
    {
      label: 'relative path without a leading slash',
      value: 'dashboard',
      expected: DEFAULT_PATH,
    },
    {
      label: 'path with a space',
      value: '/path with space',
      expected: DEFAULT_PATH,
    },
    { label: 'path with a newline', value: '/a\nb', expected: DEFAULT_PATH },
    { label: 'path with a tab', value: '/a\tb', expected: DEFAULT_PATH },
    {
      label: 'relative path carrying a scheme in its query',
      value: '/redirect?next=https://evil.example',
      expected: DEFAULT_PATH,
    },
    {
      label: 'one character past the length limit',
      value: LONGEST_UNSAFE_PATH,
      expected: DEFAULT_PATH,
    },
  ])('$label is handled as expected', ({ value, expected }) => {
    expect(sanitizeRedirectPath(value)).toBe(expected);
  });
});
