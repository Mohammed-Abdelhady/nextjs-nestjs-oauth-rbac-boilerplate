import { toBoolean } from './transform';

describe('toBoolean', () => {
  it('maps "true" string to true', () => {
    expect(toBoolean('true')).toBe(true);
    expect(toBoolean('TRUE')).toBe(true);
    expect(toBoolean('True')).toBe(true);
    expect(toBoolean(' true ')).toBe(true);
  });

  it('maps "false" string to false', () => {
    expect(toBoolean('false')).toBe(false);
    expect(toBoolean('FALSE')).toBe(false);
    expect(toBoolean('False')).toBe(false);
    expect(toBoolean(' false ')).toBe(false);
  });

  it('maps "1" and "0" strings to booleans', () => {
    expect(toBoolean('1')).toBe(true);
    expect(toBoolean('0')).toBe(false);
  });

  it('preserves boolean primitives', () => {
    expect(toBoolean(true)).toBe(true);
    expect(toBoolean(false)).toBe(false);
  });

  it('maps 1 and 0 numbers to booleans', () => {
    expect(toBoolean(1)).toBe(true);
    expect(toBoolean(0)).toBe(false);
  });

  it('returns undefined for empty or missing inputs', () => {
    expect(toBoolean(undefined)).toBeUndefined();
    expect(toBoolean(null)).toBeUndefined();
    expect(toBoolean('')).toBeUndefined();
  });

  it('extracts value from object with value property', () => {
    expect(toBoolean({ value: 'true' })).toBe(true);
    expect(toBoolean({ value: 'false' })).toBe(false);
    expect(toBoolean({ value: false })).toBe(false);
    expect(toBoolean({ value: undefined })).toBeUndefined();
  });

  it('returns unparsed value for invalid non-boolean strings', () => {
    expect(toBoolean('invalid')).toBe('invalid');
    expect(toBoolean('not-a-bool')).toBe('not-a-bool');
  });

  it('returns unparsed value for unexpected non-boolean numbers', () => {
    expect(toBoolean(42)).toBe(42);
    expect(toBoolean(-1)).toBe(-1);
  });
});
