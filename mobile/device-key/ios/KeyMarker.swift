import ExpoModulesCore
import Foundation

/// An empty file that says "this app made a key with this alias". It lives in
/// Application Support, which a device backup carries and an uninstall removes.
/// The key does neither, and that difference is what the marker is for.
enum KeyMarker {
  private static let folder = "app-device-key"
  private static let fileExtension = "marker"

  static func exists(alias: String) throws -> Bool {
    FileManager.default.fileExists(atPath: try file(alias: alias).path)
  }

  static func set(alias: String, present: Bool) throws {
    let marker = try file(alias: alias)
    let manager = FileManager.default
    do {
      if present {
        try manager.createDirectory(
          at: marker.deletingLastPathComponent(),
          withIntermediateDirectories: true
        )
        // Readable in the background after the first unlock, like the key.
        try Data().write(
          to: marker,
          options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication]
        )
      } else if manager.fileExists(atPath: marker.path) {
        try manager.removeItem(at: marker)
      }
    } catch {
      throw DeviceKeyError.make(.unavailable, "Writing the marker failed: \(error.localizedDescription)")
    }
  }

  private static func file(alias: String) throws -> URL {
    do {
      let support = try FileManager.default.url(
        for: .applicationSupportDirectory,
        in: .userDomainMask,
        appropriateFor: nil,
        create: true
      )
      return support
        .appendingPathComponent(folder, isDirectory: true)
        .appendingPathComponent(alias)
        .appendingPathExtension(fileExtension)
    } catch {
      throw DeviceKeyError.make(.unavailable, "Application Support is out of reach: \(error.localizedDescription)")
    }
  }
}
