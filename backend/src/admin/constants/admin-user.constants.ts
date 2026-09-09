/**
 * Fields stripped from every user document the admin endpoints return.
 */
export const ADMIN_USER_HIDDEN_FIELDS =
  '-password -verificationToken -verificationExpires -resetPasswordToken -resetPasswordExpires';

/**
 * Password hashing cost for admin-created accounts.
 */
export const ADMIN_PASSWORD_SALT_ROUNDS = 12;
