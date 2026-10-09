import ExpoModulesCore
import Foundation
import Security

/// The codes `src/constants.ts` names as `NATIVE_ERROR_CODE`. Kotlin spells the same strings.
enum DeviceKeyErrorCode: String {
  case unavailable = "ERR_DEVICE_KEY_UNAVAILABLE"
  case noHardware = "ERR_DEVICE_KEY_NO_HARDWARE"
  case notFound = "ERR_DEVICE_KEY_NOT_FOUND"
  case invalidated = "ERR_DEVICE_KEY_INVALIDATED"
  case invalidAlias = "ERR_DEVICE_KEY_INVALID_ALIAS"
}

enum DeviceKeyError {
  static func make(_ code: DeviceKeyErrorCode, _ detail: String) -> Exception {
    Exception(name: "DeviceKeyException", description: detail, code: code.rawValue)
  }

  /// A status the keychain returned. Only the two that mean the key is gone
  /// for good get their own code. Everything else may pass, so it stays unavailable.
  static func from(status: OSStatus, during operation: String) -> Exception {
    let text = (SecCopyErrorMessageString(status, nil) as String?) ?? "unknown"
    let detail = "\(operation) failed with status \(status): \(text)"
    switch status {
    case errSecItemNotFound:
      return make(.notFound, detail)
    case errSecAuthFailed:
      return make(.invalidated, detail)
    default:
      // Includes errSecInteractionNotAllowed: the device has not been unlocked since it started.
      return make(.unavailable, detail)
    }
  }

  static func from(error: Unmanaged<CFError>?, during operation: String) -> Exception {
    guard let error = error?.takeRetainedValue() else {
      return make(.unavailable, "\(operation) failed without an error")
    }
    let domain = CFErrorGetDomain(error) as String
    guard domain == NSOSStatusErrorDomain else {
      return make(.unavailable, "\(operation) failed in \(domain) with code \(CFErrorGetCode(error))")
    }
    return from(status: OSStatus(truncatingIfNeeded: CFErrorGetCode(error)), during: operation)
  }
}
