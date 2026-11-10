package io.buddybudget.app.features.investments

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import io.buddybudget.app.AppEnvironment
import io.buddybudget.app.designsystem.components.BBToastKind
import io.buddybudget.app.features.settings.Loadable
import io.buddybudget.core.data.ApiError
import io.buddybudget.core.data.PriceAlert
import io.buddybudget.core.data.QuotationCandidates
import io.buddybudget.core.data.TitleAnalysis
import io.buddybudget.core.domain.investments.TitlePeriod
import kotlinx.coroutines.Job
import kotlinx.coroutines.MainScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/** State of the security page (08-securities-watchlist). Same fields as `SecurityModel` on iOS. */
class SecurityModel(private val env: AppEnvironment, val instrumentId: String) {
    sealed interface CommentaryState {
        data object Idle : CommentaryState
        data object Writing : CommentaryState
        data object Done : CommentaryState
        data class Failed(val message: String?) : CommentaryState
    }

    var period by mutableStateOf(TitlePeriod.Default)
        private set
    var analysis by mutableStateOf<Loadable<TitleAnalysis>>(Loadable.Loading)
        private set
    var errorMessage by mutableStateOf<String?>(null)
        private set
    var followPending by mutableStateOf(false)
        private set
    var alertPending by mutableStateOf(false)
        private set
    var alertError by mutableStateOf<String?>(null)
    var commentary by mutableStateOf<String?>(null)
        private set
    var commentaryState by mutableStateOf<CommentaryState>(CommentaryState.Idle)
        private set
    var quotations by mutableStateOf<QuotationCandidates?>(null)
        private set
    var quotationsLoading by mutableStateOf(false)
        private set
    var quotationError by mutableStateOf<String?>(null)
    var onChanged: (suspend () -> Unit)? = null

    private val scope = MainScope()
    private var pollJob: Job? = null

    val value: TitleAnalysis? get() = (analysis as? Loadable.Loaded)?.value

    private fun message(e: Exception): String =
        (e as? ApiError.Http)?.body?.message?.takeIf { it.isNotEmpty() } ?: env.session.strings().lookup("Qualcosa è andato storto. Riprova.")

    fun launch(block: suspend () -> Unit) {
        scope.launch { block() }
    }

    /** SEC-015 / SEC-016. */
    suspend fun load() {
        try {
            val result = env.instruments.analysis(instrumentId, period)
            analysis = Loadable.Loaded(result)
            errorMessage = null
            schedulePoll(result.backfilling)
        } catch (e: Exception) {
            if (value == null) {
                analysis = Loadable.Failed
                errorMessage = (e as? ApiError.Http)?.body?.message
            }
        }
    }

    fun updatePeriod(next: TitlePeriod) {
        period = next
        launch { load() }
    }

    /** Re-poll every 2.5 s while `backfilling` (at most 40 times, only while the page is open). */
    private fun schedulePoll(backfilling: Boolean) {
        pollJob?.cancel()
        if (!backfilling) return
        pollJob = scope.launch {
            repeat(40) {
                delay(2500)
                val next = runCatching { env.instruments.analysis(instrumentId, period) }.getOrNull() ?: return@repeat
                analysis = Loadable.Loaded(next)
                if (!next.backfilling) return@launch
            }
        }
    }

    fun stop() {
        pollJob?.cancel()
    }

    /** SEC-012. */
    suspend fun toggleFollow() {
        val current = value ?: return
        followPending = true
        try {
            env.instruments.setWatching(instrumentId, !current.watching)
            load()
            onChanged?.invoke()
        } catch (e: Exception) {
            env.toasts.show(BBToastKind.Error, message(e))
        }
        followPending = false
    }

    /** SEC-030…032. */
    suspend fun createAlert(above: Boolean, level: Double): Boolean {
        alertPending = true
        alertError = null
        return try {
            env.instruments.createAlert(instrumentId, above, level)
            load()
            onChanged?.invoke()
            true
        } catch (e: Exception) {
            alertError = message(e)
            false
        } finally {
            alertPending = false
        }
    }

    /** SEC-033. */
    suspend fun deleteAlert(alert: PriceAlert) {
        try {
            env.instruments.deleteAlert(instrumentId, alert.id)
            load()
            onChanged?.invoke()
        } catch (e: Exception) {
            env.toasts.show(BBToastKind.Error, message(e))
        }
    }

    /** SEC-049. */
    suspend fun generateCommentary() {
        commentaryState = CommentaryState.Writing
        commentaryState = try {
            val result = env.instruments.commentary(instrumentId)
            val text = result.text
            if (text != null) {
                commentary = text
                CommentaryState.Done
            } else {
                CommentaryState.Failed(null)
            }
        } catch (e: Exception) {
            CommentaryState.Failed((e as? ApiError.Http)?.body?.message)
        }
    }

    /** SEC-028. */
    suspend fun searchQuotations() {
        quotationsLoading = true
        quotationError = null
        try {
            quotations = env.instruments.quotations(instrumentId)
        } catch (e: Exception) {
            quotationError = message(e)
        }
        quotationsLoading = false
    }

    suspend fun link(symbol: String) {
        try {
            env.instruments.linkQuotation(instrumentId, symbol)
            quotations = null
            load()
            onChanged?.invoke()
        } catch (e: Exception) {
            quotationError = message(e)
        }
    }
}
