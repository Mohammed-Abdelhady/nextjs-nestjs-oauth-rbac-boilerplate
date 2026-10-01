import { isAcceptableRedirectUri } from './redirect-uri.util';

describe('isAcceptableRedirectUri', () => {
  it.each([
    {
      label: 'HTTPS callback',
      value: 'https://client.example/callback',
      expected: true,
    },
    {
      label: 'localhost HTTP callback',
      value: 'http://localhost:3000/callback',
      expected: true,
    },
    {
      label: '127/8 HTTP callback',
      value: 'http://127.255.255.255/callback',
      expected: true,
    },
    {
      label: 'IPv6 loopback callback',
      value: 'http://[::1]:3000/callback',
      expected: true,
    },
    { label: 'custom app scheme', value: 'myapp://callback', expected: true },
    {
      label: 'opaque custom app scheme',
      value: 'com.example.app:/callback',
      expected: true,
    },
    { label: 'empty string', value: '', expected: false },
    { label: 'malformed URL', value: 'not a URL', expected: false },
    { label: 'fragment', value: 'myapp://callback#section', expected: false },
    { label: 'empty fragment', value: 'myapp://callback#', expected: false },
    {
      label: 'javascript scheme',
      value: 'javascript:alert(1)',
      expected: false,
    },
    {
      label: 'mixed-case javascript scheme',
      value: 'JaVaScRiPt:alert(1)',
      expected: false,
    },
    { label: 'data scheme', value: 'data:text/html,blocked', expected: false },
    { label: 'vbscript scheme', value: 'vbscript:alert(1)', expected: false },
    {
      label: 'blob scheme',
      value: 'blob:https://client.example/id',
      expected: false,
    },
    { label: 'file scheme', value: 'file:///tmp/callback', expected: false },
    {
      label: 'remote HTTP host',
      value: 'http://client.example/callback',
      expected: false,
    },
    {
      label: 'private HTTP host',
      value: 'http://192.168.1.10/callback',
      expected: false,
    },
  ])('$label is classified as expected', ({ value, expected }) => {
    expect(isAcceptableRedirectUri(value)).toBe(expected);
  });
});
