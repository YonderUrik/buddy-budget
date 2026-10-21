package io.buddybudget.app.features.imports

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.selection.SelectionContainer
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import io.buddybudget.app.debug.DebugLaunch
import io.buddybudget.app.designsystem.BuddyBudgetTheme
import io.buddybudget.app.designsystem.components.BBAlertSheet
import io.buddybudget.app.designsystem.components.BBButton
import io.buddybudget.app.designsystem.components.BBButtonSize
import io.buddybudget.app.designsystem.components.BBButtonVariant
import io.buddybudget.app.designsystem.components.BBIconView
import io.buddybudget.app.designsystem.components.BBSeparator
import io.buddybudget.app.designsystem.components.BBStyles
import io.buddybudget.app.designsystem.components.BBText
import io.buddybudget.app.designsystem.components.LocalBBLocale
import io.buddybudget.app.designsystem.components.LocalHideAmounts
import io.buddybudget.app.designsystem.components.ScrollableSegmentedControl
import io.buddybudget.app.designsystem.components.bbPressable
import io.buddybudget.app.designsystem.generated.BBIcon
import io.buddybudget.app.designsystem.generated.BBRadius
import io.buddybudget.app.designsystem.generated.BBSpacing
import io.buddybudget.app.designsystem.generated.BBTextStyle
import io.buddybudget.app.features.investments.PanelSection
import io.buddybudget.app.tr
import io.buddybudget.core.data.ImportApiFailure
import io.buddybudget.core.domain.format.BBFormat
import io.buddybudget.core.domain.imports.ImportXlsx
import io.buddybudget.core.domain.imports.PersonalImportListing
import io.buddybudget.core.domain.imports.PersonalImportPreview
import io.buddybudget.core.domain.imports.PersonalImportReceiptFile
import io.buddybudget.core.domain.imports.PersonalImportRules
import kotlinx.coroutines.launch

/**
 * «Righe da controllare» (IMP-034…048): reasons, the three ways out and every row by outcome. Nothing is saved
 * until the user chooses. Twin of `ImportReviewView` on iOS.
 */
@Composable
fun ImportReviewView(model: ImportsModel, job: PersonalImportListing.Job, file: PersonalImportReceiptFile) {
    val c = BuddyBudgetTheme.colors
    val locale = LocalBBLocale.current
    val hidden = LocalHideAmounts.current
    val scope = rememberCoroutineScope()
    var preview by remember { mutableStateOf<PersonalImportPreview?>(null) }
    var loadError by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf<String?>(null) }
    var actionError by remember { mutableStateOf<String?>(null) }
    var confirmSkip by remember { mutableStateOf(false) }
    var confirmReanalyze by remember { mutableStateOf(false) }
    var help by remember { mutableStateOf(false) }
    val unavailable = tr("Anteprima non disponibile")
    val generic = tr("Operazione non riuscita. Riprova.")
    fun run(action: String, work: suspend () -> String?) {
        busy = action
        actionError = null
        scope.launch {
            actionError = work()
            busy = null
        }
    }
    LaunchedEffect(job.id) {
        try {
            preview = model.preview(job.id)
            // `--es bbReviewAction reanalyze|skip` (debug only): runs a review action without taps.
            when (DebugLaunch.value("bbReviewAction")) {
                "reanalyze" -> run("reanalyze") { model.reanalyze(job.id, file, generic) }
                "skip" -> run("skip") { model.importSkipping(job.id, generic) }
            }
        } catch (e: Exception) {
            loadError = ImportApiFailure.of(e).message ?: unavailable
        }
    }
    val data = preview
    val groups = data?.let { PersonalImportRules.groups(it.records) }
    val errors = groups?.errors?.size ?: 0
    val importable = (groups?.cash ?: 0) + (groups?.investments ?: 0)
    val total = data?.records?.size ?: 0
    val rowProblem = errors > 0
    val loading = data == null && loadError == null
    val title = if (rowProblem) (if (errors == 1) tr("1 riga da controllare") else tr("{0} righe da controllare", mapOf("0" to errors.toString())))
    else tr("Non siamo riusciti a importare il file")
    Column(
        Modifier.fillMaxWidth().border(1.dp, c.border, RoundedCornerShape(BBRadius.xl)).padding(BBSpacing.space4),
        verticalArrangement = Arrangement.spacedBy(BBSpacing.space5),
    ) {
        Row(horizontalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
            BBIconView(BBIcon.TriangleAlert, Modifier.padding(top = 2.dp), size = 24.dp, color = c.swatchAmber)
            Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space1)) {
                BBText(if (loading) tr("Controllo le righe…") else title, Modifier.semantics { heading() }, BBStyles.sectionHeading)
                BBText(
                    when {
                        loading -> tr("Un attimo: leggo l'esito dell'analisi.")
                        rowProblem -> tr("Su {0} righe lette, {1} sono pronte e {2} non le ho capite. Non ho salvato nulla: scegli tu cosa fare.",
                            mapOf("0" to total.toString(), "1" to importable.toString(), "2" to errors.toString()))
                        else -> job.error ?: tr("Puoi riprovare con un altro file, oppure aprire il dettaglio dalla lista.")
                    }, BBTextStyle.Body, color = c.mutedForeground,
                )
                io.buddybudget.app.features.help.ReportErrorLink(io.buddybudget.core.domain.support.ReportErrorArea.ImportMovimenti, job.error ?: title)
            }
        }
        val detail = buildList {
            add(file.source)
            file.size?.let { add(PersonalImportRules.sizeText(it, locale)) }
            if (total > 0) add(tr("{0} righe lette", mapOf("0" to total.toString())))
        }.joinToString(" · ")
        ImportFileRow(file.name, detail)
        loadError?.let { BBText(it, BBTextStyle.Body, color = c.destructive) }
        if (data != null && groups != null) {
            Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
                BBText(tr("Cosa puoi fare"), BBTextStyle.BodyStrong)
                if (rowProblem && importable > 0) {
                    BBButton(if (importable == 1) tr("Importa la riga riconosciuta") else tr("Importa le {0} righe riconosciute", mapOf("0" to importable.toString())),
                        { confirmSkip = true }, icon = BBIcon.ListChecks, size = BBButtonSize.Touch, fullWidth = true, isLoading = busy == "skip", enabled = busy == null)
                }
                BBButton(if (busy == "reanalyze") tr("Rianalizzo…") else tr("Rianalizza con l'AI"), { confirmReanalyze = true }, icon = BBIcon.WandSparkles,
                    variant = if (rowProblem && importable > 0) BBButtonVariant.Outline else BBButtonVariant.Default, size = BBButtonSize.Touch, fullWidth = true,
                    isLoading = busy == "reanalyze", enabled = busy == null)
                BBButton(tr("Carica un file corretto"), { model.anotherFile() }, icon = BBIcon.Upload, variant = BBButtonVariant.Ghost, size = BBButtonSize.Touch,
                    fullWidth = true, enabled = busy == null)
                actionError?.let { io.buddybudget.app.features.help.ErrorWithReport(io.buddybudget.core.domain.support.ReportErrorArea.ImportMovimenti, it) }
            }
            if (rowProblem) {
                PanelSection(tr("Cosa non va"), BBIcon.TriangleAlert, color = c.swatchAmber,
                    description = tr("Il numero è la riga del file originale (l'intestazione è la riga 1). Apri il file, cerca la riga e confronta con il motivo.")) {
                    Column {
                        PersonalImportRules.errorsByReason(groups.errors).forEachIndexed { index, group ->
                            if (index > 0) BBSeparator()
                            ReasonGroupView(group, hidden)
                        }
                    }
                }
            }
            ImportRowsView(data, groups)
            DisclosureBox(tr("Perché succede e come correggere"), help, { help = !help }, boxed = false, icon = BBIcon.Sparkles) {
                listOf(
                    "Il formato del file viene ricavato dall'AI alla prima lettura: a volte sbaglia su righe insolite (note, totali, movimenti di tipo raro). Se le righe segnalate ti sembrano normali, «Rianalizza con l'AI» di solito basta.",
                    "Se il motivo parla di data o importo, controlla che nel file siano scritti come nelle altre righe (stesso separatore decimale, stessa forma della data).",
                    "Se poche righe non ti servono, importa le altre: le righe saltate non entrano nei conti e potrai aggiungerle a mano o ricaricarle corrette.",
                ).forEach { line ->
                    Row(horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
                        BBText("•", BBTextStyle.Body, color = c.mutedForeground)
                        BBText(tr(line), BBTextStyle.Body, color = c.mutedForeground)
                    }
                }
            }
        }
    }
    BBAlertSheet(
        confirmSkip, tr("Importare saltando {0} righe?", mapOf("0" to errors.toString())),
        tr("Salvo le {0} righe riconosciute e salto le altre {1}: non entrano nei conti. Potrai correggerle nel file e ricaricarlo più avanti, senza doppioni. Il formato resta salvato per i prossimi file.",
            mapOf("0" to importable.toString(), "1" to errors.toString())),
        tr("Importa e salta"), { confirmSkip = false; run("skip") { model.importSkipping(job.id, generic) } }, { confirmSkip = false },
        confirmVariant = BBButtonVariant.Default,
    )
    BBAlertSheet(
        confirmReanalyze, tr("Rianalizzare il file con l'AI?"),
        tr("Il file viene letto di nuovo dal modello AI, come al primo caricamento, per ricavare un formato migliore. Non devi ricaricarlo e non salvo nulla finché i controlli non passano. Utile se le righe segnalate ti sembrano giuste."),
        tr("Rianalizza"), { confirmReanalyze = false; run("reanalyze") { model.reanalyze(job.id, file, generic) } }, { confirmReanalyze = false },
        confirmVariant = BBButtonVariant.Default,
    )
}

/** One reason and its rows: file line and original text (hidden with «Nascondi gli importi», IMP-044). */
@Composable
private fun ReasonGroupView(group: PersonalImportRules.ErrorReasonGroup, hidden: Boolean) {
    val c = BuddyBudgetTheme.colors
    var all by remember { mutableStateOf(false) }
    val rows = if (all) group.records else group.records.take(PersonalImportRules.REVIEW_ROWS_PER_REASON)
    Column(Modifier.padding(vertical = BBSpacing.space3), verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
        Text(buildAnnotatedString {
            withStyle(BBTextStyle.BodyStrong.style.toSpanStyle().copy(color = c.foreground)) { append(tr(group.reason)) }
            withStyle(BBTextStyle.Body.style.toSpanStyle().copy(color = c.mutedForeground)) {
                append("  " + if (group.records.size == 1) tr("1 riga") else tr("{0} righe", mapOf("0" to group.records.size.toString())))
            }
        })
        rows.forEach { record ->
            Row(horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
                BBText(tr("Riga {0}", mapOf("0" to PersonalImportRules.sourceLine(record).toString())), BBTextStyle.Caption, Modifier.width(68.dp), color = c.mutedForeground)
                val text = PersonalImportRules.sourceText(record)
                SelectionContainer(Modifier.weight(1f)) {
                    Text(
                        if (hidden) tr("(nascosta)") else text.ifEmpty { tr("(riga vuota)") },
                        Modifier.fillMaxWidth().background(c.alphaMuted60, RoundedCornerShape(BBRadius.md)).padding(horizontal = 6.dp, vertical = 2.dp),
                        style = BBTextStyle.Caption.style.copy(fontFamily = FontFamily.Monospace, fontSize = 11.sp,
                            color = if (hidden) c.mutedForeground else c.foreground),
                    )
                }
            }
        }
        if (group.records.size > PersonalImportRules.REVIEW_ROWS_PER_REASON && !all) {
            BBText(tr("Mostra tutte le {0} righe", mapOf("0" to group.records.size.toString())), style = BBTextStyle.Caption.style.copy(fontWeight = FontWeight.W500),
                modifier = Modifier.bbPressable({ all = true }, RoundedCornerShape(BBRadius.sm), translate = false), color = c.primary)
        }
    }
}

/** «Tutte le righe» (IMP-045…047): tabs by outcome, 25 rows per page, tap to see the original columns. */
@Composable
fun ImportRowsView(preview: PersonalImportPreview, groups: PersonalImportRules.PreviewGroups) {
    val c = BuddyBudgetTheme.colors
    val hidden = LocalHideAmounts.current
    var tab by remember { mutableStateOf<PersonalImportRules.PreviewTab?>(null) }
    var shown by remember { mutableIntStateOf(PersonalImportRules.ROWS_PAGE_SIZE) }
    val current = tab ?: groups.defaultTab
    val rows = groups.records(current)
    PanelSection(tr("Tutte le righe"), BBIcon.SearchCheck, color = c.swatchSlate,
        description = tr("{0} righe lette: {1} movimenti, {2} operazioni, {3} escluse. Non salvo nulla finché non scegli.",
            mapOf("0" to preview.records.size.toString(), "1" to groups.cash.toString(), "2" to groups.investments.toString(), "3" to groups.ignored.size.toString()))) {
        if (hidden) {
            BBText(tr("Disattiva «Nascondi gli importi» per consultare il dettaglio."), BBTextStyle.Body, color = c.mutedForeground)
            return@PanelSection
        }
        Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space4)) {
            ScrollableSegmentedControl(groups.tabs.map { it to label(it, groups) }, current, { tab = it; shown = PersonalImportRules.ROWS_PAGE_SIZE },
                accessibilityLabel = tr("Righe per esito"))
            if (rows.isEmpty()) {
                BBText(tr("Nessuna riga in questa scheda."), BBTextStyle.Body, color = c.mutedForeground)
            } else {
                Column {
                    rows.take(shown).forEachIndexed { index, record ->
                        if (index > 0) BBSeparator()
                        PreviewRecordRow(record, preview.headers, preview.currency)
                    }
                }
            }
            if (rows.size > shown) {
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    BBText("1–$shown ${tr("di")} ${rows.size}", BBTextStyle.Caption, color = c.mutedForeground)
                    Spacer(Modifier.weight(1f))
                    BBButton(tr("Mostra altre"), { shown += PersonalImportRules.ROWS_PAGE_SIZE }, variant = BBButtonVariant.Outline, size = BBButtonSize.Sm)
                }
            }
        }
    }
}

@Composable
private fun label(tab: PersonalImportRules.PreviewTab, groups: PersonalImportRules.PreviewGroups): String = when (tab) {
    PersonalImportRules.PreviewTab.Importable -> tr("Da importare · {0}", mapOf("0" to groups.importable.size.toString()))
    PersonalImportRules.PreviewTab.Ignored -> tr("Escluse · {0}", mapOf("0" to groups.ignored.size.toString()))
    PersonalImportRules.PreviewTab.Errors -> tr("Errori · {0}", mapOf("0" to groups.errors.size.toString()))
}

@Composable
private fun PreviewRecordRow(record: PersonalImportPreview.Record, headers: List<String>, currency: String) {
    val c = BuddyBudgetTheme.colors
    val locale = LocalBBLocale.current
    var open by remember { mutableStateOf(false) }
    val s = PersonalImportRules.rowSummary(record)
    val kind = s.kind
    val subtitle = if (kind == null) tr("Riga {0}", mapOf("0" to s.line.toString())) else {
        var text = tr(kind)
        if (s.quantity != null && s.price != null) {
            text += tr(" · {0} × {1} {2}", mapOf("0" to ImportXlsx.jsToString(s.quantity!!), "1" to ImportXlsx.jsToString(s.price!!), "2" to (s.currency ?: "")))
        }
        text + " · " + tr("riga {0}", mapOf("0" to s.line.toString()))
    }
    Column(Modifier.padding(vertical = BBSpacing.space2_5), verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
        Row(Modifier.fillMaxWidth().heightIn(min = 44.dp).bbPressable({ open = !open }, RoundedCornerShape(BBRadius.md), translate = false),
            verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
            BBText(s.date?.let { BBFormat.formatShortDate(it, locale) } ?: "", BBTextStyle.Caption, Modifier.width(52.dp), color = c.mutedForeground)
            Column(Modifier.weight(1f)) {
                BBText(tr(s.title), BBTextStyle.BodyStrong, maxLines = 1)
                BBText(subtitle, BBTextStyle.Caption, color = c.mutedForeground, maxLines = 1)
            }
            val amount = s.amount
            val cur = s.currency
            if (amount != null && cur != null) {
                BBText(BBFormat.formatCurrency(amount, cur, locale), style = BBTextStyle.BodyStrong.style.copy(fontFeatureSettings = "tnum"),
                    color = if (s.positive && kind != null) c.pos else c.foreground)
            }
        }
        if (open) {
            SelectionContainer {
                Column(Modifier.padding(start = 64.dp), verticalArrangement = Arrangement.spacedBy(BBSpacing.space1)) {
                    record.source.forEachIndexed { i, value ->
                        Text(buildAnnotatedString {
                            withStyle(SpanStyle(fontWeight = FontWeight.W500)) {
                                append((headers.getOrNull(i) ?: tr("Colonna {0}", mapOf("0" to (i + 1).toString()))) + ": ")
                            }
                            append(value)
                        }, style = BBTextStyle.Caption.style.copy(color = c.mutedForeground))
                    }
                    record.rate?.let {
                        BBText(tr("Cambio verso") + " " + currency + ": " + ImportXlsx.jsToString(it), BBTextStyle.Caption, color = c.mutedForeground)
                    }
                }
            }
        }
    }
}
