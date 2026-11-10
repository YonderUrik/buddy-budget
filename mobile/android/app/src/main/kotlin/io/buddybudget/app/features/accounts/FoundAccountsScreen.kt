package io.buddybudget.app.features.accounts

import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import io.buddybudget.app.designsystem.BuddyBudgetTheme
import io.buddybudget.app.designsystem.components.BBButton
import io.buddybudget.app.designsystem.components.BBButtonSize
import io.buddybudget.app.designsystem.components.BBCheckbox
import io.buddybudget.app.designsystem.components.BBScreen
import io.buddybudget.app.designsystem.components.BBSelect
import io.buddybudget.app.designsystem.components.BBText
import io.buddybudget.app.designsystem.components.LoadError
import io.buddybudget.app.designsystem.components.bbPressable
import io.buddybudget.app.designsystem.generated.BBRadius
import io.buddybudget.app.designsystem.generated.BBSpacing
import io.buddybudget.app.designsystem.generated.BBTextStyle
import io.buddybudget.app.features.settings.Loadable
import io.buddybudget.app.tr
import io.buddybudget.core.data.ExistingAutoAccount
import io.buddybudget.core.data.ExternalBankAccount
import io.buddybudget.core.domain.accounts.FoundAccounts
import kotlinx.coroutines.launch

/**
 * «Conti trovati» after the bank consent (ACC-023…028): one card per shared account, «Crea nuovo conto» or
 * «Ricollega a "…"», «Conferma» → initial import job, back to Conti. Twin of `FoundAccountsScreen` on iOS.
 */
@Composable
fun FoundAccountsScreen(model: FoundAccountsModel, onClose: (Boolean) -> Unit) {
    val c = BuddyBudgetTheme.colors
    val scope = rememberCoroutineScope()
    LaunchedEffect(model) { model.load() }
    BBScreen(tr("Conti trovati"), onBack = { onClose(false) }) {
        Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space4)) {
            when (val state = model.accounts) {
                is Loadable.Loading -> BBText(tr("Caricamento conti trovati…"), BBTextStyle.Body, color = c.mutedForeground)
                is Loadable.Failed -> LoadError(tr("Impossibile caricare i conti trovati."), { scope.launch { model.load() } })
                is Loadable.Loaded -> if (state.value.externalAccounts.isEmpty()) {
                    BBText(tr("La banca non ha condiviso nessun conto. Riprova il collegamento se pensi sia un errore."), BBTextStyle.Body,
                        color = c.mutedForeground)
                } else {
                    BBText(tr("Seleziona quali conti importare. Puoi crearne di nuovi o ricollegarli a un conto già esistente."),
                        Modifier.offset(y = (-12).dp), BBTextStyle.Body.style, color = c.mutedForeground)
                    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
                        state.value.externalAccounts.forEach { FoundAccountCard(model, it, state.value.existingAutoAccounts) }
                    }
                    BBButton(tr(if (model.finalizing) "Avvio…" else "Conferma"), { scope.launch { if (model.confirm()) onClose(true) } },
                        size = BBButtonSize.Touch, fullWidth = true, enabled = !model.finalizing)
                    model.error?.let { BBText(it, BBTextStyle.Body, color = c.destructive) }
                }
            }
        }
    }
}

@Composable
private fun FoundAccountCard(model: FoundAccountsModel, account: ExternalBankAccount, existing: List<ExistingAutoAccount>) {
    val c = BuddyBudgetTheme.colors
    val id = account.externalAccountId
    Column(
        Modifier.fillMaxWidth().border(1.dp, c.border, RoundedCornerShape(BBRadius.xl)).padding(BBSpacing.space3),
        verticalArrangement = Arrangement.spacedBy(BBSpacing.space3),
    ) {
        Row(
            Modifier.fillMaxWidth().bbPressable({ model.toggle(id) }, RoundedCornerShape(BBRadius.md), translate = false),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(BBSpacing.space3),
        ) {
            BBCheckbox(id in model.selected, { model.toggle(id) }, accessibilityLabel = FoundAccounts.displayName(account))
            Column(Modifier.weight(1f)) {
                BBText(FoundAccounts.displayName(account), BBTextStyle.BodyStrong)
                account.details.iban?.let { BBText(it, style = BBTextStyle.Caption.style.copy(lineHeight = 16.sp), color = c.mutedForeground) }
            }
        }
        BBSelect(
            listOf<Pair<String?, String>>(null to tr("Crea nuovo conto")) + existing.map { it.id to tr("Ricollega a \"{0}\"", mapOf("0" to it.name)) },
            model.targets[id], { model.setTarget(id, it) }, height = 44.dp,
        )
    }
}
