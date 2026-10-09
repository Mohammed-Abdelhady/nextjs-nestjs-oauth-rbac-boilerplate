package app.modules.devicekey

import android.content.Context
import android.util.Base64
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * The native half of `@app/device-key`. Bytes cross as base64 text, and every
 * conversion of what the keystore returns happens in TypeScript.
 */
class DeviceKeyModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  private fun keys() = HardwareKeyStore(context.packageManager)

  private fun markers() = KeyMarker(context.filesDir)

  override fun definition() = ModuleDefinition {
    Name("AppDeviceKey")

    AsyncFunction("getKeyAsync") { alias: String ->
      guarded("Reading the key") { keys().read(checked(alias))?.let(::record) }
    }

    AsyncFunction("generateKeyAsync") { alias: String, allowSoftware: Boolean ->
      guarded("Creating the key") { record(keys().generate(checked(alias), allowSoftware)) }
    }

    AsyncFunction("signAsync") { alias: String, data: String ->
      guarded("Signing") {
        val signature = keys().sign(checked(alias), Base64.decode(data, Base64.DEFAULT))
        Base64.encodeToString(signature, Base64.NO_WRAP)
      }
    }

    AsyncFunction("deleteKeyAsync") { alias: String ->
      guarded("Deleting the key") { keys().delete(checked(alias)) }
    }

    AsyncFunction("getMarkerAsync") { alias: String ->
      guarded("Reading the marker") { markers().exists(checked(alias)) }
    }

    AsyncFunction("setMarkerAsync") { alias: String, present: Boolean ->
      guarded("Writing the marker") { markers().set(checked(alias), present) }
    }
  }

  private companion object {
    /** The alias becomes a file name, so only what the TypeScript side produces gets through. */
    val ALIAS_PATTERN = Regex("^[A-Za-z0-9_-][A-Za-z0-9._-]{0,199}$")

    fun checked(alias: String): String {
      if (!ALIAS_PATTERN.matches(alias)) {
        throw DeviceKeyException(ErrorCode.INVALID_ALIAS, "The alias is not one this module accepts")
      }
      return alias
    }

    fun record(key: StoredKey): Map<String, String> = mapOf(
      "publicKey" to Base64.encodeToString(key.publicKey, Base64.NO_WRAP),
      "protection" to key.protection
    )
  }
}
