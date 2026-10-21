package io.buddybudget.app.features.auth

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import io.buddybudget.core.data.AuthApi
import io.buddybudget.core.domain.auth.ResendCooldown
import io.buddybudget.core.domain.auth.SignIn
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

/** State of the email-code sign-in (AUTH-001…009, api/auth.md §3.1). Same fields as `LoginModel` on iOS. */
class LoginModel(
    private val auth: AuthApi,
    email: String,
    private val scope: CoroutineScope,
    private val onSignedIn: suspend (email: String) -> Unit,
) {
    enum class Step { Email, Code }

    var email by mutableStateOf(email)
    var code by mutableStateOf("")
        private set
    var step by mutableStateOf(Step.Email)
        private set
    var sending by mutableStateOf(false)
        private set
    var verifying by mutableStateOf(false)
        private set
    var failure by mutableStateOf<SignIn.Failure?>(null)
        private set
    private var cooldown by mutableStateOf<ResendCooldown?>(null)
    /** Ticks every second while a cooldown runs (AUTH-005 live countdown). */
    private var now by mutableLongStateOf(System.currentTimeMillis())
    private var ticker: Job? = null

    val busy: Boolean get() = sending || verifying
    val resendRemaining: Int get() = cooldown?.remaining(now) ?: 0
    val normalizedEmail: String get() = SignIn.normalizeEmail(email)

    /** AUTH-003 → AUTH-004: validate, request the code, move to the code step only once the server confirmed. */
    suspend fun sendCode() {
        if (busy) return
        if (!SignIn.isValidEmail(email)) {
            failure = SignIn.Failure.InvalidEmail
            return
        }
        sending = true
        failure = null
        try {
            auth.sendCode(normalizedEmail)
            code = ""
            step = Step.Code
            startCooldown()
        } catch (e: Exception) {
            failure = SignIn.sendFailure(e)
        } finally {
            sending = false
        }
    }

    /** AUTH-005: «Invia di nuovo il codice» after the cooldown. */
    suspend fun resend() {
        if (resendRemaining > 0 || busy) return
        sending = true
        failure = null
        try {
            auth.sendCode(normalizedEmail)
            code = ""
            startCooldown()
        } catch (e: Exception) {
            failure = SignIn.sendFailure(e)
        } finally {
            sending = false
        }
    }

    fun updateCode(raw: String) {
        val clean = SignIn.sanitizeCode(raw)
        if (clean != code) code = clean
        if (failure == SignIn.Failure.WrongCode) failure = null
        if (SignIn.isCompleteCode(clean) && !verifying) scope.launch { verify() }
    }

    /** `POST /api/auth/sign-in/email-otp`; on success the session takes over (bootstrap → gate). */
    suspend fun verify() {
        if (!SignIn.isCompleteCode(code) || verifying) return
        verifying = true
        failure = null
        try {
            auth.verifyCode(normalizedEmail, code)
            ticker?.cancel()
            onSignedIn(normalizedEmail)
        } catch (e: Exception) {
            failure = SignIn.verifyFailure(e)
            code = ""
        } finally {
            verifying = false
        }
    }

    /** AUTH-006: back to the form, email kept. */
    fun useAnotherEmail() {
        step = Step.Email
        failure = null
        code = ""
    }

    /** DEBUG `bbCode`: jump to the code step (code sent by a previous `bbAutoSend` launch) and verify. */
    fun debugEnterCode(raw: String) {
        step = Step.Code
        startCooldown()
        updateCode(raw)
    }

    private fun startCooldown() {
        cooldown = ResendCooldown(System.currentTimeMillis())
        now = System.currentTimeMillis()
        ticker?.cancel()
        ticker = scope.launch {
            while (isActive) {
                delay(1000)
                now = System.currentTimeMillis()
                if (resendRemaining == 0) return@launch
            }
        }
    }
}
