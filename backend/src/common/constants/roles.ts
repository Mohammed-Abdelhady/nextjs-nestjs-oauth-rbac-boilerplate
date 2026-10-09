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

/** Maximum post-commit passes to move holders missed by a role edit snapshot. */
export const ROLE_HOLDER_SWEEP_PASSES = 3;

export const ROLE_SWEEP_PENDING = 'role_holder_sweep_pending';
export const ROLE_SWEEP_SLUG_REUSED = 'role_holder_sweep_slug_reused';

export const ROLE_PENDING_SWEEP_LIMIT = 16;
export const ROLE_SWEEP_BOOTSTRAP_LIMIT = 16;
export const ROLE_SWEEP_BOOTSTRAP_FAILED = 'role_holder_sweep_bootstrap_failed';
export const ROLE_SWEEP_BOOTSTRAP_FINISHED =
  'role_holder_sweep_bootstrap_finished';
export const ROLE_SWEEP_BOOTSTRAP_BUDGET_MS = 30_000;
export const ROLE_SWEEP_BOOTSTRAP_BUDGET_EXHAUSTED =
  'role_holder_sweep_bootstrap_budget_exhausted';
