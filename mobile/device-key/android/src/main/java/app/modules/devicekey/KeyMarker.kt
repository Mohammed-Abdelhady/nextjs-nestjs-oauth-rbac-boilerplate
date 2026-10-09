package app.modules.devicekey

import java.io.File
import java.io.IOException

/**
 * An empty file that says "this app made a key with this alias". It lives in
 * the app's files folder, which Auto Backup carries and an uninstall removes.
 * The key does neither, and that difference is what the marker is for.
 */
internal class KeyMarker(private val filesDirectory: File) {
  fun exists(alias: String): Boolean = file(alias).exists()

  fun set(alias: String, present: Boolean) {
    val marker = file(alias)
    if (present) {
      marker.parentFile?.mkdirs()
      marker.createNewFile()
      if (!marker.exists()) throw IOException("The marker was not written")
    } else if (marker.exists() && !marker.delete()) {
      throw IOException("The marker was not removed")
    }
  }

  private fun file(alias: String) = File(File(filesDirectory, FOLDER), "$alias.$EXTENSION")

  private companion object {
    const val FOLDER = "app-device-key"
    const val EXTENSION = "marker"
  }
}
