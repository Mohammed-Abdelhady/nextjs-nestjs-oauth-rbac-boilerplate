export const NAME_MIN_LENGTH = 2;

export const NAME_MAX_LENGTH = 80;

/**
 * Letters in any script with their combining marks, digits, spaces,
 * apostrophes, hyphens and dots. Everything else, including the characters
 * that carry meaning in HTML, is rejected.
 */
export const NAME_REGEX = /^[\p{L}\p{M}0-9 '’.-]+$/u;

export const NAME_MESSAGE =
  'Name may only contain letters, digits, spaces, apostrophes, hyphens and dots';
