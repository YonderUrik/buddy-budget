package io.buddybudget.app.features.accounts

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import io.buddybudget.app.BuildConfig
import io.buddybudget.app.designsystem.BuddyBudgetTheme
import io.buddybudget.app.designsystem.components.AmountText
import io.buddybudget.app.designsystem.components.BBAlertSheet
import io.buddybudget.app.designsystem.components.BBButton
import io.buddybudget.app.designsystem.components.BBButtonSize
import io.buddybudget.app.designsystem.components.BBButtonVariant
import io.buddybudget.app.designsystem.components.BBIconBadge
import io.buddybudget.app.designsystem.components.BBKeyboard
import io.buddybudget.app.designsystem.components.BBSelect
import io.buddybudget.app.designsystem.components.BBSheet
import io.buddybudget.app.designsystem.components.BBStyles
import io.buddybudget.app.designsystem.components.BBText
import io.buddybudget.app.designsystem.components.BBTextField
import io.buddybudget.app.designsystem.components.LocalBBLocale
import io.buddybudget.app.designsystem.components.bbPressable
import io.buddybudget.app.designsystem.components.bbSwatch
import io.buddybudget.app.designsystem.generated.BBIcon
import io.buddybudget.app.designsystem.generated.BBRadius
import io.buddybudget.app.designsystem.generated.BBSpacing
import io.buddybudget.app.designsystem.generated.BBTextStyle
import io.buddybudget.app.tr
import io.buddybudget.core.data.Account
import io.buddybudget.core.domain.accounts.AccountEdits
import io.buddybudget.core.domain.accounts.AccountOptions
import io.buddybudget.core.domain.accounts.AccountRemoval
import io.buddybudget.core.domain.accounts.SyncAvailability
import io.buddybudget.core.domain.format.BBFormat
import java.time.ZoneId
import kotlin.math.roundToLong

/** Balance as typed text with the Italian decimal comma ("1234,5"); `AmountInput` normalizes later edits. */
fun editableAmount(value: Double): String {
    val cents = (value * 100).roundToLong()
    val text = if (cents % 100 == 0L) (cents / 100).toString() else (cents / 100.0).toString()
    return text.replace('.', ',')
}

/**
 * Account detail (ACC-032…042): rename on exit, icon/colour saved immediately, manual type and balance, linked sync box,
 * movements, delete/unlink with confirmation. Twin of `AccountDetailSheet` on iOS.
 */
@Composable
fun AccountDetailSheet(model: AccountsModel, account: Account) {
    val c = BuddyBudgetTheme.colors
    val context = LocalContext.current
    val locale = LocalBBLocale.current
    var name by remember { mutableStateOf(account.name) }
    val preset = remember { if (account.type in AccountOptions.typePresets) account.type else null }
    var typePreset by remember { mutableStateOf(preset) }
    var customType by remember { mutableStateOf(if (preset == null) account.type else "") }
    var balance by remember { mutableStateOf(editableAmount(account.balance)) }
    var picker by remember { mutableStateOf(false) }
    var confirm by remember { mutableStateOf(false) }
    val current by rememberUpdatedState(account)

    fun commitName() {
        val patch = AccountEdits.rename(current, name)
        if (patch != null) model.update(current, patch) else if (name.trim() != current.name) name = current.name
    }
    fun commitType() = model.update(current, AccountEdits.retype(current, customType))
    fun commitBalance() = model.update(current, AccountEdits.rebalance(current, balance))

    LaunchedEffect(Unit) {
        if (BuildConfig.DEBUG && context.findActivity()?.intent?.getStringExtra("bbAccounts") == "delete") confirm = true
    }
    DisposableEffect(Unit) {
        onDispose {
            commitName()
            if (!current.isLinked) commitBalance()
        }
    }

    val status = model.status(account)
    val syncing = model.isSyncing(account)
    val copy = AccountRemoval.copy(account)
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space4)) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
            val label = tr("Cambia icona e colore")
            Box(Modifier.bbPressable({ picker = true }, CircleShape, translate = false).semantics { contentDescription = label }) {
                BBIconBadge(BBIcon.account(account.icon), bbSwatch(account.color), 48.dp, 22.dp)
            }
            Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space0_5)) {
                BBText(account.name, Modifier.semantics { heading() }, BBTextStyle.CardTitle.style.copy(fontSize = 18.sp, lineHeight = 24.sp), maxLines = 1)
                BBText("${tr(if (account.isLinked) "Collegato alla banca" else "Conto manuale")} · ${tr(status.label)}", BBTextStyle.Body,
                    color = c.mutedForeground, maxLines = 2)
            }
        }
        BBTextField(name, { name = it }, label = tr("Nome"), height = 44.dp, onSubmit = { commitName() }, onBlur = { commitName() })

        if (account.isLinked) {
            Row(
                Modifier.fillMaxWidth().background(c.muted.copy(alpha = 0.4f), RoundedCornerShape(BBRadius.lg)).padding(BBSpacing.space3),
                horizontalArrangement = Arrangement.spacedBy(BBSpacing.space3),
            ) {
                Column(Modifier.weight(1f)) {
                    BBText(tr("Tipo"), BBTextStyle.Body, color = c.text2)
                    BBText(account.type, BBTextStyle.BodyStrong)
                }
                Column(Modifier.weight(1f)) {
                    BBText(tr("Saldo dalla banca"), BBTextStyle.Body, color = c.text2)
                    AmountText(account.balance, model.currency, style = BBStyles.rowAmount.copy(fontSize = 14.sp, lineHeight = 20.sp))
                }
            }
            val starting = account.id in model.syncStarting
            val health = account.health
            Column(
                Modifier.fillMaxWidth().border(1.dp, c.border, RoundedCornerShape(BBRadius.lg)).padding(BBSpacing.space3),
                verticalArrangement = Arrangement.spacedBy(BBSpacing.space2),
            ) {
                BBText(accountsText(SyncAvailability.sentence(health, syncing, locale, ZoneId.systemDefault())), BBTextStyle.Body, color = c.text2)
                Row(horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
                    BBButton(
                        tr("Sincronizza ora"), { model.sync(account) }, Modifier.weight(1f), icon = BBIcon.RefreshCw, variant = BBButtonVariant.Outline,
                        size = BBButtonSize.Touch, fullWidth = true, isLoading = starting || syncing,
                        enabled = SyncAvailability.canSync(health, syncing, starting),
                    )
                    if (health?.needsRenewal == true) {
                        BBButton(tr("Riconnetti la banca"), { model.openNewAccount(true) }, Modifier.weight(1f), size = BBButtonSize.Touch, fullWidth = true)
                    }
                }
            }
        } else {
            Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space1_5)) {
                BBSelect(
                    AccountOptions.typePresets.map<String, Pair<String?, String>> { it to tr(it) } + (null to tr("Altro…")),
                    typePreset, { next ->
                        typePreset = next
                        if (next != null) model.update(current, AccountEdits.retype(current, next))
                    }, label = tr("Tipo"), height = 44.dp,
                )
                if (typePreset == null) {
                    BBTextField(customType, { customType = it }, placeholder = tr("Es. Wallet crypto"), height = 44.dp,
                        onSubmit = { commitType() }, onBlur = { commitType() })
                }
            }
            Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space1_5)) {
                BBTextField(
                    balance, { balance = it }, label = tr("Saldo"), keyboard = BBKeyboard.SignedAmount,
                    prefix = BBFormat.getCurrencySymbol(model.currency, locale), height = 44.dp, onSubmit = { commitBalance() }, onBlur = { commitBalance() },
                )
                BBText(tr("Lo aggiorni tu: si salva quando esci dal campo."), BBTextStyle.Body, color = c.text2)
            }
        }
        BBButton(tr("Vedi i movimenti di questo conto"), { model.showMovements(account) }, icon = BBIcon.ListOrdered,
            variant = BBButtonVariant.Outline, size = BBButtonSize.Touch, fullWidth = true)
        BBButton(tr(copy.action), { confirm = true }, icon = if (account.isLinked) BBIcon.Link2Off else BBIcon.Trash2,
            variant = BBButtonVariant.Destructive, size = BBButtonSize.Touch, fullWidth = true)
    }
    BBSheet(picker, { picker = false }) {
        AppearancePicker(account.color, account.icon) { color, icon -> model.update(current, AccountEdits.appearance(current, color, icon)) }
    }
    BBAlertSheet(
        confirm, tr(copy.title), accountsText(copy.message), tr(copy.confirm), onConfirm = { model.remove(account) },
        onDismiss = { confirm = false }, icon = if (account.isLinked) BBIcon.Link2Off else BBIcon.Trash2,
    )
}
