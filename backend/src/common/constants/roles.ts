/**
 * Shape of a role slug: lowercase words joined by single hyphens.
 * Matches what RoleService derives from a role name.
 */
export const ROLE_SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Validation message for a slug that does not match ROLE_SLUG_REGEX.
 */
export const ROLE_SLUG_MESSAGE =
  'Role must be a lowercase slug such as "support" or "content-editor"';

/**
 * Upper bound for a slug, derived from the 50 character role name limit.
 */
export const ROLE_SLUG_MAX_LENGTH = 50;
