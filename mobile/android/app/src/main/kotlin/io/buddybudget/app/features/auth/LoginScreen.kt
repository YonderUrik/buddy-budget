package io.buddybudget.app.features.auth

import androidx.compose.foundation.layout.Row
import androidx.compose.runtime.setValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.autofill.ContentType
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.contentType
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import io.buddybudget.app.LocalEnv
import io.buddybudget.app.R
import io.buddybudget.app.debug.DebugLaunch
import io.buddybudget.app.designsystem.BuddyBudgetTheme
import io.buddybudget.app.designsystem.components.BBButton
import io.buddybudget.app.designsystem.components.BBButtonSize
import io.buddybudget.app.designsystem.components.BBButtonVariant
import io.buddybudget.app.designsystem.components.BBContentType
import io.buddybudget.app.designsystem.components.BBIconView
import io.buddybudget.app.designsystem.components.BBKeyboard
import io.buddybudget.app.designsystem.components.BBLinkPart
import io.buddybudget.app.designsystem.components.BBLinkText
import io.buddybudget.app.designsystem.components.BBText
import io.buddybudget.app.designsystem.components.BBTextField
import io.buddybudget.app.designsystem.components.bbDisabled
import io.buddybudget.app.designsystem.generated.BBFontFamilies
import io.buddybudget.app.designsystem.generated.BBIcon
import io.buddybudget.app.designsystem.generated.BBLayout
import io.buddybudget.app.designsystem.generated.BBRadius
import io.buddybudget.app.designsystem.generated.BBSpacing
import io.buddybudget.app.designsystem.generated.BBTextStyle
import io.buddybudget.app.generated.L10n
import io.buddybudget.app.generated.l10n
import io.buddybudget.app.tr
import io.buddybudget.core.data.AuthApi
import io.buddybudget.core.data.LegalMeta
import io.buddybudget.core.domain.auth.SignIn
import io.buddybudget.core.domain.shell.ExternalLinks
import kotlinx.coroutines.launch

/**
 * Sign-in with an emailed 6-digit code (AUTH-001…010, decision 0003: Google/Apple not shown yet).
 * Step 1: email; step 2: «Controlla la tua email» with the code field, resend countdown and «Usa un'altra email».
 */
@Composable
fun LoginScreen() {
    val env = LocalEnv.current
    val scope = rememberCoroutineScope()
    val model = remember {
        LoginModel(env.auth, env.session.prefillEmail, scope) { email ->
            // AUTH-059: remember the account on this device for «Rientra in BuddyBudget».
            env.preferences.setString(io.buddybudget.core.domain.auth.ReturningUser.KEY, email)
            env.session.signedIn()
        }
    }
    var remembered by remember { mutableStateOf(io.buddybudget.core.domain.auth.ReturningUser.parse(env.preferences.string(io.buddybudget.core.domain.auth.ReturningUser.KEY))) }
    LaunchedEffect(Unit) {
        val code = DebugLaunch.code
        if (code != null) model.debugEnterCode(code) else if (DebugLaunch.autoSend) model.sendCode()
    }
    LaunchedEffect(env.session.language) { env.session.loadLegal() }
    AuthScaffold {
        val returning = remembered
        when {
            model.step == LoginModel.Step.Email && returning != null && !env.session.accountDeletedNotice ->
                ReturningStep(model, returning, env.session.legal) {
                    env.preferences.remove(io.buddybudget.core.domain.auth.ReturningUser.KEY)
                    remembered = null
                    model.email = ""
                }
            model.step == LoginModel.Step.Email -> EmailStep(model, env.session.legal)
            else -> CodeStep(model)
        }
    }
}

/** AUTH-059: «Rientra in BuddyBudget» — the remembered account, one button for the code, «Non sei tu?». */
@Composable
private fun ReturningStep(model: LoginModel, email: String, legal: LegalMeta?, onForget: () -> Unit) {
    val c = BuddyBudgetTheme.colors
    val scope = rememberCoroutineScope()
    val masked = io.buddybudget.core.domain.auth.ReturningUser.mask(email)
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space7)) {
        Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
            BBText(l10n(R.string.sign_back_in_to_buddybudget_f9119c), Modifier.semantics { heading() }, LoginTitle)
            BBText(l10n(R.string.we_remember_your_account_on_this_device_0cd196), BBTextStyle.BodyLarge, color = c.text2)
        }
        Row(
            Modifier.fillMaxWidth().border(1.dp, c.border, RoundedCornerShape(BBRadius.xl)).background(c.background, RoundedCornerShape(BBRadius.xl))
                .padding(horizontal = BBSpacing.space4, vertical = BBSpacing.space3_5),
            verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space3),
        ) {
            Box(Modifier.size(40.dp).background(c.muted, CircleShape), contentAlignment = Alignment.Center) {
                BBText(masked.take(1).uppercase(), BBTextStyle.CardTitle)
            }
            Column(Modifier.weight(1f)) {
                BBText(masked, BBTextStyle.BodyStrong, maxLines = 1)
                BBText(l10n(R.string.last_signed_in_with_the_emailed_code_01fa58), BBTextStyle.Body, color = c.text3)
            }
        }
        Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
            BBButton(
                if (model.sending) l10n(R.string.sending_c05ed4) else l10n(R.string.send_me_the_code_37e79c),
                { model.email = email; scope.launch { model.sendCode() } },
                variant = BBButtonVariant.Sun, size = BBButtonSize.Touch, fullWidth = true, isLoading = model.sending, enabled = !model.busy,
            )
            val failure = model.failure
            if (failure != null) BBText(tr(failure.message), BBTextStyle.Body, color = c.destructive)
            else BBText(l10n(R.string.the_code_goes_to_this_address_and_is_val_de7b7b, AuthApi.CODE_VALIDITY_MINUTES.toString()), BBTextStyle.Body, color = c.text3)
            BBButton(l10n(R.string.not_you_use_another_account_b18acb), onForget, variant = BBButtonVariant.Ghost, size = BBButtonSize.Touch, fullWidth = true, enabled = !model.busy)
        }
        LegalNote(legal)
    }
}

@Composable
private fun LegalNote(legal: LegalMeta?) {
    BBLinkText(
        listOf(
            BBLinkPart.Plain(l10n(R.string.by_continuing_you_accept_the_5b3c97) + " "),
            BBLinkPart.Link(l10n(R.string.terms_of_service_f7a038), ExternalLinks.legal("termini", legal)),
            BBLinkPart.Plain(" " + l10n(R.string.and_confirm_you_have_read_the_77b403) + " "),
            BBLinkPart.Link(l10n(R.string.privacy_cf0148), ExternalLinks.legal("privacy", legal)),
            BBLinkPart.Plain(l10n(R.string.we_only_use_ac5858) + " "),
            BBLinkPart.Link(l10n(R.string.technical_tools_818fc0), ExternalLinks.legal("cookie", legal)),
            BBLinkPart.Plain("."),
        ),
        Modifier.fillMaxWidth(), textAlign = TextAlign.Center,
    )
}

@Composable
private fun EmailStep(model: LoginModel, legal: LegalMeta?) {
    val env = LocalEnv.current
    val c = BuddyBudgetTheme.colors
    val scope = rememberCoroutineScope()
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space7)) {
        if (env.session.accountDeletedNotice) {
            Box(Modifier.drawBehind { drawRect(c.primary, size = Size(2.dp.toPx(), size.height)) }.padding(start = BBSpacing.space3)) {
                BBText(l10n(R.string.your_account_and_all_your_data_have_been_a3d39d), BBTextStyle.Body, color = c.text2)
            }
        }
        Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
            BBText("${l10n(R.string.sign_in_to_adbf6a)} ${l10n(L10n.appName)}", Modifier.semantics { heading() }, LoginTitle)
            BBText(l10n(R.string.a_code_by_email_no_password_if_it_s_your_7e8fbd), BBTextStyle.BodyLarge, color = c.text2)
        }
        Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
            BBTextField(
                model.email, { model.email = it }, label = l10n(R.string.email_84add5),
                placeholder = l10n(R.string.name_example_com_4806d5), keyboard = BBKeyboard.Email, enabled = !model.busy,
                height = BBLayout.minTouchTarget, contentType = BBContentType.Email, imeAction = ImeAction.Send,
                onSubmit = { scope.launch { model.sendCode() } }, autofocus = true,
            )
            val failure = model.failure
            if (failure != null) {
                BBText(tr(failure.message), BBTextStyle.Body, color = c.destructive)
            } else {
                BBText(l10n(R.string.the_code_is_valid_for_0_minutes_and_work_a9f139, AuthApi.CODE_VALIDITY_MINUTES.toString()), BBTextStyle.Body, color = c.text3)
            }
            BBButton(
                if (model.sending) l10n(R.string.sending_c05ed4) else l10n(R.string.send_me_the_code_37e79c),
                { scope.launch { model.sendCode() } },
                Modifier.padding(top = BBSpacing.space3), variant = BBButtonVariant.Sun, size = BBButtonSize.Touch, fullWidth = true,
                isLoading = model.sending, enabled = !model.busy,
            )
        }
        BBLinkText(
            listOf(
                BBLinkPart.Plain(l10n(R.string.by_continuing_you_accept_the_5b3c97) + " "),
                BBLinkPart.Link(l10n(R.string.terms_of_service_f7a038), ExternalLinks.legal("termini", legal)),
                BBLinkPart.Plain(" " + l10n(R.string.and_confirm_you_have_read_the_77b403) + " "),
                BBLinkPart.Link(l10n(R.string.privacy_cf0148), ExternalLinks.legal("privacy", legal)),
                BBLinkPart.Plain(l10n(R.string.we_only_use_ac5858) + " "),
                BBLinkPart.Link(l10n(R.string.technical_tools_818fc0), ExternalLinks.legal("cookie", legal)),
                BBLinkPart.Plain("."),
            ),
            Modifier.fillMaxWidth(), textAlign = TextAlign.Center,
        )
    }
}

@Composable
private fun CodeStep(model: LoginModel) {
    val c = BuddyBudgetTheme.colors
    val scope = rememberCoroutineScope()
    Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
        Box(Modifier.size(56.dp).background(c.posSoft, CircleShape), contentAlignment = Alignment.Center) {
            BBIconView(BBIcon.MailCheck, size = 28.dp, color = c.pos)
        }
        BBText(l10n(R.string.check_your_email_8de917), Modifier.padding(top = BBSpacing.space6).semantics { heading() }, AuthTitle.copy(textAlign = TextAlign.Center))
        BBText(
            l10n(R.string.we_sent_a_sign_in_code_to_0_it_stays_val_1f2c5c, model.normalizedEmail, AuthApi.CODE_VALIDITY_MINUTES.toString()),
            Modifier.padding(top = BBSpacing.space3), BBTextStyle.BodyLarge.style.copy(textAlign = TextAlign.Center), color = c.text2,
        )
        BBText(
            l10n(R.string.cannot_find_it_check_your_spam_folder_to_aa4798),
            Modifier.padding(top = BBSpacing.space2), BBTextStyle.Body.style.copy(textAlign = TextAlign.Center), color = c.text3,
        )
        OneTimeCodeField(
            model.code, model::updateCode, l10n(R.string.sign_in_code_103136),
            Modifier.padding(top = BBSpacing.space8), isError = model.failure != null, enabled = !model.verifying,
        )
        model.failure?.let {
            BBText(tr(it.message), Modifier.padding(top = BBSpacing.space3), BBTextStyle.Body.style.copy(textAlign = TextAlign.Center), color = c.destructive)
        }
        Column(Modifier.padding(top = BBSpacing.space6), verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
            BBButton(
                if (model.verifying) l10n(R.string.checking_0a76c7) else l10n(R.string.sign_in_98745f), { scope.launch { model.verify() } },
                variant = BBButtonVariant.Sun, size = BBButtonSize.Touch, fullWidth = true, isLoading = model.verifying, enabled = SignIn.isCompleteCode(model.code),
            )
            val remaining = model.resendRemaining
            BBButton(
                if (remaining > 0) l10n(R.string.resend_in_0_s_b05ab3, remaining.toString()) else l10n(R.string.resend_code_017e1e),
                { scope.launch { model.resend() } }, variant = BBButtonVariant.Outline, size = BBButtonSize.Touch, fullWidth = true,
                isLoading = model.sending, enabled = remaining == 0 && !model.busy,
            )
            BBButton(
                l10n(R.string.use_another_email_ebda99), model::useAnotherEmail, variant = BBButtonVariant.Ghost,
                size = BBButtonSize.Touch, fullWidth = true, enabled = !model.busy,
            )
        }
    }
}

/** Code digits: Hanken medium 28, tabular. */
val CodeDigits = TextStyle(fontFamily = BBFontFamilies.sans, fontWeight = FontWeight.W500, fontSize = 28.sp, lineHeight = 36.sp, letterSpacing = 10.sp, textAlign = TextAlign.Center)

/**
 * The 6-digit code field: one input with the one-time-code autofill hint (SMS/email OTP suggestions), digits only,
 * large monospaced digits. Same look as `OneTimeCodeField` on iOS.
 */
@Composable
fun OneTimeCodeField(
    code: String,
    onChange: (String) -> Unit,
    label: String,
    modifier: Modifier = Modifier,
    isError: Boolean = false,
    enabled: Boolean = true,
    autofocus: Boolean = true,
) {
    val c = BuddyBudgetTheme.colors
    val dark = BuddyBudgetTheme.isDark
    val source = remember { MutableInteractionSource() }
    val focused by source.collectIsFocusedAsState()
    val focusRequester = remember { FocusRequester() }
    if (autofocus) LaunchedEffect(Unit) { runCatching { focusRequester.requestFocus() } }
    val shape = RoundedCornerShape(BBRadius.xl)
    val ring = if (focused) c.alphaRing50 else Color.Transparent
    BasicTextField(
        value = code,
        onValueChange = onChange,
        enabled = enabled,
        singleLine = true,
        textStyle = CodeDigits.copy(color = c.foreground),
        cursorBrush = SolidColor(c.primary),
        interactionSource = source,
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword, imeAction = ImeAction.Done),
        modifier = modifier.fillMaxWidth()
            .focusRequester(focusRequester)
            .semantics {
                contentType = ContentType.SmsOtpCode
                contentDescription = label
            }
            .bbDisabled(!enabled)
            .drawBehind {
                val w = 3.dp.toPx()
                drawRoundRect(ring, Offset(-w / 2 - 0.5f, -w / 2 - 0.5f), Size(size.width + w + 1f, size.height + w + 1f), CornerRadius((BBRadius.xl + 3.dp).toPx() - w / 2), style = Stroke(w))
            }
            .height(56.dp)
            .background(if (dark) c.alphaInput30 else c.background, shape)
            .border(1.dp, if (isError) c.destructive else if (focused) c.ring else c.input, shape),
        decorationBox = { inner ->
            Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                if (code.isEmpty()) BBText("000000", style = CodeDigits, color = c.alphaMutedForeground30)
                inner()
            }
        },
    )
}
