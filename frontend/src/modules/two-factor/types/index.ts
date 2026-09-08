/** What setup hands back for the authenticator app. */
export interface TwoFactorSetup {
  /** URL to render as a QR code. */
  otpauthUrl: string;
  /** The same secret in base32, for entering by hand. */
  secret: string;
}

/** Recovery codes, readable only in the reply that creates them. */
export interface RecoveryCodes {
  recoveryCodes: string[];
}

/** One of the two ways to answer a challenge. Exactly one field is sent. */
export interface TwoFactorAnswer {
  code?: string;
  recoveryCode?: string;
}

/** Turning the factor off also needs the password, on accounts that have one. */
export interface DisableTwoFactorRequest extends TwoFactorAnswer {
  password?: string;
}

/** The steps of the setup dialog, in order. */
export const SETUP_STEP = {
  REAUTH: 'reauth',
  SCAN: 'scan',
  CONFIRM: 'confirm',
  RECOVERY_CODES: 'recoveryCodes',
} as const;

export type SetupStep = (typeof SETUP_STEP)[keyof typeof SETUP_STEP];
