package io.buddybudget.app.features.settings

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import io.buddybudget.app.LocalEnv
import io.buddybudget.app.R
import io.buddybudget.app.designsystem.BuddyBudgetTheme
import io.buddybudget.app.designsystem.components.BBButton
import io.buddybudget.app.designsystem.components.BBButtonSize
import io.buddybudget.app.designsystem.components.BBButtonVariant
import io.buddybudget.app.designsystem.components.BBIconBadge
import io.buddybudget.app.designsystem.components.BBIconView
import io.buddybudget.app.designsystem.components.BBKeyboard
import io.buddybudget.app.designsystem.components.BBSeparator
import io.buddybudget.app.designsystem.components.BBSheet
import io.buddybudget.app.designsystem.components.BBText
import io.buddybudget.app.designsystem.components.BBTextField
import io.buddybudget.app.designsystem.generated.BBIcon
import io.buddybudget.app.designsystem.generated.BBRadius
import io.buddybudget.app.designsystem.generated.BBSpacing
import io.buddybudget.app.designsystem.generated.BBTextStyle
import io.buddybudget.app.features.auth.OneTimeCodeField
import io.buddybudget.app.generated.l10n
import io.buddybudget.core.data.UserSettings
import io.buddybudget.core.domain.auth.SignIn
import io.buddybudget.core.domain.settings.DangerConfirmation
import io.buddybudget.core.domain.settings.RecentLogin
import kotlinx.coroutines.launch

private enum class DangerAction { Reset, Deactivate, Delete }

/** Zona pericolosa (SET-042…049): reset, deactivate, delete — each with a confirmation sheet; recent login required. */
@Composable
fun DangerZoneSection(model: SettingsModel, settings: UserSettings) {
    var open by remember { mutableStateOf<DangerAction?>(null) }
    var pending by remember { mutableStateOf(false) }
    SettingsSection(l10n(R.string.danger_zone_c05932), BBIcon.TriangleAlert, l10n(R.string.actions_that_delete_your_data_we_ask_you_ddb14b), danger = true) {
        DangerRow(l10n(R.string.reset_all_data_8ef391), l10n(R.string.delete_accounts_transactions_investments_6569b1), l10n(R.string.reset_6c5d22), first = true) { open = DangerAction.Reset }
        DangerRow(
            l10n(R.string.deactivate_account_c32247),
            l10n(R.string.your_account_is_blocked_immediately_and_07bbca, DangerConfirmation.DEACTIVATION_GRACE_DAYS.toString()),
            l10n(R.string.deactivate_a8542c),
        ) { open = DangerAction.Deactivate }
        DangerRow(l10n(R.string.delete_your_account_b03680), l10n(R.string.immediately_and_permanently_delete_the_a_e0b341), l10n(R.string.delete_6b177b)) {
            open = DangerAction.Delete
        }
    }
    val action = open
    // SET-042: the sheet can't be dismissed while the action is pending.
    BBSheet(action != null, { if (!pending) open = null }) {
        if (action != null) DangerDialog(action, model, settings.email, pending, { pending = it }) { open = null }
    }
}

@Composable
private fun DangerRow(title: String, summary: String, trigger: String, first: Boolean = false, onClick: () -> Unit) {
    val c = BuddyBudgetTheme.colors
    Column(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(top = if (first) 0.dp else BBSpacing.space4), verticalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
            Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space0_5)) {
                BBText(title, BBTextStyle.BodyStrong)
                BBText(summary, BBTextStyle.Caption, color = c.mutedForeground)
            }
            BBButton(trigger, onClick, variant = BBButtonVariant.Destructive)
        }
    }
}

/** The confirmation sheet: description, Reauth panel or the typed confirmation, server errors inside, confirm + Annulla. */
@Composable
private fun DangerDialog(action: DangerAction, model: SettingsModel, email: String, pending: Boolean, setPending: (Boolean) -> Unit, onClose: () -> Unit) {
    val env = LocalEnv.current
    val c = BuddyBudgetTheme.colors
    val scope = rememberCoroutineScope()
    var typed by remember { mutableStateOf("") }
    var error by remember { mutableStateOf<String?>(null) }
    BBIconBadge(BBIcon.TriangleAlert, c.destructive, 44.dp, 20.dp)
    val (title, paragraphs, confirmLabel) = when (action) {
        DangerAction.Reset -> Triple(
            l10n(R.string.reset_all_data_8a4c12),
            listOf(l10n(R.string.accounts_transactions_investments_catego_050c5e), l10n(R.string.your_account_and_sign_in_methods_remain_3be99a)),
            l10n(R.string.reset_everything_3ad95c),
        )
        DangerAction.Deactivate -> Triple(
            l10n(R.string.deactivate_account_d64dfa),
            listOf(
                "${l10n(R.string.you_will_be_signed_out_of_all_other_devi_c6b23e)} ${DangerConfirmation.DEACTIVATION_GRACE_DAYS} ${l10n(R.string.days_your_account_and_all_data_will_be_p_921f6e)}",
                l10n(R.string.if_you_change_your_mind_sign_in_before_t_8dfaa3),
            ),
            l10n(R.string.deactivate_account_3f5247),
        )
        DangerAction.Delete -> Triple(
            l10n(R.string.permanently_delete_account_0e2bf5),
            listOf(l10n(R.string.your_account_and_all_data_are_deleted_im_f13d4b), l10n(R.string.to_keep_a_copy_download_your_data_first_2a4ecc)),
            l10n(R.string.delete_permanently_32fd3e),
        )
    }
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
        BBText(title, Modifier.semantics { heading() }, BBTextStyle.CardTitle.style.copy(lineHeight = 24.sp))
        paragraphs.forEach { BBText(it, BBTextStyle.Body, color = c.mutedForeground) }
    }
    val canConfirm = when (action) {
        DangerAction.Reset -> DangerConfirmation.resetMatches(typed)
        DangerAction.Deactivate -> true
        DangerAction.Delete -> DangerConfirmation.deleteMatches(typed, email)
    }
    if (!model.recentLogin) {
        ReauthPanel(model, email) { error = null }
    } else {
        when (action) {
            DangerAction.Reset -> Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
                BBText("${l10n(R.string.write_17dd8c)} ${DangerConfirmation.RESET_WORD} ${l10n(R.string.to_confirm_7cbc30)}", BBTextStyle.BodyStrong)
                BBTextField(typed, { typed = it }, keyboard = BBKeyboard.Email, enabled = !pending, capitalization = KeyboardCapitalization.Characters)
            }
            DangerAction.Delete -> Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
                BBText(l10n(R.string.enter_your_email_to_confirm_c75762), BBTextStyle.BodyStrong)
                BBText(email, BBTextStyle.Caption, color = c.mutedForeground)
                BBTextField(typed, { typed = it }, keyboard = BBKeyboard.Email, enabled = !pending)
            }
            DangerAction.Deactivate -> Unit
        }
        error?.let { BBText(it, BBTextStyle.Body, color = c.neg) }
    }
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
        if (model.recentLogin) {
            BBButton(confirmLabel, {
                setPending(true)
                error = null
                scope.launch {
                    try {
                        when (action) {
                            DangerAction.Reset -> {
                                env.user.reset(typed)
                                setPending(false); onClose()
                                env.session.refresh() // SET-044: onboarding restarts
                            }
                            DangerAction.Deactivate -> {
                                env.user.deactivate()
                                setPending(false); onClose()
                                env.session.refresh() // SET-045: deactivated screen
                            }
                            DangerAction.Delete -> {
                                env.user.deleteAccount(typed.trim())
                                setPending(false); onClose()
                                env.session.accountDeleted() // SET-047: login with the notice
                            }
                        }
                    } catch (e: Exception) {
                        error = model.message(e)
                    }
                    setPending(false)
                }
            }, variant = BBButtonVariant.Destructive, size = BBButtonSize.Touch, fullWidth = true, isLoading = pending, enabled = canConfirm)
        }
        BBButton(l10n(R.string.cancel_6c3de5), onClose, variant = BBButtonVariant.Outline, size = BBButtonSize.Touch, fullWidth = true, enabled = !pending)
    }
}

/**
 * «Per sicurezza, conferma che sei tu» (SET-039…041), native variant: a new sign-in code to the account email,
 * entered here; the new session counts as recent. (Google re-auth needs the native SDK: deferred.)
 */
@Composable
fun ReauthPanel(model: SettingsModel, email: String, onDone: () -> Unit = {}) {
    val env = LocalEnv.current
    val c = BuddyBudgetTheme.colors
    val scope = rememberCoroutineScope()
    var sent by remember { mutableStateOf(false) }
    var sending by remember { mutableStateOf(false) }
    var verifying by remember { mutableStateOf(false) }
    var code by remember { mutableStateOf("") }
    var error by remember { mutableStateOf<String?>(null) }
    val sendError = l10n(R.string.we_couldn_t_send_the_code_try_again_shor_c55738)
    val strings = env.session.strings()
    Column(
        Modifier.fillMaxWidth().background(c.alphaMuted60, RoundedCornerShape(BBRadius.lg)).padding(BBSpacing.space4),
        verticalArrangement = Arrangement.spacedBy(BBSpacing.space3),
    ) {
        Row(horizontalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
            BBIconView(BBIcon.ShieldCheck, Modifier.padding(top = 2.dp), size = 20.dp, color = c.primary)
            Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space1)) {
                BBText(l10n(R.string.confirm_your_identity_for_security_55a2f0), BBTextStyle.BodyStrong)
                BBText(
                    "${l10n(R.string.this_action_requires_a_sign_in_within_th_2498dc)} ${RecentLogin.MAX_AGE_MINUTES} ${l10n(R.string.minutes_sign_in_again_to_return_here_2777f9)}",
                    BBTextStyle.Body, color = c.mutedForeground,
                )
            }
        }
        if (sent) {
            BBText(l10n(R.string.we_sent_a_code_to_0_enter_it_to_continue_5c54a8, email), BBTextStyle.Body)
            OneTimeCodeField(code, { code = SignIn.sanitizeCode(it) }, l10n(R.string.sign_in_code_103136), isError = error != null, enabled = !verifying)
            BBButton(l10n(R.string.confirm_code_00ae35), {
                verifying = true
                error = null
                scope.launch {
                    try {
                        env.auth.verifyCode(SignIn.normalizeEmail(email), code)
                        model.reauthenticated()
                        onDone()
                    } catch (e: Exception) {
                        error = strings.lookup(SignIn.verifyFailure(e).message)
                        code = ""
                    }
                    verifying = false
                }
            }, size = BBButtonSize.Sm, isLoading = verifying, enabled = SignIn.isCompleteCode(code))
        } else {
            BBButton(l10n(R.string.send_me_a_sign_in_code_39e556), {
                sending = true
                error = null
                scope.launch {
                    try {
                        env.auth.sendCode(SignIn.normalizeEmail(email))
                        sent = true
                    } catch (e: Exception) {
                        error = sendError
                    }
                    sending = false
                }
            }, size = BBButtonSize.Sm, isLoading = sending)
        }
        error?.let { BBText(it, BBTextStyle.Body, color = c.neg) }
    }
}
