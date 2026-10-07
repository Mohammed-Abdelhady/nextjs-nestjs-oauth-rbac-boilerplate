import {
  CREDENTIALS_KEY_PREFIX,
  RECORD_MARKER_SUFFIX,
  STORAGE_KEY_ESCAPE,
  STORAGE_KEY_ESCAPE_DIGITS,
  STORAGE_KEY_SEPARATOR,
} from '../constants';

const HEX_RADIX = 16;

function escapePart(part: string): string {
  return part.replace(
    /[^A-Za-z0-9-]/g,
    (character) =>
      STORAGE_KEY_ESCAPE +
      character.charCodeAt(0).toString(HEX_RADIX).padStart(STORAGE_KEY_ESCAPE_DIGITS, '0'),
  );
}

/**
 * The secure store accepts letters, digits, `.`, `-` and `_` in a key. Every
 * other character is escaped, and so is the separator, so two different sets
 * of parts never share a key.
 */
export function storageKey(prefix: string, ...parts: readonly string[]): string {
  return [prefix, ...parts.map(escapePart)].join(STORAGE_KEY_SEPARATOR);
}

/** The file a shell passes as `recordMarker`, named like the record's key. */
export function recordMarkerFile(clientId: string, environment: string): string {
  return [storageKey(CREDENTIALS_KEY_PREFIX, clientId, environment), RECORD_MARKER_SUFFIX].join(
    STORAGE_KEY_SEPARATOR,
  );
}
