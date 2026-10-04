export const NAME_MIN_LENGTH = 2;

export const NAME_MAX_LENGTH = 100;

/**
 * The one name rule, shared with shared/core zodName (which trims and
 * normalises to NFC through its own pipeline) and the signup form, which
 * builds on the same zodName export; keep them in step. Length counts
 * code points, not UTF-16 units, and whitespace is a literal space only,
 * so no line break or invisible character can hide inside a name. That
 * leaves: letters in any script with their combining marks, digits,
 * spaces, apostrophes (straight and curly), hyphens and dots. Everything
 * else, including the characters that carry meaning in HTML, is rejected.
 */
export const NAME_REGEX = /^[\p{L}\p{M}0-9 ’'.-]+$/u;

/** A name without a single letter is not a person name. */
export const NAME_HAS_LETTER_REGEX = /\p{L}/u;

/** The message for a name that is too short or too long. */
export const NAME_LENGTH_MESSAGE = `Name must be ${NAME_MIN_LENGTH} to ${NAME_MAX_LENGTH} characters`;

/** The message for a name whose characters the rule does not allow. */
export const NAME_MESSAGE =
  'Name may only contain letters, digits, spaces, apostrophes, hyphens and dots';

/** The message for input that has allowed characters but no letter. */
export const NAME_NO_LETTER_MESSAGE = 'Name must include at least one letter';

export const NAME_REQUIRED_MESSAGE = 'Name is required';

export const NAME_TYPE_MESSAGE = 'Name must be a string';
