/**
 * Fields stripped from a user document before it leaves the user endpoints.
 */
export const USER_HIDDEN_FIELDS =
  '-password -verificationToken -verificationExpires -resetPasswordToken -resetPasswordExpires';

/**
 * Password hashing cost for self-service password changes.
 */
export const PASSWORD_SALT_ROUNDS = 12;
