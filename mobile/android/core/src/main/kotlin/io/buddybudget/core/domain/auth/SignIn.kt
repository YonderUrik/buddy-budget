package io.buddybudget.core.domain.auth

import io.buddybudget.core.data.ApiError
import io.buddybudget.core.data.ApiErrorCode
import io.buddybudget.core.data.AuthApi
import kotlin.math.ceil
import kotlin.math.max

/** Input rules and error mapping of the email-code sign-in (AUTH-003, AUTH-007, api/auth.md §3.1). Same names on iOS. */
object SignIn {
    private val EMAIL = Regex(
        "^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*$",
    )

    /** AUTH-003: a syntactically valid address (same rule as the browser's `type=email`). */
    fun isValidEmail(raw: String): Boolean = EMAIL.matches(raw.trim())

    /** Normalized email sent to the server (trimmed, lowercased). */
    fun normalizeEmail(raw: String): String = raw.trim().lowercase()

    /** Keeps only digits, at most [AuthApi.CODE_LENGTH] (pasted "482 913" or "Code: 482913" still work). */
    fun sanitizeCode(raw: String): String = raw.filter { it in '0'..'9' }.take(AuthApi.CODE_LENGTH)

    fun isCompleteCode(code: String): Boolean = code.length == AuthApi.CODE_LENGTH && code.all { it in '0'..'9' }

    /** What went wrong, as the Italian source of the message to show. */
    enum class Failure(val message: String) {
        InvalidEmail("Inserisci un indirizzo email valido."),
        RateLimited("Troppi tentativi ravvicinati. Riprova tra qualche minuto."),
        SendFailed("Non siamo riusciti a inviare il codice. Controlla l'indirizzo e riprova."),
        Network("Connessione non riuscita. Controlla la rete e riprova."),
        WrongCode("Il codice non è corretto. Controlla e riprova."),
        CodeExpired("Il codice è scaduto. Fatti mandare un nuovo codice."),
        CodeBurnt("Troppi tentativi sbagliati: questo codice non vale più. Fatti mandare un nuovo codice."),
        Generic("Qualcosa è andato storto. Riprova."),
        ;

        /** The code can't be used any more: the field is cleared and only «send a new code» helps. */
        val needsNewCode: Boolean get() = this == CodeExpired || this == CodeBurnt
    }

    /** AUTH-007: errors of `send-verification-otp`. */
    fun sendFailure(error: Throwable): Failure = when (error) {
        is ApiError.Transport -> Failure.Network
        is ApiError.Http -> if (error.status == 429) Failure.RateLimited else Failure.SendFailed
        is ApiError -> Failure.SendFailed
        else -> Failure.Generic
    }

    /** Errors of `sign-in/email-otp` (`INVALID_OTP` / `OTP_EXPIRED` / `TOO_MANY_ATTEMPTS` / 429). */
    fun verifyFailure(error: Throwable): Failure = when (error) {
        is ApiError.Transport -> Failure.Network
        is ApiError.Http -> when {
            error.status == 429 -> Failure.RateLimited
            error.body.code == ApiErrorCode.InvalidOtp -> Failure.WrongCode
            error.body.code == ApiErrorCode.OtpExpired -> Failure.CodeExpired
            error.body.code == ApiErrorCode.TooManyAttempts -> Failure.CodeBurnt
            error.status == 400 -> Failure.WrongCode
            else -> Failure.Generic
        }
        else -> Failure.Generic
    }
}

/** Live countdown of «Invia di nuovo tra {0}s» (AUTH-005): seconds left from the moment the code was sent. */
data class ResendCooldown(val sentAtMillis: Long, val seconds: Int = AuthApi.RESEND_COOLDOWN_SECONDS) {
    fun remaining(nowMillis: Long): Int {
        val elapsed = (nowMillis - sentAtMillis) / 1000.0
        return max(0, ceil(seconds - elapsed).toInt())
    }
}

/**
 * «Rientra in BuddyBudget» (AUTH-059, web #398 `lib/auth/returning-user.ts`): the account remembered on this device
 * after a sign-in, offered again on the login screen. Device storage only, never sent anywhere. Same names on iOS.
 */
object ReturningUser {
    /** Device-storage key of the remembered email. */
    const val KEY = "bb.returning-user"

    private const val VISIBLE_LOCAL_CHARS = 3
    private const val MASK = "•••"

    /** A stored value is usable only if it looks like an email. */
    fun parse(raw: String?): String? = raw?.trim()?.takeIf { it.contains("@") }

    /** `dan•••@gmail.com`: most of the local part hidden for a shared screen. */
    fun mask(email: String): String {
        val at = email.lastIndexOf('@')
        if (at <= 0) return email
        val local = email.substring(0, at)
        val visible = local.take(minOf(VISIBLE_LOCAL_CHARS, maxOf(1, local.length - 1)))
        return "$visible$MASK${email.substring(at)}"
    }
}
