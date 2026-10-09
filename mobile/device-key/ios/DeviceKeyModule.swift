import ExpoModulesCore
import Foundation

/// The native half of `@app/device-key`. Bytes cross as base64 text, and every
/// conversion of what the system returns happens in TypeScript.
public class DeviceKeyModule: Module {
  public func definition() -> ModuleDefinition {
    Name("AppDeviceKey")

    AsyncFunction("getKeyAsync") { (alias: String) -> [String: String]? in
      try SecureKeyStore.read(alias: checked(alias)).map(record)
    }

    AsyncFunction("generateKeyAsync") { (alias: String, allowSoftware: Bool) -> [String: String] in
      record(try SecureKeyStore.generate(alias: checked(alias), allowSoftware: allowSoftware))
    }

    AsyncFunction("signAsync") { (alias: String, data: String) -> String in
      guard let bytes = Data(base64Encoded: data) else {
        throw DeviceKeyError.make(.unavailable, "The data to sign is not base64")
      }
      return try SecureKeyStore.sign(alias: checked(alias), data: bytes).base64EncodedString()
    }

    AsyncFunction("deleteKeyAsync") { (alias: String) in
      try SecureKeyStore.delete(alias: checked(alias))
    }

    AsyncFunction("getMarkerAsync") { (alias: String) -> Bool in
      try KeyMarker.exists(alias: checked(alias))
    }

    AsyncFunction("setMarkerAsync") { (alias: String, present: Bool) in
      try KeyMarker.set(alias: checked(alias), present: present)
    }
  }
}

private let aliasMaxLength = 200
private let aliasCharacters = CharacterSet(
  charactersIn: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789._-"
)

/// The alias becomes a file name, so only the characters the TypeScript side produces get through.
private func checked(_ alias: String) throws -> String {
  let allowed = alias.unicodeScalars.allSatisfy { aliasCharacters.contains($0) }
  guard !alias.isEmpty, alias.count <= aliasMaxLength, allowed, !alias.hasPrefix(".") else {
    throw DeviceKeyError.make(.invalidAlias, "The alias is not one this module accepts")
  }
  return alias
}

private func record(_ key: StoredKey) -> [String: String] {
  ["publicKey": key.publicKey.base64EncodedString(), "protection": key.protection.rawValue]
}
