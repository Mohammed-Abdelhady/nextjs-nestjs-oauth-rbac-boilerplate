import CryptoKit
import ExpoModulesCore
import Foundation
import Security

/// The values `src/constants.ts` names as `PROTECTION_LEVEL`.
enum KeyProtectionLevel: String {
  case secureEnclave
  case software
}

struct StoredKey {
  /// The X9.63 point: 0x04, then x, then y, 65 bytes for P-256.
  let publicKey: Data
  let protection: KeyProtectionLevel
}

/// One P-256 private key per alias, held as a keychain item. In the Secure
/// Enclave the item is a reference: the key itself never leaves the chip.
enum SecureKeyStore {
  private static let keySizeInBits = 256

  static func read(alias: String) throws -> StoredKey? {
    guard let key = try privateKey(alias: alias) else {
      return nil
    }
    return try describe(key)
  }

  /// Replaces any key with this alias. Two items with one tag would make every later read ambiguous.
  static func generate(alias: String, allowSoftware: Bool) throws -> StoredKey {
    try delete(alias: alias)
    if SecureEnclave.isAvailable {
      do {
        return try describe(create(alias: alias, inSecureEnclave: true))
      } catch {
        // A simulator may say the enclave is there and then refuse to make the key.
        guard allowSoftware else {
          throw error
        }
      }
    } else if !allowSoftware {
      throw DeviceKeyError.make(.noHardware, "This device has no Secure Enclave")
    }
    return try describe(create(alias: alias, inSecureEnclave: false))
  }

  /// Signs the SHA-256 of the data. The system returns the signature as DER.
  static func sign(alias: String, data: Data) throws -> Data {
    guard let key = try privateKey(alias: alias) else {
      throw DeviceKeyError.make(.notFound, "No key has this alias")
    }
    var error: Unmanaged<CFError>?
    guard let signature = SecKeyCreateSignature(
      key,
      .ecdsaSignatureMessageX962SHA256,
      data as CFData,
      &error
    ) else {
      throw DeviceKeyError.from(error: error, during: "Signing")
    }
    return signature as Data
  }

  static func delete(alias: String) throws {
    let query: [String: Any] = [
      kSecClass as String: kSecClassKey,
      kSecAttrKeyType as String: kSecAttrKeyTypeECSECPrimeRandom,
      kSecAttrApplicationTag as String: tag(alias)
    ]
    let status = SecItemDelete(query as CFDictionary)
    guard status == errSecSuccess || status == errSecItemNotFound else {
      throw DeviceKeyError.from(status: status, during: "Deleting the key")
    }
  }

  private static func tag(_ alias: String) -> Data {
    Data(alias.utf8)
  }

  private static func create(alias: String, inSecureEnclave: Bool) throws -> SecKey {
    var accessError: Unmanaged<CFError>?
    // Usable in the background once the device has been unlocked after a start,
    // never copied to a backup or another device. `privateKeyUsage` lets the
    // enclave sign. No biometry or passcode flag, so signing never prompts.
    guard let access = SecAccessControlCreateWithFlags(
      kCFAllocatorDefault,
      kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly,
      inSecureEnclave ? [.privateKeyUsage] : [],
      &accessError
    ) else {
      throw DeviceKeyError.from(error: accessError, during: "Building the access rule")
    }
    var attributes: [String: Any] = [
      kSecAttrKeyType as String: kSecAttrKeyTypeECSECPrimeRandom,
      kSecAttrKeySizeInBits as String: keySizeInBits,
      kSecPrivateKeyAttrs as String: [
        kSecAttrIsPermanent as String: true,
        kSecAttrApplicationTag as String: tag(alias),
        kSecAttrAccessControl as String: access
      ] as [String: Any]
    ]
    if inSecureEnclave {
      attributes[kSecAttrTokenID as String] = kSecAttrTokenIDSecureEnclave
    }
    var error: Unmanaged<CFError>?
    guard let key = SecKeyCreateRandomKey(attributes as CFDictionary, &error) else {
      throw DeviceKeyError.from(error: error, during: "Creating the key")
    }
    return key
  }

  private static func privateKey(alias: String) throws -> SecKey? {
    let query: [String: Any] = [
      kSecClass as String: kSecClassKey,
      kSecAttrKeyClass as String: kSecAttrKeyClassPrivate,
      kSecAttrKeyType as String: kSecAttrKeyTypeECSECPrimeRandom,
      kSecAttrApplicationTag as String: tag(alias),
      kSecReturnRef as String: true
    ]
    var item: CFTypeRef?
    let status = SecItemCopyMatching(query as CFDictionary, &item)
    if status == errSecItemNotFound {
      return nil
    }
    guard status == errSecSuccess, let item, CFGetTypeID(item) == SecKeyGetTypeID() else {
      throw DeviceKeyError.from(status: status, during: "Reading the key")
    }
    // The type id was checked above, and a CoreFoundation type has no conditional cast.
    return unsafeDowncast(item, to: SecKey.self)
  }

  private static func describe(_ key: SecKey) throws -> StoredKey {
    guard let publicKey = SecKeyCopyPublicKey(key) else {
      throw DeviceKeyError.make(.unavailable, "The key has no public half")
    }
    var error: Unmanaged<CFError>?
    guard let point = SecKeyCopyExternalRepresentation(publicKey, &error) else {
      throw DeviceKeyError.from(error: error, during: "Exporting the public key")
    }
    let attributes = SecKeyCopyAttributes(key) as? [String: Any]
    let token = attributes?[kSecAttrTokenID as String] as? String
    let inEnclave = token == (kSecAttrTokenIDSecureEnclave as String)
    return StoredKey(publicKey: point as Data, protection: inEnclave ? .secureEnclave : .software)
  }
}
