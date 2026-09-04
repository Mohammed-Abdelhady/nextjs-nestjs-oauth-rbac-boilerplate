export const THROTTLE_TTL_15_MIN = 15 * 60 * 1000;

export const THROTTLE_LOGIN_LIMIT = 10;
export const THROTTLE_LOGIN_TTL = THROTTLE_TTL_15_MIN;

export const THROTTLE_FORGOT_PASSWORD_LIMIT = 5;
export const THROTTLE_FORGOT_PASSWORD_TTL = THROTTLE_TTL_15_MIN;

export const THROTTLE_RESET_PASSWORD_LIMIT = 10;
export const THROTTLE_RESET_PASSWORD_TTL = THROTTLE_TTL_15_MIN;

export const THROTTLE_ACTIVATE_LIMIT = 10;
export const THROTTLE_ACTIVATE_TTL = THROTTLE_TTL_15_MIN;

export const THROTTLE_REGISTER_LIMIT = 5;
export const THROTTLE_REGISTER_TTL = THROTTLE_TTL_15_MIN;

export const THROTTLE_LOGIN = {
  default: {
    limit: THROTTLE_LOGIN_LIMIT,
    ttl: THROTTLE_LOGIN_TTL,
  },
} as const;

export const THROTTLE_FORGOT_PASSWORD = {
  default: {
    limit: THROTTLE_FORGOT_PASSWORD_LIMIT,
    ttl: THROTTLE_FORGOT_PASSWORD_TTL,
  },
} as const;

export const THROTTLE_RESET_PASSWORD = {
  default: {
    limit: THROTTLE_RESET_PASSWORD_LIMIT,
    ttl: THROTTLE_RESET_PASSWORD_TTL,
  },
} as const;

export const THROTTLE_ACTIVATE = {
  default: {
    limit: THROTTLE_ACTIVATE_LIMIT,
    ttl: THROTTLE_ACTIVATE_TTL,
  },
} as const;

export const THROTTLE_REGISTER = {
  default: {
    limit: THROTTLE_REGISTER_LIMIT,
    ttl: THROTTLE_REGISTER_TTL,
  },
} as const;
