/**
 * Transforms string representations of booleans and boolean values into boolean.
 * Handles 'true' / 'false' (case-insensitive), '1' / '0', booleans, and empty values.
 * Returns the original value for invalid inputs so class-validator can reject them.
 *
 * @param input - Raw input value or transform parameters object
 * @returns Parsed boolean, undefined when empty, or original value when unparsed
 */
export function toBoolean(input: unknown): unknown {
  const value =
    typeof input === 'object' && input !== null && 'value' in input
      ? (input as { value: unknown }).value
      : input;

  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true' || normalized === '1') {
      return true;
    }
    if (normalized === 'false' || normalized === '0') {
      return false;
    }
  }

  if (typeof value === 'number') {
    if (value === 1) {
      return true;
    }
    if (value === 0) {
      return false;
    }
  }

  return value;
}
