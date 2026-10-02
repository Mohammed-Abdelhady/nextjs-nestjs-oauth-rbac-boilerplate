import { decideOrigin } from './request-origin';
import { FETCH_SITE } from '../constants/browser-proof';

const ALLOWED_ORIGINS = ['http://127.0.0.1:3107/app'];

const CASES = [
  {
    name: 'allows requests with no browser origin metadata',
    input: {
      originHeader: '',
      refererHeader: '',
      fetchSite: '',
      allowedOrigins: ALLOWED_ORIGINS,
    },
    expected: { ok: true },
  },
  {
    name: 'allows a listed Origin with same-origin metadata',
    input: {
      originHeader: 'http://127.0.0.1:3107',
      refererHeader: '',
      fetchSite: FETCH_SITE.SAME_ORIGIN,
      allowedOrigins: ALLOWED_ORIGINS,
    },
    expected: { ok: true },
  },
  {
    name: 'allows a listed Referer with none metadata',
    input: {
      originHeader: '   ',
      refererHeader: 'http://127.0.0.1:3107/login',
      fetchSite: FETCH_SITE.NONE,
      allowedOrigins: ALLOWED_ORIGINS,
    },
    expected: { ok: true },
  },
  {
    name: 'allows same-origin metadata without Origin or Referer',
    input: {
      originHeader: '',
      refererHeader: '',
      fetchSite: FETCH_SITE.SAME_ORIGIN,
      allowedOrigins: ALLOWED_ORIGINS,
    },
    expected: { ok: true },
  },
  {
    name: 'allows none metadata without Origin or Referer',
    input: {
      originHeader: '',
      refererHeader: '',
      fetchSite: FETCH_SITE.NONE,
      allowedOrigins: ALLOWED_ORIGINS,
    },
    expected: { ok: true },
  },
  {
    name: 'rejects cross-site metadata even with a listed Origin',
    input: {
      originHeader: 'http://127.0.0.1:3107',
      refererHeader: '',
      fetchSite: FETCH_SITE.CROSS_SITE,
      allowedOrigins: ALLOWED_ORIGINS,
    },
    expected: { ok: false, reason: 'cross-site' },
  },
  {
    name: 'allows same-site metadata with a listed Origin',
    input: {
      originHeader: 'http://127.0.0.1:3107',
      refererHeader: '',
      fetchSite: FETCH_SITE.SAME_SITE,
      allowedOrigins: ALLOWED_ORIGINS,
    },
    expected: { ok: true },
  },
  {
    name: 'allows same-site metadata with a listed Referer',
    input: {
      originHeader: '',
      refererHeader: 'http://127.0.0.1:3107/login',
      fetchSite: FETCH_SITE.SAME_SITE,
      allowedOrigins: ALLOWED_ORIGINS,
    },
    expected: { ok: true },
  },
  {
    name: 'rejects same-site metadata without Origin or Referer',
    input: {
      originHeader: '',
      refererHeader: '',
      fetchSite: FETCH_SITE.SAME_SITE,
      allowedOrigins: ALLOWED_ORIGINS,
    },
    expected: { ok: false, reason: 'missing-origin' },
  },
  {
    name: 'rejects same-site metadata with a foreign Origin',
    input: {
      originHeader: 'https://evil.example',
      refererHeader: 'http://127.0.0.1:3107/login',
      fetchSite: FETCH_SITE.SAME_SITE,
      allowedOrigins: ALLOWED_ORIGINS,
    },
    expected: { ok: false, reason: 'unlisted' },
  },
  {
    name: 'rejects a foreign Origin without Fetch Metadata',
    input: {
      originHeader: 'https://evil.example',
      refererHeader: '',
      fetchSite: '',
      allowedOrigins: ALLOWED_ORIGINS,
    },
    expected: { ok: false, reason: 'unlisted' },
  },
  {
    name: 'rejects a null Origin even when the Referer is listed',
    input: {
      originHeader: 'null',
      refererHeader: 'http://127.0.0.1:3107/',
      fetchSite: '',
      allowedOrigins: ALLOWED_ORIGINS,
    },
    expected: { ok: false, reason: 'null-origin' },
  },
  {
    name: 'rejects a malformed Referer',
    input: {
      originHeader: '',
      refererHeader: 'not a url',
      fetchSite: '',
      allowedOrigins: ALLOWED_ORIGINS,
    },
    expected: { ok: false, reason: 'unlisted' },
  },
  {
    name: 'rejects a listed Origin when no origins are configured',
    input: {
      originHeader: 'http://127.0.0.1:3107',
      refererHeader: '',
      fetchSite: '',
      allowedOrigins: [],
    },
    expected: { ok: false, reason: 'unlisted' },
  },
];

describe.each(CASES)('decideOrigin: $name', ({ input, expected }) => {
  it('returns the hand-written decision', () => {
    expect(decideOrigin(input)).toEqual(expected);
  });
});
