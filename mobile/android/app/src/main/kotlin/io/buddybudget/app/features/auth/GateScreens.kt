package io.buddybudget.app.features.auth

import android.content.Context
import android.content.Intent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import androidx.core.content.FileProvider
import io.buddybudget.app.AppEnvironment
import io.buddybudget.app.LocalEnv
import io.buddybudget.app.R
import io.buddybudget.app.designsystem.BuddyBudgetTheme
import io.buddybudget.app.designsystem.components.BBButton
import io.buddybudget.app.designsystem.components.BBButtonSize
import io.buddybudget.app.designsystem.components.BBButtonVariant
import io.buddybudget.app.designsystem.components.BBErrorBox
import io.buddybudget.app.designsystem.components.BBSpinner
import io.buddybudget.app.designsystem.components.BBText
import io.buddybudget.app.designsystem.components.LocalBBLocale
import io.buddybudget.app.designsystem.components.bbPressable
import io.buddybudget.app.designsystem.generated.BBRadius
import io.buddybudget.app.designsystem.generated.BBSpacing
import io.buddybudget.app.designsystem.generated.BBTextStyle
import io.buddybudget.app.generated.L10n
import io.buddybudget.app.generated.l10n
import io.buddybudget.core.data.ApiError
import io.buddybudget.core.data.ApiErrorCode
import io.buddybudget.core.data.LegalConsent
import io.buddybudget.core.data.LegalMeta
import io.buddybudget.core.domain.format.BBFormat
import io.buddybudget.core.domain.periods.CalendarDate
import io.buddybudget.core.domain.settings.IsoDate
import kotlinx.coroutines.launch
import java.io.File
import java.time.Instant
import java.time.ZoneId

/**
 * «Abbiamo aggiornato Termini e Privacy» (AUTH-044…046, SHELL-003): the three declarations, accept, sign out and
 * download the data (ZIP via the share sheet).
 */
@Composable
fun LegalAcceptanceScreen() {
    val env = LocalEnv.current
    val c = BuddyBudgetTheme.colors
    val scope = rememberCoroutineScope()
    var consent by remember { mutableStateOf(LegalConsent()) }
    var legal by remember { mutableStateOf<LegalMeta?>(null) }
    var saving by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    LaunchedEffect(env.session.language) { legal = env.session.loadLegal() }
    val networkError = l10n(R.string.connection_failed_check_your_network_and_93acb6)
    val acceptError = l10n(R.string.could_not_record_acceptance_try_again_c1a66b)
    AuthScaffold {
        Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space8)) {
            Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
                BBText(l10n(R.string.we_have_updated_our_terms_and_privacy_po_0e1cf0), Modifier.semantics { heading() }, AuthTitle)
                BBText(l10n(R.string.read_and_accept_the_documents_to_keep_us_009a8d), BBTextStyle.BodyLarge, color = c.text2)
            }
            LegalConsentFields(consent, { consent = it }, legal, !saving)
            error?.let { BBErrorBox(it) }
            Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
                BBButton(
                    if (saving) l10n(R.string.saving_712d0f) else l10n(R.string.accept_and_continue_b33132),
                    {
                        val version = legal?.version ?: env.session.bootstrap?.legal?.currentVersion ?: ""
                        val payload = consent.payload(version) ?: return@BBButton
                        saving = true
                        error = null
                        scope.launch {
                            try {
                                env.user.acceptLegal(payload)
                                env.session.refresh()
                            } catch (e: ApiError.Transport) {
                                error = networkError
                            } catch (e: Exception) {
                                error = acceptError
                            }
                            saving = false
                        }
                    },
                    variant = BBButtonVariant.Sun, size = BBButtonSize.Touch, fullWidth = true, isLoading = saving, enabled = consent.isComplete,
                )
                BBButton(l10n(R.string.sign_out_0f7014), { scope.launch { env.session.signOut() } }, variant = BBButtonVariant.Outline,
                    size = BBButtonSize.Touch, fullWidth = true, enabled = !saving)
                ExportLink()
            }
        }
    }
}

/** «Il tuo account è disattivato» (AUTH-047…049, SHELL-002): deletion date, reactivate or sign out. */
@Composable
fun DeactivatedScreen() {
    val env = LocalEnv.current
    val c = BuddyBudgetTheme.colors
    val locale = LocalBBLocale.current
    val scope = rememberCoroutineScope()
    var reactivating by remember { mutableStateOf(false) }
    var signingOut by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    val date = env.session.bootstrap?.account?.deletionScheduledAt?.let(IsoDate::localDay)?.let { BBFormat.formatLongDate(it, locale) } ?: ""
    val networkError = l10n(R.string.connection_failed_check_your_network_and_93acb6)
    val failed = l10n(R.string.reactivation_failed_f461d9)
    AuthScaffold {
        Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space8)) {
            Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
                BBText(l10n(R.string.your_account_is_deactivated_b98e56), Modifier.semantics { heading() }, AuthTitle)
                BBText(
                    l10n(R.string.your_account_and_all_data_will_be_perman_fa6e29, date) + l10n(R.string.until_then_you_can_reactivate_it_and_rec_8c14c8),
                    BBTextStyle.BodyLarge, color = c.text2,
                )
            }
            error?.let { BBErrorBox(it) }
            Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
                BBButton(l10n(R.string.reactivate_account_ecb297), {
                    reactivating = true
                    error = null
                    scope.launch {
                        try {
                            env.user.reactivate()
                            env.session.refresh()
                        } catch (e: ApiError.Transport) {
                            error = networkError
                        } catch (e: ApiError.Http) {
                            error = e.body.message ?: failed
                        } catch (e: Exception) {
                            error = failed
                        }
                        reactivating = false
                    }
                }, variant = BBButtonVariant.Sun, size = BBButtonSize.Touch, fullWidth = true, isLoading = reactivating, enabled = !signingOut)
                BBButton(l10n(R.string.sign_out_0f7014), {
                    signingOut = true
                    scope.launch { env.session.signOut() }
                }, variant = BBButtonVariant.Outline, size = BBButtonSize.Touch, fullWidth = true, isLoading = signingOut, enabled = !reactivating)
            }
        }
    }
}

// ---------------------------------------------------------------- Data export (shared with Settings › I tuoi dati)

/** State of a `GET /api/user/export` download handed to the share sheet (SET-038). */
data class ExportState(val running: Boolean = false, val error: String? = null, val reauthRequired: Boolean = false)

object DataExporter {
    /** Downloads the ZIP into the cache and opens the share sheet; maps `reauth_required` and network errors. */
    suspend fun run(env: AppEnvironment, context: Context, networkError: String, genericError: String, update: (ExportState) -> Unit) {
        update(ExportState(running = true))
        try {
            val today = CalendarDate.of(Instant.now(), ZoneId.systemDefault())
            val export = env.user.export(today)
            val dir = File(context.cacheDir, "exports").apply { mkdirs() }
            val file = File(dir, export.fileName)
            file.writeBytes(export.bytes)
            val uri = FileProvider.getUriForFile(context, context.packageName + ".exports", file)
            val send = Intent(Intent.ACTION_SEND).setType("application/zip").putExtra(Intent.EXTRA_STREAM, uri)
                .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            context.startActivity(Intent.createChooser(send, export.fileName).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
            update(ExportState())
        } catch (e: ApiError) {
            update(
                when {
                    e.code == ApiErrorCode.ReauthRequired -> ExportState(error = e.errorBody?.message, reauthRequired = true)
                    e is ApiError.Transport -> ExportState(error = networkError)
                    else -> ExportState(error = e.errorBody?.message ?: genericError)
                },
            )
        } catch (e: Exception) {
            update(ExportState(error = genericError))
        }
    }
}

/** «Scarica i miei dati» as a small underlined link (legal-acceptance screen). */
@Composable
private fun ExportLink() {
    val env = LocalEnv.current
    val context = LocalContext.current
    val c = BuddyBudgetTheme.colors
    val scope = rememberCoroutineScope()
    var state by remember { mutableStateOf(ExportState()) }
    val networkError = l10n(R.string.connection_failed_check_your_network_and_93acb6)
    val genericError = l10n(L10n.genericError)
    Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
        Row(
            Modifier.bbPressable(if (state.running) null else ({ scope.launch { DataExporter.run(env, context, networkError, genericError) { state = it } } }),
                RoundedCornerShape(BBRadius.md), translate = false),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(BBSpacing.space1_5),
        ) {
            if (state.running) BBSpinner(14.dp, c.text3)
            BBText(
                if (state.running) l10n(R.string.preparing_8aa508) else l10n(R.string.download_my_data_1dfaff),
                style = BBTextStyle.Body.style.copy(textDecoration = TextDecoration.Underline), color = c.text3,
            )
        }
        state.error?.let { BBText(it, style = BBTextStyle.Body.style.copy(textAlign = TextAlign.Center), color = c.neg) }
    }
}
