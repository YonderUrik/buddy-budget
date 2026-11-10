package io.buddybudget.app.features.pension

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import io.buddybudget.app.designsystem.BuddyBudgetTheme
import io.buddybudget.app.designsystem.components.BBAlertSheet
import io.buddybudget.app.designsystem.components.BBButton
import io.buddybudget.app.designsystem.components.BBButtonSize
import io.buddybudget.app.designsystem.components.BBButtonVariant
import io.buddybudget.app.designsystem.components.BBDateField
import io.buddybudget.app.designsystem.components.BBErrorBox
import io.buddybudget.app.designsystem.components.BBIconButton
import io.buddybudget.app.designsystem.components.BBIconView
import io.buddybudget.app.designsystem.components.BBKeyboard
import io.buddybudget.app.designsystem.components.BBSelect
import io.buddybudget.app.designsystem.components.BBSeparator
import io.buddybudget.app.designsystem.components.BBStyles
import io.buddybudget.app.designsystem.components.BBSwipeToDelete
import io.buddybudget.app.designsystem.components.BBText
import io.buddybudget.app.designsystem.components.BBTextArea
import io.buddybudget.app.designsystem.components.BBTextField
import io.buddybudget.app.designsystem.components.FormDialogHeader
import io.buddybudget.app.designsystem.components.LocalHideAmounts
import io.buddybudget.app.designsystem.components.bbPressable
import io.buddybudget.app.designsystem.generated.BBIcon
import io.buddybudget.app.designsystem.generated.BBRadius
import io.buddybudget.app.designsystem.generated.BBSpacing
import io.buddybudget.app.designsystem.generated.BBTextStyle
import io.buddybudget.app.features.investments.PanelSection
import io.buddybudget.app.features.investments.debugShows
import io.buddybudget.app.features.liquidity.StepBars
import io.buddybudget.app.features.onboarding.StepHeading
import io.buddybudget.app.tr
import io.buddybudget.core.data.PensionView
import io.buddybudget.core.domain.format.JSNumber
import io.buddybudget.core.domain.imports.ImportDateOrder
import io.buddybudget.core.domain.imports.ImportDecimalSeparator
import io.buddybudget.core.domain.pension.PensionImport
import io.buddybudget.core.domain.pension.PensionImportField
import io.buddybudget.core.domain.pension.PensionImportRow
import io.buddybudget.core.domain.pension.PensionImportState
import io.buddybudget.core.domain.pension.PensionImportTable
import io.buddybudget.core.domain.pension.PensionPlannedRow
import io.buddybudget.core.domain.pension.PensionRules
import kotlinx.coroutines.launch

// Pensione «I tuoi dati» (PEN-005…017): snapshot form and list, fund profile, another fund, the add-fund form and the
// paste import. Twin of PensionDataTab.swift.

@Composable
fun PensionDataTab(model: PensionModel) {
    val c = BuddyBudgetTheme.colors
    val view = model.state.view ?: return
    val fund = view.fund ?: return
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space10)) {
        if (debugShows(0)) SnapshotsSection(model, fund)
        key(fund.id + fund.name + fund.adhesionDate) { FundProfileSection(model, fund) }
        if (view.funds.size < PensionRules.MAX_FUNDS) {
            PanelSection(tr("Hai un altro fondo?"), BBIcon.CirclePlus, color = c.swatchIndigo,
                description = tr("Puoi tracciarne più di uno (per esempio un fondo negoziale e un PIP): il patrimonio netto li somma.")) {
                key(view.funds.size) { AddFundForm(model) }
            }
        }
    }
}

/** PEN-010/011/012. */
@Composable
private fun SnapshotsSection(model: PensionModel, fund: PensionView.Fund) {
    val c = BuddyBudgetTheme.colors
    val text = pensionText()
    val hidden = LocalHideAmounts.current
    val scope = rememberCoroutineScope()
    var date by remember { mutableStateOf(PensionModel.todayKey()) }
    var contributions by remember { mutableStateOf("") }
    var value by remember { mutableStateOf("") }
    var saving by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var showAll by remember { mutableStateOf(false) }
    val net = PensionRules.parseAmount(contributions)
    val v = PensionRules.parseAmount(value)
    val canSave = net != null && v != null && date.isNotEmpty()
    val rows = PensionRules.snapshotRows(fund.snapshots).filter { it.id !in model.pendingSnapshotRemovals }
    val visible = if (showAll) rows else rows.take(PensionRules.VISIBLE_SNAPSHOTS)
    PanelSection(tr("Aggiorna i valori del fondo"), BBIcon.Database, color = c.primary,
        description = tr("Riporta i due numeri che vedi nell'area clienti, ogni volta che vuoi (di solito dopo ogni versamento del TFR). Il versamento lo ricaviamo noi dalla differenza. Se esiste già una fotografia con la stessa data, viene sostituita.")) {
        Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space5)) {
            Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
                Labeled(tr("Data")) { BBDateField(date, { date = minOf(it, model.today) }) }
                Row(horizontalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
                    Labeled(tr("Contributi netti"), Modifier.weight(1f)) {
                        BBTextField(contributions, { contributions = it }, placeholder = tr("es. 10.880"), keyboard = BBKeyboard.Amount)
                    }
                    Labeled(tr("Controvalore"), Modifier.weight(1f)) {
                        BBTextField(value, { value = it }, placeholder = tr("es. 11.420"), keyboard = BBKeyboard.Amount)
                    }
                }
                BBButton(tr(if (saving) "Salvo…" else "Aggiungi"), {
                    if (net != null && v != null) {
                        saving = true
                        error = null
                        scope.launch {
                            error = model.saveSnapshot(date, net, v)
                            if (error == null) { contributions = ""; value = "" }
                            saving = false
                        }
                    }
                }, fullWidth = true, isLoading = saving, enabled = canSave && !saving)
            }
            error?.let { BBText(tr(it), BBTextStyle.Body, color = c.neg) }
            Row(Modifier.heightIn(min = 32.dp).bbPressable({ model.importOpen = true }, RoundedCornerShape(BBRadius.md), translate = false),
                verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space1)) {
                BBText(tr("Hai già uno storico?"), BBTextStyle.Body, color = c.text2)
                BBIconView(BBIcon.Upload, size = 14.dp, color = c.primary)
                BBText(tr("Importa da file CSV o Excel"), style = BBStyles.link, color = c.primary)
            }
            if (rows.isNotEmpty()) {
                Column {
                    visible.forEachIndexed { index, row ->
                        BBSwipeToDelete({ model.removeSnapshot(row.snapshot) }) {
                            Row(Modifier.fillMaxWidth().padding(vertical = BBSpacing.space1), verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
                                Column(Modifier.weight(1f)) {
                                    Row(verticalAlignment = Alignment.Bottom) {
                                        BBText(text.shortDate(row.snapshot.date), BBTextStyle.BodyStrong, Modifier.weight(1f))
                                        BBText(text.money(row.snapshot.value, model.currency, hidden), style = BBStyles.rowAmount.copy(fontWeight = FontWeight.W500))
                                    }
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        BBText("${tr("Contributi netti")} ${text.money(row.snapshot.netContributions, model.currency, hidden)}", BBTextStyle.Caption,
                                            Modifier.weight(1f), color = c.text2, maxLines = 1)
                                        val deltaLabel = "${tr("Versamento")} ${row.delta?.let { text.money(it, model.currency) } ?: "—"}"
                                        BBText(row.delta?.let { "+${text.money(it, model.currency, hidden)}" } ?: "—", BBTextStyle.Caption,
                                            Modifier.semantics { contentDescription = deltaLabel }, color = if (row.delta == null) c.text2 else c.pos)
                                    }
                                }
                                BBIconButton(BBIcon.Trash2, tr("Elimina la fotografia del {0}", mapOf("0" to text.longDate(row.snapshot.date))), color = c.mutedForeground) {
                                    model.removeSnapshot(row.snapshot)
                                }
                            }
                        }
                    }
                }
                if (rows.size > PensionRules.VISIBLE_SNAPSHOTS) {
                    BBButton(if (showAll) tr("Mostra meno") else tr("Mostra tutte ({0})", mapOf("0" to rows.size.toString())), { showAll = !showAll },
                        variant = BBButtonVariant.Ghost, size = BBButtonSize.Sm)
                }
            }
        }
    }
}

@Composable
private fun Labeled(label: String, modifier: Modifier = Modifier, field: @Composable () -> Unit) {
    Column(modifier, verticalArrangement = Arrangement.spacedBy(BBSpacing.space1_5)) {
        BBText(label, BBTextStyle.Body, color = BuddyBudgetTheme.colors.text2)
        field()
    }
}

/** PEN-008/009. */
@Composable
private fun FundProfileSection(model: PensionModel, fund: PensionView.Fund) {
    val c = BuddyBudgetTheme.colors
    val scope = rememberCoroutineScope()
    var name by remember { mutableStateOf(fund.name) }
    var date by remember { mutableStateOf(fund.adhesionDate) }
    var error by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }
    val canSave = PensionRules.canSaveProfile(name, date, fund.name, fund.adhesionDate)
    PanelSection(tr("Dati del fondo"), BBIcon.Landmark, color = c.swatchSlate,
        description = tr("Nome e data di prima adesione: quest'ultima decide l'aliquota in uscita.")) {
        Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space4)) {
            Labeled(tr("Nome del fondo")) { BBTextField(name, { name = it.take(PensionRules.NAME_MAX_LENGTH) }) }
            Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space1_5)) {
                BBText(tr("Prima adesione a una forma pensionistica"), BBTextStyle.Body, color = c.text2)
                BBDateField(date, { date = minOf(it, model.today) })
                BBText(tr("Conta la prima in assoluto, anche in un'altra azienda: decide l'aliquota in uscita."), BBTextStyle.Caption, color = c.text2)
            }
            error?.let { BBText(tr(it), BBTextStyle.Body, color = c.neg) }
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                BBButton(tr("Salva le modifiche"), {
                    busy = true
                    error = null
                    scope.launch {
                        error = model.updateFund(JSNumber.trim(name), date)
                        busy = false
                    }
                }, isLoading = busy, enabled = canSave && !busy)
                Spacer(Modifier.weight(1f))
                BBText(tr("Elimina questo fondo"), style = BBTextStyle.Body.style.copy(textDecoration = TextDecoration.Underline), color = c.text2,
                    modifier = Modifier.heightIn(min = 32.dp).bbPressable({ model.confirmDeleteFund = true }, RoundedCornerShape(BBRadius.md), translate = false)
                        .padding(vertical = 6.dp))
            }
        }
    }
    BBAlertSheet(model.confirmDeleteFund, tr("Eliminare questo fondo?"),
        tr("Verranno cancellate anche tutte le sue fotografie e sparirà dal patrimonio netto. L'operazione non si può annullare."), tr("Elimina"),
        onConfirm = { scope.launch { error = model.deleteFund() } }, onDismiss = { model.confirmDeleteFund = false })
}

/** PEN-006: two steps (name, first adhesion date). */
@Composable
fun AddFundForm(model: PensionModel) {
    val scope = rememberCoroutineScope()
    var step by remember { mutableStateOf(0) }
    var name by remember { mutableStateOf("") }
    var date by remember { mutableStateOf("") }
    var error by remember { mutableStateOf<String?>(null) }
    var pending by remember { mutableStateOf(false) }
    val canContinue = if (step == 1) JSNumber.trim(name).isNotEmpty() && date.isNotEmpty() && !pending else JSNumber.trim(name).isNotEmpty()
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space4)) {
        StepBars(step, 2, tr("Passi del nuovo fondo"))
        if (step == 0) {
            StepHeading(tr("Come si chiama il fondo?"))
            Labeled(tr("Nome del fondo")) {
                BBTextField(name, { name = it.take(PensionRules.NAME_MAX_LENGTH) }, placeholder = tr("es. Piano pensione Moneyfarm"))
            }
        } else {
            StepHeading(tr("Quando hai aderito?"),
                tr("Conta la prima adesione in assoluto a una forma pensionistica, anche in un'altra azienda: decide l'aliquota in uscita."))
            Labeled(tr("Data di prima adesione")) { BBDateField(date.ifEmpty { model.today }, { date = minOf(it, model.today) }) }
        }
        error?.let { BBErrorBox(tr(it), reportArea = io.buddybudget.core.domain.support.ReportErrorArea.Pensione) }
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
            if (step == 1) BBButton(tr("Indietro"), { step = 0 }, variant = BBButtonVariant.Outline)
            Spacer(Modifier.weight(1f))
            BBButton(tr(if (step == 1) (if (pending) "Salvataggio…" else "Aggiungi il fondo") else "Continua"), {
                if (step == 0) {
                    step = 1
                    if (date.isEmpty()) date = model.today
                } else {
                    pending = true
                    error = null
                    scope.launch {
                        error = model.createFund(JSNumber.trim(name), date)
                        pending = false
                    }
                }
            }, isLoading = pending, enabled = canContinue)
        }
    }
}

/** «Importa le fotografie» (PEN-014…017), paste only: Incolla → Colonne → Riepilogo. */
@Composable
fun PensionImportView(model: PensionModel, fund: PensionView.Fund) {
    val c = BuddyBudgetTheme.colors
    val text = pensionText()
    val hidden = LocalHideAmounts.current
    val scope = rememberCoroutineScope()
    var wizard by remember {
        // DEBUG-only `--es bbDialog import-filled`: sample rows read into the Colonne step, for screenshots.
        val sample = if (io.buddybudget.app.debug.DebugLaunch.value("bbDialog") == "import-filled")
            "Data;Contributi netti;Controvalore\n31/03/2026;10880,00;11250,40\n30/06/2026;11420,00;11890,15\n31/13/2026;1;1" else null
        mutableStateOf(PensionImportState(model.today, fund.snapshots).let { if (sample != null) it.copy(text = sample).read() else it })
    }
    var running by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space5)) {
        FormDialogHeader(BBIcon.FileUp, tr("Importa le fotografie"), tr("Da un file CSV o Excel, nel fondo «") + fund.name + "».")
        if (wizard.done == null) {
            val current = wizard.step.ordinal
            val label = tr("Passi dell'import")
            Row(Modifier.fillMaxWidth().semantics(mergeDescendants = true) { contentDescription = label }, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space1_5)) {
                PensionImportState.Step.entries.forEach { step ->
                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(BBSpacing.space1)) {
                        androidx.compose.foundation.layout.Box(Modifier.fillMaxWidth().heightIn(min = 4.dp, max = 4.dp)
                            .background(if (step.ordinal <= current) c.primary else c.alphaForeground10, RoundedCornerShape(50)))
                        BBText(tr(step.label), if (step.ordinal == current) BBTextStyle.BodyStrong else BBTextStyle.Body,
                            color = if (step.ordinal == current) c.foreground else c.text2)
                    }
                }
            }
        }
        when (wizard.step) {
            PensionImportState.Step.File -> PensionFileStep(wizard, { wizard = it })
            PensionImportState.Step.Columns -> ColumnsStep(wizard, { wizard = it }, model.currency, text, hidden)
            PensionImportState.Step.Summary -> SummaryStep(wizard, model.currency, text, hidden)
        }
        (error ?: wizard.error)?.let { BBText(tr(it), BBTextStyle.Body, color = c.neg) }
        if (wizard.done != null) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                BBButton(tr("Chiudi"), { model.importOpen = false }, size = BBButtonSize.Touch)
            }
        } else {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
                BBButton(tr(if (wizard.step == PensionImportState.Step.File) "Annulla" else "Indietro"), {
                    error = null
                    if (wizard.step == PensionImportState.Step.File) model.importOpen = false else wizard = wizard.back()
                }, variant = BBButtonVariant.Ghost, size = BBButtonSize.Touch, enabled = !running)
                Spacer(Modifier.weight(1f))
                when (wizard.step) {
                    PensionImportState.Step.File -> Unit
                    PensionImportState.Step.Columns -> BBButton(tr("Avanti"), { wizard = wizard.copy(step = PensionImportState.Step.Summary) },
                        size = BBButtonSize.Touch, enabled = wizard.canContinue)
                    PensionImportState.Step.Summary -> {
                        val plan = wizard.plan
                        val count = plan.counts.new + plan.counts.update
                        BBButton(if (running) tr("Importo…") else if (plan.nothingToWrite) tr("Niente di nuovo da importare")
                            else tr("Importa {0} fotografie", mapOf("0" to count.toString())), {
                            running = true
                            error = null
                            scope.launch {
                                val (counts, problem) = model.importRows(wizard.payload)
                                if (counts != null) wizard = wizard.copy(done = counts) else error = problem
                                running = false
                            }
                        }, size = BBButtonSize.Touch, isLoading = running, enabled = !plan.nothingToWrite && !plan.blocked && !wizard.tooManyRows && !running)
                    }
                }
            }
        }
    }
}

@Composable
private fun ColumnsStep(wizard: PensionImportState, onChange: (PensionImportState) -> Unit, currency: String, text: io.buddybudget.core.domain.pension.PensionText, hidden: Boolean) {
    val c = BuddyBudgetTheme.colors
    val table = wizard.table ?: return
    val mapping = wizard.mapping ?: return
    PanelSection(tr("Colonne"), BBIcon.Columns3, color = c.swatchBlue,
        description = "${wizard.fileName ?: tr("Testo incollato")} ${tr("· controlla che ogni colonna sia quella giusta.")}") {
        Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
            PensionImportField.entries.forEach { field ->
                BBSelect(listOf<Pair<Int?, String>>(null to tr("Nessuna colonna")) + table.headers.indices.map { it to columnLabel(table, it) },
                    mapping.columns[field], { col ->
                        val next = if (col == null) mapping.columns - field else mapping.columns + (field to col)
                        onChange(wizard.copy(mapping = mapping.copy(columns = next)))
                    }, label = tr(field.label))
            }
            BBSelect(listOf(ImportDateOrder.YMD to tr("Anno, mese, giorno (2026-01-31)"), ImportDateOrder.DMY to tr("Giorno, mese, anno (31/01/2026)"),
                ImportDateOrder.MDY to tr("Mese, giorno, anno (01/31/2026)")), mapping.dateOrder,
                { onChange(wizard.copy(mapping = mapping.copy(dateOrder = it))) }, label = tr("Formato delle date"))
            BBSelect(listOf(ImportDecimalSeparator.DOT to tr("Punto (1,234.56)"), ImportDecimalSeparator.COMMA to tr("Virgola (1.234,56)")), mapping.decimal,
                { onChange(wizard.copy(mapping = mapping.copy(decimal = it))) }, label = tr("Separatore dei decimali"))
        }
    }
    PanelSection(tr("Anteprima"), BBIcon.Table, color = c.swatchGreen) {
        if (wizard.missing.isNotEmpty()) {
            val names = wizard.missing.map { tr(it).lowercase() }.joinToString(", ")
            BBText("${tr("Indica quale colonna contiene:")} $names.", BBTextStyle.Body, color = c.neg)
            return@PanelSection
        }
        val ok = wizard.snapshots
        val problems = wizard.problems
        Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
            BBText("${ok.size} ${tr("fotografie lette su")} ${wizard.rows.size} ${tr("righe")}" +
                (if (problems.isEmpty()) "" else tr(", {0} scartate", mapOf("0" to problems.size.toString()))) + ".", BBTextStyle.Body)
            ok.take(5).forEach { s ->
                Row(Modifier.padding(vertical = BBSpacing.space1), verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
                    BBText("${tr("Riga")} ${s.line}", BBTextStyle.Caption, Modifier.width(52.dp), color = c.text2)
                    BBText(text.shortDate(s.date), BBTextStyle.BodyStrong, Modifier.weight(1f))
                    Column(horizontalAlignment = Alignment.End) {
                        BBText(text.money(s.value, currency, hidden), style = BBTextStyle.Body.style.copy(fontFeatureSettings = "tnum"))
                        BBText(text.money(s.netContributions, currency, hidden), style = BBTextStyle.Caption.style.copy(fontFeatureSettings = "tnum"), color = c.text2)
                    }
                }
            }
            problems.take(5).forEach { row ->
                Row(horizontalArrangement = Arrangement.spacedBy(BBSpacing.space1_5)) {
                    BBIconView(BBIcon.TriangleAlert, Modifier.padding(top = 2.dp), size = 14.dp, color = c.neg)
                    BBText("${tr("Riga")} ${row.line}: ${tr(row.message)}", BBTextStyle.Body, color = c.text2)
                }
            }
            if (problems.size > 5) BBText("${tr("…e altre")} ${problems.size - 5}", BBTextStyle.Body, color = c.text2)
        }
    }
}

@Composable
private fun columnLabel(table: PensionImportTable, column: Int): String {
    val header = table.headers[column].ifEmpty { tr("Colonna {0}", mapOf("0" to (column + 1).toString())) }
    val example = table.rows.firstOrNull { column < it.size && JSNumber.trim(it[column]).isNotEmpty() }?.get(column)
    return header + (example?.let { tr(" — es. {0}", mapOf("0" to it)) } ?: "")
}

@Composable
private fun SummaryStep(wizard: PensionImportState, currency: String, text: io.buddybudget.core.domain.pension.PensionText, hidden: Boolean) {
    val c = BuddyBudgetTheme.colors
    val done = wizard.done
    if (done != null) {
        Column(Modifier.fillMaxWidth().padding(vertical = BBSpacing.space6), horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
            BBIconView(BBIcon.CircleCheck, size = 32.dp, color = c.pos)
            BBText(if (done.new + done.update == 0) tr("Niente da cambiare") else tr("{0} aggiunte, {1} aggiornate", mapOf("0" to done.new.toString(), "1" to done.update.toString())),
                style = BBTextStyle.CardTitle.style.copy(fontSize = 18.sp, lineHeight = 28.sp))
            if (done.unchanged > 0) BBText("${done.unchanged} ${tr("erano già presenti e sono state saltate.")}",
                style = BBTextStyle.Body.style.copy(textAlign = TextAlign.Center), color = c.mutedForeground)
        }
        return
    }
    val plan = wizard.plan
    val updates = plan.rows.filter { it.status == PensionPlannedRow.Status.Update }
    val errors = plan.rows.filter { it.status == PensionPlannedRow.Status.Error }
    val discarded = wizard.problems.size
    PanelSection(tr("Cosa cambia"), BBIcon.ListChecks, color = c.swatchGreen) {
        Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
            Row(horizontalArrangement = Arrangement.spacedBy(BBSpacing.space4)) {
                Stat(plan.counts.new, tr("da aggiungere"), Modifier.weight(1f))
                Stat(plan.counts.update, tr("da aggiornare"), Modifier.weight(1f))
                Stat(plan.counts.unchanged, tr("già presenti"), Modifier.weight(1f))
            }
            BBText(tr("Una fotografia con la stessa data di una già salvata ne sostituisce i valori; se sono identici viene saltata, quindi puoi reimportare lo stesso file senza doppioni."),
                BBTextStyle.Body, color = c.text2)
            if (discarded > 0) BBText("$discarded ${tr("righe del file sono state scartate al passo Colonne.")}", BBTextStyle.Body, color = c.text2)
        }
    }
    if (updates.isNotEmpty()) {
        PanelSection(tr("Verranno aggiornate"), BBIcon.ListChecks, color = c.swatchOrange) {
            Column {
                Row(Modifier.fillMaxWidth().padding(bottom = BBSpacing.space2)) {
                    BBText(tr("Aggiorna"), BBTextStyle.Body, Modifier.weight(1f), color = c.text2)
                    BBText(tr("Controvalore prima"), BBTextStyle.Body, color = c.text2)
                }
                updates.take(6).forEach { row ->
                    Row(Modifier.fillMaxWidth().padding(vertical = BBSpacing.space2)) {
                        BBText(text.shortDate(row.date), BBTextStyle.BodyStrong, Modifier.weight(1f))
                        BBText(row.previous?.let { text.money(it.second, currency, hidden) } ?: "—", style = BBTextStyle.Body.style.copy(fontFeatureSettings = "tnum"))
                    }
                }
                if (updates.size > 6) BBText("${tr("…e altre")} ${updates.size - 6}", BBTextStyle.Body, Modifier.padding(top = BBSpacing.space2), color = c.text2)
            }
        }
    }
    if (plan.error != null || errors.isNotEmpty() || wizard.tooManyRows) {
        Column(Modifier.fillMaxWidth().background(c.negSoft, RoundedCornerShape(BBRadius.lg)).padding(BBSpacing.space3),
            verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space1_5)) {
                BBIconView(BBIcon.TriangleAlert, size = 16.dp, color = c.neg)
                BBText(tr("Finché ci sono errori non si importa nulla"), BBTextStyle.BodyStrong, color = c.neg)
            }
            plan.error?.let { BBText(tr(it, plan.errorValues), BBTextStyle.Body, color = c.neg) }
            if (wizard.tooManyRows) BBText(tr("Al massimo 1000 righe per import"), BBTextStyle.Body, color = c.neg)
            errors.take(6).forEach { row -> BBText("${tr("Riga")} ${row.line}: ${tr(row.message ?: "", row.messageValues)}", BBTextStyle.Body, color = c.neg) }
            if (errors.size > 6) BBText("${tr("…e altre")} ${errors.size - 6}", BBTextStyle.Body, color = c.neg)
            BBText(tr("Correggi il file e ricaricalo."), BBTextStyle.Body, color = c.text2)
        }
    }
}

@Composable
private fun Stat(value: Int, label: String, modifier: Modifier) {
    Column(modifier) {
        BBText(value.toString(), style = BBTextStyle.AmountLarge.style.copy(fontFeatureSettings = "tnum"))
        BBText(label, BBTextStyle.Body, color = BuddyBudgetTheme.colors.text2)
    }
}

/** PEN-014 / PEN-018: file picker (CSV/TXT/XLSX, read on the device), template download (share sheet), or pasted rows. */
@Composable
private fun PensionFileStep(wizard: PensionImportState, onChange: (PensionImportState) -> Unit) {
    val c = BuddyBudgetTheme.colors
    val context = androidx.compose.ui.platform.LocalContext.current
    val pick = io.buddybudget.app.features.imports.rememberImportFilePicker { files ->
        files.firstOrNull()?.let { onChange(wizard.loadFile(it.name, it.data)) }
    }
    PanelSection(tr("Scegli il file"), BBIcon.FileSpreadsheet, color = c.swatchGreen,
        description = tr("Una riga per fotografia, con tre colonne: la data, i contributi netti e il controvalore. Il file viene letto sul telefono e non viene caricato né conservato: al server arrivano solo le righe che confermi.")) {
        Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
            io.buddybudget.app.features.imports.FilePickZone(tr("Scegli un file CSV o Excel (.xlsx)"), tr("CSV, TXT o Excel (.xlsx)"), onClick = pick)
            io.buddybudget.app.features.imports.InlineLinkText(listOf(
                io.buddybudget.app.features.imports.LinkPart(tr("Non sai da dove partire?") + " "),
                io.buddybudget.app.features.imports.LinkPart(tr("Scarica il modello")) {
                    io.buddybudget.app.features.imports.ImportFileTypes.share(context, PensionImport.TEMPLATE_FILE_NAME, PensionImport.templateData())
                },
                io.buddybudget.app.features.imports.LinkPart(" " + tr("e compilalo con i valori dell'area clienti del tuo fondo.")),
            ), color = c.text2)
        }
    }
    PanelSection(tr("Oppure incolla le righe"), BBIcon.ClipboardPaste, color = c.swatchBlue, description = tr("Anche copiate da Excel")) {
        Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
            BBTextArea(wizard.text, { onChange(wizard.copy(text = it)) }, placeholder = tr("Data;Contributi netti;Controvalore\n31/03/2026;10880,00;11250,40"))
            BBButton(tr("Leggi"), { onChange(wizard.read()) }, variant = BBButtonVariant.Outline, size = BBButtonSize.Sm, enabled = JSNumber.trim(wizard.text).isNotEmpty())
        }
    }
}
