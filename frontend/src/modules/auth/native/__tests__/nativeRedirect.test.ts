import { describe, expect, it } from 'vitest';
import { isSafeNativeRedirect } from '../nativeRedirect';

describe('isSafeNativeRedirect', () => {
  it.each([
    'myapp://callback?code=abc&state=xyz',
    'com.example.app:/oauth/callback',
    'https://app.example.com/callback',
    'http://localhost:3000/callback',
    '  https://app.example.com/callback  ',
  ])('accepts the app redirect %s', (address) => {
    expect(isSafeNativeRedirect(address)).toBe(true);
  });

  it.each([
    ['javascript scheme', 'javascript:alert(document.domain)'],
    ['mixed-case javascript scheme', 'JaVaScRiPt:alert(1)'],
    ['javascript scheme split by a newline', 'java\nscript:alert(1)'],
    ['javascript scheme split by a tab', 'java\tscript:alert(1)'],
    ['javascript scheme behind a NUL', '\u0000javascript:alert(1)'],
    ['data scheme', 'data:text/html,<script>alert(1)</script>'],
    ['vbscript scheme', 'vbscript:msgbox(1)'],
    ['blob scheme', 'blob:https://app.example.com/id'],
    ['file scheme', 'file:///etc/passwd'],
  ])('refuses the %s', (_label, address) => {
    expect(isSafeNativeRedirect(address)).toBe(false);
  });

  it.each([
    ['empty', ''],
    ['whitespace only', '   '],
    ['a relative path', '/callback?code=abc'],
    ['a plain word', 'callback'],
  ])('refuses %s', (_label, address) => {
    expect(isSafeNativeRedirect(address)).toBe(false);
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['a number', 42],
    ['an object', { href: 'myapp://callback' }],
  ])('refuses a non-string address (%s)', (_label, address) => {
    expect(isSafeNativeRedirect(address)).toBe(false);
  });
});
