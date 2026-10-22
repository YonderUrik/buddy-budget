package io.buddybudget.app

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import io.buddybudget.core.data.SessionStore
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/**
 * Bearer token encrypted with an AES-256/GCM key that never leaves the Android Keystore; ciphertext and IV in private
 * SharedPreferences (excluded from backup: `allowBackup=false`). Twin of `KeychainSessionStore` on iOS
 * (spec: api/auth.md §2).
 */
class KeystoreSessionStore(context: Context) : SessionStore {
    private val prefs = context.getSharedPreferences("bb-session", Context.MODE_PRIVATE)
    @Volatile private var cached: String? = null
    @Volatile private var loaded = false

    @Synchronized
    override fun readToken(): String? {
        if (loaded) return cached
        cached = runCatching {
            val data = prefs.getString(KEY_DATA, null) ?: return@runCatching null
            val iv = prefs.getString(KEY_IV, null) ?: return@runCatching null
            val cipher = Cipher.getInstance(TRANSFORMATION)
            cipher.init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(128, Base64.decode(iv, Base64.NO_WRAP)))
            String(cipher.doFinal(Base64.decode(data, Base64.NO_WRAP)), Charsets.UTF_8)
        }.getOrNull()
        loaded = true
        return cached
    }

    @Synchronized
    override fun saveToken(token: String) {
        val cipher = Cipher.getInstance(TRANSFORMATION)
        cipher.init(Cipher.ENCRYPT_MODE, key())
        val data = cipher.doFinal(token.toByteArray(Charsets.UTF_8))
        prefs.edit()
            .putString(KEY_DATA, Base64.encodeToString(data, Base64.NO_WRAP))
            .putString(KEY_IV, Base64.encodeToString(cipher.iv, Base64.NO_WRAP))
            .apply()
        cached = token
        loaded = true
    }

    @Synchronized
    override fun clear() {
        prefs.edit().remove(KEY_DATA).remove(KEY_IV).apply()
        cached = null
        loaded = true
    }

    private fun key(): SecretKey {
        val store = KeyStore.getInstance(KEYSTORE).apply { load(null) }
        (store.getKey(ALIAS, null) as? SecretKey)?.let { return it }
        val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, KEYSTORE)
        generator.init(
            KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256)
                .build(),
        )
        return generator.generateKey()
    }

    private companion object {
        const val KEYSTORE = "AndroidKeyStore"
        const val ALIAS = "bb-session-key"
        const val TRANSFORMATION = "AES/GCM/NoPadding"
        const val KEY_DATA = "token"
        const val KEY_IV = "iv"
    }
}
