import { getAllowedNativeAuthorizeContinuation } from './magic-link-continuation.util';

describe('getAllowedNativeAuthorizeContinuation', () => {
  it.each([
    {
      label: 'English native route',
      value: '/en/auth/native/authorize?transaction=abc-123',
      expected: '/en/auth/native/authorize?transaction=abc-123',
    },
    {
      label: 'Arabic native route',
      value: '/ar/auth/native/authorize?transaction=abc-123',
      expected: '/ar/auth/native/authorize?transaction=abc-123',
    },
    {
      label: 'route without locale',
      value: '/auth/native/authorize?transaction=abc-123',
      expected: '/auth/native/authorize?transaction=abc-123',
    },
    {
      label: 'different query key',
      value: '/en/auth/native/authorize?other=abc-123',
      expected: undefined,
    },
    {
      label: 'extra query key',
      value: '/en/auth/native/authorize?transaction=abc&extra=yes',
      expected: undefined,
    },
    {
      label: 'empty transaction value',
      value: '/en/auth/native/authorize?transaction=',
      expected: undefined,
    },
    {
      label: 'repeated query key',
      value: '/en/auth/native/authorize?transaction=a&transaction=b',
      expected: undefined,
    },
    {
      label: 'fragment',
      value: '/en/auth/native/authorize?transaction=abc#section',
      expected: undefined,
    },
    {
      label: 'another auth path',
      value: '/en/auth/login?transaction=abc-123',
      expected: undefined,
    },
    {
      label: 'normalized locale traversal path',
      value: '/en/../ar/auth/native/authorize?transaction=abc-123',
      expected: undefined,
    },
    {
      label: 'normalized route traversal path',
      value: '/en/auth/native/authorize/..?transaction=abc-123',
      expected: undefined,
    },
    {
      label: 'scheme',
      value: 'https://client.invalid/en/auth/native/authorize?transaction=abc',
      expected: undefined,
    },
    {
      label: 'double slash',
      value: '//client.invalid/en/auth/native/authorize?transaction=abc',
      expected: undefined,
    },
    {
      label: 'backslash',
      value: '\\client.invalid\\en\\auth\\native\\authorize?transaction=abc',
      expected: undefined,
    },
    {
      label: 'absolute URL',
      value: 'https://client.invalid/',
      expected: undefined,
    },
    { label: 'empty value', value: '', expected: undefined },
    {
      label: '2,000-character value',
      value: `/en/auth/native/authorize?transaction=${'x'.repeat(1962)}`,
      expected: undefined,
    },
  ])('$label is handled as expected', ({ value, expected }) => {
    expect(getAllowedNativeAuthorizeContinuation(value)).toBe(expected);
  });
});
