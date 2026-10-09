import {
  isAcceptableRedirectUri,
  matchesRegisteredRedirectUri,
} from './redirect-uri.util';

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

  it.each([
    {
      label: 'custom scheme in production without the setting',
      value: 'myapp://callback',
      expected: false,
    },
    {
      label: 'https in production without the setting',
      value: 'https://client.example/callback',
      expected: true,
    },
    {
      label: 'loopback http in production without the setting',
      value: 'http://127.0.0.1:3000/callback',
      expected: true,
    },
    {
      label: 'remote http in production without the setting',
      value: 'http://client.example/callback',
      expected: false,
    },
  ])('$label', ({ value, expected }) => {
    expect(
      isAcceptableRedirectUri(value, {
        nodeEnv: 'production',
        allowCustomScheme: false,
      }),
    ).toBe(expected);
  });

  it.each([
    {
      label: 'custom scheme in production with the setting on',
      value: 'myapp://callback',
      expected: true,
    },
    {
      label: 'remote http stays refused with the setting on',
      value: 'http://client.example/callback',
      expected: false,
    },
  ])('$label', ({ value, expected }) => {
    expect(
      isAcceptableRedirectUri(value, {
        nodeEnv: 'production',
        allowCustomScheme: true,
      }),
    ).toBe(expected);
  });

  it('keeps custom schemes accepted outside production', () => {
    expect(
      isAcceptableRedirectUri('myapp://callback', { nodeEnv: 'test' }),
    ).toBe(true);
  });
});

describe('matchesRegisteredRedirectUri', () => {
  it.each([
    {
      label: 'loopback with a different port',
      registered: 'http://127.0.0.1:3000/callback',
      requested: 'http://127.0.0.1:4567/callback',
      expected: true,
    },
    {
      label: 'loopback without a registered port',
      registered: 'http://localhost/callback',
      requested: 'http://localhost:9100/callback',
      expected: true,
    },
    {
      label: 'ipv6 loopback with a different port',
      registered: 'http://[::1]:3000/callback',
      requested: 'http://[::1]:8080/callback',
      expected: true,
    },
    {
      label: 'dotted-less ipv4 loopback with a different port',
      registered: 'http://127.1:3000/callback',
      requested: 'http://127.1:4567/callback',
      expected: true,
    },
    {
      label: 'hex ipv4 loopback with a different port',
      registered: 'http://0x7f.1:3000/callback',
      requested: 'http://0x7f.1:4567/callback',
      expected: true,
    },
    {
      label: 'integer ipv4 loopback with a different port',
      registered: 'http://2130706433:3000/callback',
      requested: 'http://2130706433:4567/callback',
      expected: true,
    },
    {
      label: 'trailing-dot ipv4 loopback with a different port',
      registered: 'http://127.0.0.1.:3000/callback',
      requested: 'http://127.0.0.1.:4567/callback',
      expected: true,
    },
    {
      label: 'upper-case localhost with a different port',
      registered: 'http://LOCALHOST:3000/callback',
      requested: 'http://localhost:4567/callback',
      expected: true,
    },
    {
      label: 'subdomain localhost matches exactly',
      registered: 'http://app.localhost:3000/callback',
      requested: 'http://app.localhost:3000/callback',
      expected: true,
    },
    {
      label: 'loopback with a different path is refused',
      registered: 'http://127.0.0.1:3000/callback',
      requested: 'http://127.0.0.1:4567/other',
      expected: false,
    },
    {
      label: 'loopback with a different host is refused',
      registered: 'http://127.0.0.1:3000/callback',
      requested: 'http://localhost:3000/callback',
      expected: false,
    },
    {
      label: 'localhost does not accept the ipv4 loopback',
      registered: 'http://localhost:3000/callback',
      requested: 'http://127.0.0.1:4000/callback',
      expected: false,
    },
    {
      label: 'ipv6 loopback does not accept the ipv4 loopback',
      registered: 'http://[::1]:3000/callback',
      requested: 'http://127.0.0.1:4000/callback',
      expected: false,
    },
    {
      label: 'a suffix host is not the loopback host',
      registered: 'http://127.0.0.1/callback',
      requested: 'http://127.0.0.1.evil.example/callback',
      expected: false,
    },
    {
      label: 'subdomain localhost with a different port is refused',
      registered: 'http://app.localhost:3000/callback',
      requested: 'http://app.localhost:4567/callback',
      expected: false,
    },
    {
      label: 'ipv4-mapped ipv6 loopback with a different port is refused',
      registered: 'http://[::ffff:127.0.0.1]:3000/callback',
      requested: 'http://[::ffff:127.0.0.1]:4567/callback',
      expected: false,
    },
    {
      label: 'trailing-dot localhost with a different port is refused',
      registered: 'http://localhost:3000/callback',
      requested: 'http://localhost.:4567/callback',
      expected: false,
    },
    {
      label:
        'another 127/8 address is refused against a 127.0.0.1 registration',
      registered: 'http://127.0.0.1:3000/callback',
      requested: 'http://127.0.0.2:4567/callback',
      expected: false,
    },
    {
      label: 'loopback with a different query is refused',
      registered: 'http://127.0.0.1:3000/callback',
      requested: 'http://127.0.0.1:4567/callback?from=elsewhere',
      expected: false,
    },
    {
      label: 'loopback with a fragment is refused',
      registered: 'http://127.0.0.1:3000/callback',
      requested: 'http://127.0.0.1:4567/callback#section',
      expected: false,
    },
    {
      label: 'a fragment on the registered side is refused',
      registered: 'http://127.0.0.1:3000/callback#section',
      requested: 'http://127.0.0.1:3000/callback#section',
      expected: false,
    },
    {
      label: 'userinfo that smuggles a host is not the loopback host',
      registered: 'http://127.0.0.1/callback',
      requested: 'http://127.0.0.1@evil.example/callback',
      expected: false,
    },
    {
      label: 'loopback with a different scheme is refused',
      registered: 'http://127.0.0.1:3000/callback',
      requested: 'https://127.0.0.1:3000/callback',
      expected: false,
    },
    {
      label: 'custom scheme matches exactly',
      registered: 'myapp://callback',
      requested: 'myapp://callback',
      expected: true,
    },
    {
      label: 'custom scheme with an extra suffix is refused',
      registered: 'myapp://callback',
      requested: 'myapp://callback.evil',
      expected: false,
    },
    {
      label: 'https with a different port is refused',
      registered: 'https://client.example/callback',
      requested: 'https://client.example:8443/callback',
      expected: false,
    },
    {
      label: 'malformed requested address is refused',
      registered: 'http://127.0.0.1:3000/callback',
      requested: 'not a url',
      expected: false,
    },
  ])('$label', ({ registered, requested, expected }) => {
    expect(matchesRegisteredRedirectUri(registered, requested)).toBe(expected);
  });
});
