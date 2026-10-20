package io.buddybudget.app

import android.content.Context
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import io.buddybudget.app.designsystem.BBThemePreference
import io.buddybudget.app.generated.AppLanguage

/**
 * Per-device preferences (never synced to the server, like the web's localStorage): theme and the language chosen
 * on the sign-in screens. Same keys as `DevicePreferences` on iOS.
 */
class DevicePreferences(context: Context) {
    private val prefs = context.getSharedPreferences("bb-preferences", Context.MODE_PRIVATE)

    /** `bb:theme` — Chiaro / Scuro / Sistema (SHELL-053, SET-015), default Sistema. */
    var theme by mutableStateOf(
        prefs.getString(KEY_THEME, null)?.let { raw -> BBThemePreference.entries.firstOrNull { it.raw == raw } } ?: BBThemePreference.SYSTEM,
    )
        private set

    fun updateTheme(value: BBThemePreference) {
        theme = value
        prefs.edit().putString(KEY_THEME, value.raw).apply()
    }

    /** `bb-language` — language picked before signing in (AUTH-015), default Italian. */
    var signedOutLanguage by mutableStateOf(
        prefs.getString(KEY_LANGUAGE, null)?.let { raw -> AppLanguage.entries.firstOrNull { it.code == raw } } ?: AppLanguage.IT,
    )
        private set

    fun updateSignedOutLanguage(value: AppLanguage) {
        signedOutLanguage = value
        prefs.edit().putString(KEY_LANGUAGE, value.code).apply()
    }

    /**
     * Other per-device values under the web's localStorage keys (Overview, «Il tuo quadro», «Novità»): booleans are
     * stored as `"1"` / `"0"` like the web's `usePersistedFlag`. Observable through [values].
     */
    private val values = mutableStateMapOf<String, String>()

    fun flag(key: String, default: Boolean): Boolean = string(key)?.let { it == "1" } ?: default

    fun setFlag(key: String, value: Boolean) = setString(key, if (value) "1" else "0")

    fun string(key: String): String? = values[key] ?: prefs.getString(key, null)

    fun setString(key: String, value: String) {
        values[key] = value
        prefs.edit().putString(key, value).apply()
    }

    fun remove(key: String) {
        values.remove(key)
        prefs.edit().remove(key).apply()
    }

    private companion object {
        const val KEY_THEME = "bb:theme"
        const val KEY_LANGUAGE = "bb-language"
    }
}

/** Raw value of a theme preference (same as iOS `BBThemePreference.rawValue`). */
val BBThemePreference.raw: String
    get() = when (this) {
        BBThemePreference.SYSTEM -> "system"
        BBThemePreference.LIGHT -> "light"
        BBThemePreference.DARK -> "dark"
    }
