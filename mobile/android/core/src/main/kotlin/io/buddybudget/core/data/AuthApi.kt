package io.buddybudget.core.data

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

/**
 * Native sign-in with the emailed 6-digit code (better-auth `emailOTP`, spec: api/auth.md §3.1) and sign-out (§3.4).
 * Same name and methods as `AuthAPI` on iOS.
 */
class AuthApi(private val client: ApiClient) {
    @Serializable private data class SendBody(val email: String, val type: String = "sign-in")
    @Serializable private data class VerifyBody(val email: String, val otp: String)
    @Serializable private data class VerifyResponse(val token: String? = null)

    /** `POST /api/auth/email-otp/send-verification-otp`: always `{success:true}`, also for unknown addresses. */
    suspend fun sendCode(email: String) {
        client.sendNoContent(
            "api/auth/email-otp/send-verification-otp", "POST",
            client.json.encodeToString(SendBody.serializer(), SendBody(email)),
        )
    }

    /**
     * `POST /api/auth/sign-in/email-otp`; stores the signed `set-auth-token` header verbatim (fallback `body.token`)
     * in the session store and returns it. Errors: `INVALID_OTP`, `OTP_EXPIRED`, `TOO_MANY_ATTEMPTS`, 429.
     */
    suspend fun verifyCode(email: String, code: String): String {
        val response = client.send(
            "api/auth/sign-in/email-otp", "POST",
            body = client.json.encodeToString(VerifyBody.serializer(), VerifyBody(email, code)),
        )
        val header = response.header("set-auth-token")?.trim()?.takeIf { it.isNotEmpty() }
        val bodyToken = runCatching { lenient.decodeFromString(VerifyResponse.serializer(), response.text).token }.getOrNull()
        val token = header ?: bodyToken?.takeIf { it.isNotEmpty() } ?: throw ApiError.Decoding("sign-in response without token")
        client.session.saveToken(token)
        return token
    }

    /** `POST /api/auth/sign-out` (best effort), then wipes the local token. */
    suspend fun signOut() {
        runCatching { client.send("api/auth/sign-out", "POST", body = "{}") }
        client.session.clear()
    }

    companion object {
        /** Code validity and resend cooldown shown in the UI (auth.md §3.1; web `MAGIC_LINK_RESEND_COOLDOWN_SECONDS`). */
        const val CODE_VALIDITY_MINUTES = 10
        const val RESEND_COOLDOWN_SECONDS = 30
        const val CODE_LENGTH = 6
        private val lenient = Json { ignoreUnknownKeys = true }
    }
}
