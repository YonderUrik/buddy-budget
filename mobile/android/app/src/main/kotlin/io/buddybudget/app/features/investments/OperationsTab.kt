package io.buddybudget.app.features.investments

import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import io.buddybudget.app.designsystem.BuddyBudgetTheme
import io.buddybudget.app.designsystem.components.BBBadge
import io.buddybudget.app.designsystem.components.BBBadgeVariant
import io.buddybudget.app.designsystem.components.BBButton
import io.buddybudget.app.designsystem.components.BBButtonSize
import io.buddybudget.app.designsystem.components.BBButtonVariant
import io.buddybudget.app.designsystem.components.BBIconButton
import io.buddybudget.app.designsystem.components.BBSeparator
import io.buddybudget.app.designsystem.components.BBText
import io.buddybudget.app.designsystem.components.LocalBBLocale
import io.buddybudget.app.designsystem.components.LocalHideAmounts
import io.buddybudget.app.designsystem.components.ScrollableSegmentedControl
import io.buddybudget.app.designsystem.components.SegmentedControl
import io.buddybudget.app.designsystem.components.bbDisabled
import io.buddybudget.app.designsystem.generated.BBIcon
import io.buddybudget.app.designsystem.generated.BBSpacing
import io.buddybudget.app.designsystem.generated.BBTextStyle
import io.buddybudget.app.tr
import io.buddybudget.core.data.Instrument
import io.buddybudget.core.data.InvestmentsView
import io.buddybudget.core.data.OperationMonth
import io.buddybudget.core.data.OperationResult
import io.buddybudget.core.data.OperationTotals
import io.buddybudget.core.domain.format.BBFormat
import io.buddybudget.core.domain.investments.InvestmentsRules
import io.buddybudget.core.domain.investments.InvestmentsText
import io.buddybudget.core.domain.investments.operationTypeLabel

/** Investimenti › Operazioni (INV-056…061). iOS: OperationsTab.swift. */
@Composable
fun OperationsTab(model: InvestmentsModel) {
    val query = model.state.baseQuery
    InvestmentsGateView(model.gate(query, countsCash = false), model, { model.launch { model.loadView(query) } }) {
        val view = model.views[query] ?: return@InvestmentsGateView
        OperationsContent(model, view)
    }
}

@Composable
private fun OperationsContent(model: InvestmentsModel, view: InvestmentsView) {
    val c = BuddyBudgetTheme.colors
    val text = investmentsText()
    var year by remember { mutableStateOf<Int?>(null) }
    var showAll by remember { mutableStateOf(false) }
    var deleting by remember { mutableStateOf<String?>(null) }
    val options = InvestmentsRules.yearOptions(view.operationYears)
    val selected = year?.takeIf { it in view.operationYears }
    val filtered = if (selected == null) view.operationMonths else view.operationMonths.filter { it.year == selected }
    val months = InvestmentsRules.visibleMonths(view.operationMonths, selected, showAll)
    val totals = InvestmentsRules.totals(view.operationMonths, selected, view.operationTotals)
    val years = options.map { (it ?: 0) to (it?.toString() ?: tr("Tutti")) }
    PanelSection(tr("Operazioni"), BBIcon.ArrowLeftRight, action = {
        if (years.isNotEmpty() && years.size <= TitleSegments.MAX_INLINE) {
            io.buddybudget.app.designsystem.components.SegmentedControl(years, selected ?: 0, { year = if (it == 0) null else it }, accessibilityLabel = tr("Anno delle operazioni"))
        }
    }) {
        if (years.size > TitleSegments.MAX_INLINE) {
            ScrollableSegmentedControl(years, selected ?: 0, { year = if (it == 0) null else it }, accessibilityLabel = tr("Anno delle operazioni"))
        }
        if (view.operationMonths.isEmpty()) {
            BBText(tr("Nessuna operazione registrata."), BBTextStyle.Body, color = c.mutedForeground)
        } else {
            TotalsView(totals, view.currency, text)
            Column(Modifier.fullBleed()) {
                months.forEach { month ->
                    MonthGroup(month, view, text, deleting, onEdit = { model.openEdit(it) }) { op ->
                        deleting = op.id
                        model.launch {
                            model.delete(op)
                            deleting = null
                        }
                    }
                }
            }
            if (filtered.size > InvestmentsRules.RECENT_MONTHS) {
                Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                    BBButton(if (showAll) tr("Mostra solo i mesi più recenti") else tr("Mostra tutti i mesi ({0})", mapOf("0" to filtered.size.toString())),
                        { showAll = !showAll }, variant = BBButtonVariant.Outline, size = BBButtonSize.Sm)
                }
            }
        }
    }
}

@Composable
private fun TotalsView(totals: OperationTotals, currency: String, text: InvestmentsText) {
    val c = BuddyBudgetTheme.colors
    val hide = LocalHideAmounts.current
    val locale = LocalBBLocale.current
    val money = { v: Double -> text.money(v, currency, 0, hide) }
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
        Row(horizontalArrangement = Arrangement.spacedBy(BBSpacing.space4)) {
            Stat(tr("Acquistato"), money(totals.bought), Modifier.weight(1f))
            Stat(tr("Venduto"), money(totals.sold), Modifier.weight(1f))
        }
        Row(horizontalArrangement = Arrangement.spacedBy(BBSpacing.space4)) {
            Stat(tr("Dividendi e cedole"), money(totals.income), Modifier.weight(1f))
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(2.dp)) {
                    BBText(tr("Guadagno"), BBTextStyle.Caption, color = c.mutedForeground)
                    InfoHintButton(tr("Come si calcola il guadagno"),
                        tr("Per un acquisto è quanto valgono oggi le quote ancora possedute rispetto a quanto le hai pagate; per una vendita è il guadagno realizzato."))
                }
                BBText(BBFormat.formatSignedCurrency(totals.gain, currency, locale, hide),
                    style = BBTextStyle.CardTitle.style.copy(fontSize = 18.sp, lineHeight = 26.sp, fontFeatureSettings = "tnum"), color = signedColor(totals.gain), maxLines = 1)
                totals.gainPct?.let { BBText("${text.pct(it)} ${tr("sul costo")}", BBTextStyle.Caption, color = c.mutedForeground) }
            }
        }
        if (totals.unpricedCount > 0) {
            BBText(if (totals.unpricedCount == 1) tr("1 acquisto senza prezzo di oggi è escluso dal guadagno.")
            else tr("{0} acquisti senza prezzo di oggi sono esclusi dal guadagno.", mapOf("0" to totals.unpricedCount.toString())), BBTextStyle.Caption, color = c.mutedForeground)
        }
    }
}

@Composable
private fun Stat(label: String, value: String, modifier: Modifier) {
    Column(modifier, verticalArrangement = Arrangement.spacedBy(2.dp)) {
        BBText(label, BBTextStyle.Caption, color = BuddyBudgetTheme.colors.mutedForeground)
        BBText(value, style = BBTextStyle.CardTitle.style.copy(fontSize = 18.sp, lineHeight = 26.sp, fontFeatureSettings = "tnum"), maxLines = 1)
    }
}

@Composable
private fun MonthGroup(month: OperationMonth, view: InvestmentsView, text: InvestmentsText, deleting: String?, onEdit: (OperationResult) -> Unit,
    onDelete: (OperationResult) -> Unit) {
    val c = BuddyBudgetTheme.colors
    val hide = LocalHideAmounts.current
    val locale = LocalBBLocale.current
    val totals = month.totals
    val parts = text.monthParts(totals, view.currency, hide)
    Column {
        Column(Modifier.fillMaxWidth().background(c.muted.copy(alpha = 0.5f)).padding(horizontal = BBSpacing.space4, vertical = BBSpacing.space2),
            verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
                BBText(BBFormat.capitalize(BBFormat.formatMonthLabel(month.key, locale)), style = BBTextStyle.BodyStrong.style.copy(fontWeight = FontWeight.SemiBold))
                BBText(if (totals.count == 1) tr("1 operazione") else tr("{0} operazioni", mapOf("0" to totals.count.toString())), BBTextStyle.Caption,
                    color = c.mutedForeground)
            }
            val line = buildAnnotatedString {
                withStyle(SpanStyle(color = c.mutedForeground)) { append(if (parts.isEmpty()) "" else "$parts · ") }
                withStyle(SpanStyle(color = signedColor(totals.gain))) { append(text.gainText(totals.gain, totals.gainPct, view.currency, hide)) }
            }
            Text(line, style = BBTextStyle.Caption.style.copy(fontFeatureSettings = "tnum"))
        }
        month.operations.forEachIndexed { i, op ->
            OperationRowView(op, view.instrument(op.transaction.instrumentId), view.currency, text, deleting == op.id, { onEdit(op) }, { onDelete(op) })
        }
    }
}

@Composable
private fun OperationRowView(op: OperationResult, instrument: Instrument?, currency: String, text: InvestmentsText, deleting: Boolean, onEdit: () -> Unit,
    onDelete: () -> Unit) {
    val c = BuddyBudgetTheme.colors
    val hide = LocalHideAmounts.current
    val t = op.transaction
    val editable = InvestmentsRules.canEdit(t)
    val amount = if (t.type == "acquisto") op.paid else op.received
    Row(Modifier.padding(start = BBSpacing.space4, end = BBSpacing.space2, top = BBSpacing.space3, bottom = BBSpacing.space3),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
                BBBadge(tr(operationTypeLabel(t.type)), variant = if (t.type == "vendita" || t.type == "rimborso") BBBadgeVariant.Outline else BBBadgeVariant.Secondary)
                BBText(instrument?.name ?: tr("Strumento"), BBTextStyle.BodyStrong, maxLines = 1)
            }
            BBText(text.operationDetails(op, instrument), BBTextStyle.Caption, color = c.mutedForeground)
        }
        Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(2.dp)) {
            if (t.type != "split" && t.type != "rettifica") {
                BBText(text.money(amount, currency, masked = hide), style = BBTextStyle.BodyStrong.style.copy(fontFeatureSettings = "tnum"))
            }
            val gain = op.gain
            if (gain != null) {
                BBText(text.gainText(gain, op.gainPct, currency, hide), style = BBTextStyle.Caption.style.copy(fontFeatureSettings = "tnum"), color = signedColor(gain))
            } else if (t.type == "acquisto") {
                BBText(tr(if ((op.remainingQuantity ?: 0.0) <= 1e-9) "Quote vendute" else "Senza prezzo di oggi"), BBTextStyle.Caption, color = c.mutedForeground)
            }
        }
        if (editable) Box(Modifier.width(36.dp)) { BBIconButton(BBIcon.Pencil, tr("Modifica operazione"), color = c.mutedForeground, onClick = onEdit) }
        Box(Modifier.width(36.dp).bbDisabled(deleting || !editable)) {
            BBIconButton(BBIcon.Trash2, tr("Elimina operazione"), color = c.mutedForeground) { if (!deleting && editable) onDelete() }
        }
    }
}
