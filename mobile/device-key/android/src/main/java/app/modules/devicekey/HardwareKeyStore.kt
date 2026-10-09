package app.modules.devicekey

import android.content.pm.PackageManager
import android.os.Build
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyInfo
import android.security.keystore.KeyProperties
import java.security.KeyFactory
import java.security.KeyPairGenerator
import java.security.KeyStore
import java.security.PrivateKey
import java.security.ProviderException
import java.security.Signature
import java.security.spec.ECGenParameterSpec

/** The values `src/constants.ts` names as `PROTECTION_LEVEL`. */
internal object Protection {
  const val STRONG_BOX = "strongBox"
  const val TRUSTED_ENVIRONMENT = "trustedEnvironment"
  const val SOFTWARE = "software"
}

/** `publicKey` is the DER SubjectPublicKeyInfo of the key's certificate. */
internal class StoredKey(val publicKey: ByteArray, val protection: String)

/**
 * One P-256 private key per alias in the Android Keystore. The key is made
 * inside the keystore and has no export: only its handle reaches this process.
 */
internal class HardwareKeyStore(private val packageManager: PackageManager) {
  fun read(alias: String): StoredKey? {
    val keyStore = open()
    val privateKey = keyStore.getKey(alias, null) as? PrivateKey ?: return null
    val certificate = keyStore.getCertificate(alias) ?: return null
    return StoredKey(certificate.publicKey.encoded, protectionOf(privateKey))
  }

  /** Replaces any key with this alias. */
  fun generate(alias: String, allowSoftware: Boolean): StoredKey {
    delete(alias)
    createPair(alias)
    val key = read(alias)
      ?: throw DeviceKeyException(ErrorCode.UNAVAILABLE, "The new key cannot be read back")
    // Before API 31 the only way to learn where a key lives is to make it and ask.
    if (key.protection == Protection.SOFTWARE && !allowSoftware) {
      delete(alias)
      throw DeviceKeyException(ErrorCode.NO_HARDWARE, "This keystore is not backed by secure hardware")
    }
    return key
  }

  /** Signs the SHA-256 of the data. The keystore returns the signature as DER. */
  fun sign(alias: String, data: ByteArray): ByteArray {
    val privateKey = open().getKey(alias, null) as? PrivateKey
      ?: throw DeviceKeyException(ErrorCode.NOT_FOUND, "No key has this alias")
    return Signature.getInstance(SIGNATURE_ALGORITHM).run {
      initSign(privateKey)
      update(data)
      sign()
    }
  }

  fun delete(alias: String) {
    val keyStore = open()
    if (keyStore.containsAlias(alias)) {
      keyStore.deleteEntry(alias)
    }
  }

  private fun open(): KeyStore = KeyStore.getInstance(PROVIDER).apply { load(null) }

  private fun createPair(alias: String) {
    if (hasStrongBox()) {
      try {
        generator(alias, strongBox = true).generateKeyPair()
        return
      } catch (error: ProviderException) {
        // The device declares StrongBox and still refused. The trusted environment is next.
        delete(alias)
      }
    }
    generator(alias, strongBox = false).generateKeyPair()
  }

  private fun hasStrongBox(): Boolean =
    Build.VERSION.SDK_INT >= Build.VERSION_CODES.P &&
      packageManager.hasSystemFeature(PackageManager.FEATURE_STRONGBOX_KEYSTORE)

  private fun generator(alias: String, strongBox: Boolean): KeyPairGenerator {
    // Sign only, SHA-256 only, P-256 only, and no user authentication, so a
    // refresh in the background never waits for a prompt.
    val spec = KeyGenParameterSpec.Builder(alias, KeyProperties.PURPOSE_SIGN)
      .setAlgorithmParameterSpec(ECGenParameterSpec(CURVE))
      .setDigests(KeyProperties.DIGEST_SHA256)
      .setUserAuthenticationRequired(false)
    if (strongBox && Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
      spec.setIsStrongBoxBacked(true)
    }
    return KeyPairGenerator.getInstance(KeyProperties.KEY_ALGORITHM_EC, PROVIDER).apply {
      initialize(spec.build())
    }
  }

  private fun protectionOf(privateKey: PrivateKey): String {
    val info = KeyFactory.getInstance(privateKey.algorithm, PROVIDER)
      .getKeySpec(privateKey, KeyInfo::class.java)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      return when (info.securityLevel) {
        KeyProperties.SECURITY_LEVEL_STRONGBOX -> Protection.STRONG_BOX
        KeyProperties.SECURITY_LEVEL_TRUSTED_ENVIRONMENT,
        KeyProperties.SECURITY_LEVEL_UNKNOWN_SECURE -> Protection.TRUSTED_ENVIRONMENT
        else -> Protection.SOFTWARE
      }
    }
    // Older systems only say whether the key is in secure hardware, not which kind.
    return if (info.isInsideSecureHardware) Protection.TRUSTED_ENVIRONMENT else Protection.SOFTWARE
  }

  private companion object {
    const val PROVIDER = "AndroidKeyStore"
    const val CURVE = "secp256r1"
    const val SIGNATURE_ALGORITHM = "SHA256withECDSA"
  }
}
