package app.modules.devicekey

import android.security.keystore.KeyPermanentlyInvalidatedException
import expo.modules.kotlin.exception.CodedException

/** The codes `src/constants.ts` names as `NATIVE_ERROR_CODE`. Swift spells the same strings. */
internal object ErrorCode {
  const val UNAVAILABLE = "ERR_DEVICE_KEY_UNAVAILABLE"
  const val NO_HARDWARE = "ERR_DEVICE_KEY_NO_HARDWARE"
  const val NOT_FOUND = "ERR_DEVICE_KEY_NOT_FOUND"
  const val INVALIDATED = "ERR_DEVICE_KEY_INVALIDATED"
  const val INVALID_ALIAS = "ERR_DEVICE_KEY_INVALID_ALIAS"
}

internal class DeviceKeyException(code: String, message: String, cause: Throwable? = null) :
  CodedException(code, message, cause)

/**
 * Gives every failure one of the codes. Only the exception that says the key
 * is gone for good is read as invalidated. The keystore throws many others
 * while it is busy or locked, so they stay unavailable.
 */
internal inline fun <T> guarded(operation: String, block: () -> T): T {
  try {
    return block()
  } catch (error: CodedException) {
    throw error
  } catch (error: KeyPermanentlyInvalidatedException) {
    throw DeviceKeyException(ErrorCode.INVALIDATED, "$operation: the system invalidated the key", error)
  } catch (error: Exception) {
    throw DeviceKeyException(ErrorCode.UNAVAILABLE, "$operation failed: ${error.message}", error)
  }
}
