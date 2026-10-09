import { describe, expect, it } from 'vitest';
import { createActivationSchema } from '../../../utils/activationSchema';

/**
 * The signup column of the name-rule table. The backend carries the same
 * rows through the real validation pipe (name-policy.decorator.spec.ts);
 * this file asserts them against the activation form's real schema, so
 * both sides accept and reject the same names. Every expected value is
 * hand-written.
 */
const CASES: Array<{ name: string; expected: 'accept' | 'reject'; why: string }> = [
  { name: '', expected: 'reject', why: 'empty' },
  { name: '   ', expected: 'reject', why: 'spaces only' },
  { name: 'A', expected: 'reject', why: 'one character' },
  { name: 'Bo', expected: 'accept', why: 'minimum length' },
  { name: 'a'.repeat(100), expected: 'accept', why: 'maximum length' },
  { name: 'a'.repeat(101), expected: 'reject', why: 'maximum plus one' },
  { name: 'a'.repeat(81), expected: 'accept', why: 'length the old cap refused' },
  { name: '\u0623\u062d\u0645\u062f', expected: 'accept', why: 'letters outside A-Z' },
  {
    name: '\u0645\u064f\u062d\u064e\u0645\u0651\u064e\u062f',
    expected: 'accept',
    why: 'letters with combining marks',
  },
  { name: '\u5c71\u7530\u592a\u90ce', expected: 'accept', why: 'CJK letters' },
  { name: '\u{1F600}\u{1F600}', expected: 'reject', why: 'emoji' },
  { name: '<b>', expected: 'reject', why: 'HTML' },
  { name: 'user@example.com', expected: 'reject', why: 'address as name' },
  { name: 'john_doe', expected: 'reject', why: 'underscore' },
  { name: 'Layla\tHaddad', expected: 'reject', why: 'tab' },
  { name: 'Bob\nAdmin', expected: 'reject', why: 'line feed' },
  { name: 'Bob\r\nBcc', expected: 'reject', why: 'crlf' },
  { name: 'Bob\u2028Lee', expected: 'reject', why: 'line separator' },
  { name: 'Bo\ufeffb', expected: 'reject', why: 'zero width no-break space' },
  { name: 'Bo\u000b\u000cb', expected: 'reject', why: 'vertical tab and form feed' },
  {
    name: `a${'\u0301'.repeat(99)}`,
    expected: 'accept',
    why: 'one letter with 99 combining marks',
  },
  { name: '\u0301\u0301', expected: 'reject', why: 'only combining marks' },
  { name: "'-.", expected: 'reject', why: 'only punctuation' },
  { name: '12', expected: 'reject', why: 'only digits' },
  { name: '\u{20000}', expected: 'reject', why: 'one astral code point' },
  {
    name: '\u{20000}'.repeat(51),
    expected: 'accept',
    why: '51 astral code points',
  },
  { name: '  John Doe  ', expected: 'accept', why: 'padded' },
  { name: 'Jos\u00e9', expected: 'accept', why: 'precomposed accent' },
  { name: 'Jose\u0301', expected: 'accept', why: 'decomposed accent' },
  {
    name: '\u1100\u1161',
    expected: 'reject',
    why: 'hangul jamo pair composes to one code point',
  },
  { name: '\u0958', expected: 'accept', why: 'NFC expands it to two' },
  {
    name: '\u0958'.repeat(51),
    expected: 'reject',
    why: 'NFC expansion makes 102 code points',
  },
  {
    name: '\u0958'.repeat(100),
    expected: 'reject',
    why: 'NFC expansion makes 200 code points',
  },
  {
    name: 'e\u0301'.repeat(51),
    expected: 'accept',
    why: 'NFC composes each pair: 51 code points',
  },
  {
    name: `a${'\u0301'.repeat(100)}`,
    expected: 'accept',
    why: 'the first mark composes, then 99 marks: 100 code points',
  },
];

const schema = createActivationSchema(
  (key) => key,
  (key) => key,
);

const BODY = {
  email: 'layla@example.com',
  code: '000000',
  password: 'Passw0rdLayla',
  confirmPassword: 'Passw0rdLayla',
};

describe('the signup name rule', () => {
  it.each(CASES)('$why', ({ name, expected }) => {
    const result = schema.safeParse({ ...BODY, name });
    const nameRejected = !result.success
      ? result.error.issues.some((issue) => issue.path[0] === 'name')
      : false;
    expect(nameRejected ? 'reject' : 'accept').toBe(expected);
  });

  it.each([true, 12, null, ['ab'], { a: 1 }])('refuses non-string input %j', (name) => {
    expect(schema.safeParse({ ...BODY, name }).success).toBe(false);
  });

  it.each([
    ['  John Doe  ', 'John Doe'],
    ['Jose\u0301', 'Jos\u00e9'],
  ])('sends the normalised name %s', (name, stored) => {
    expect(schema.parse({ ...BODY, name }).name).toBe(stored);
  });
});
