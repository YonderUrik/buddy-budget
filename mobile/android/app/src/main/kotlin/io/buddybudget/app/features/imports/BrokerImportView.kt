package io.buddybudget.app.features.imports

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.selection.SelectionContainer
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import io.buddybudget.app.designsystem.BuddyBudgetTheme
import io.buddybudget.app.designsystem.components.BBButton
import io.buddybudget.app.designsystem.components.BBButtonSize
import io.buddybudget.app.designsystem.components.BBButtonVariant
import io.buddybudget.app.designsystem.components.BBIconBadge
import io.buddybudget.app.designsystem.components.BBIconView
import io.buddybudget.app.designsystem.components.BBProgressState
import io.buddybudget.app.designsystem.components.BBSeparator
import io.buddybudget.app.designsystem.components.BBSpinner
import io.buddybudget.app.designsystem.components.BBStyles
import io.buddybudget.app.designsystem.components.BBText
import io.buddybudget.app.designsystem.components.FormDialogHeader
import io.buddybudget.app.designsystem.components.LocalBBLocale
import io.buddybudget.app.designsystem.components.ProgressBar
import io.buddybudget.app.designsystem.components.bbPressable
import io.buddybudget.app.designsystem.generated.BBIcon
import io.buddybudget.app.designsystem.generated.BBLayout
import io.buddybudget.app.designsystem.generated.BBRadius
import io.buddybudget.app.designsystem.generated.BBSpacing
import io.buddybudget.app.designsystem.generated.BBTextStyle
import io.buddybudget.app.generated.LocalStrings
import io.buddybudget.app.tr
import io.buddybudget.core.data.Instrument
import io.buddybudget.core.domain.format.BBFormat
import io.buddybudget.core.domain.imports.ImportMessages
import io.buddybudget.core.domain.imports.ImportNormalize
import io.buddybudget.core.domain.imports.ImportOperationTypes
import io.buddybudget.core.domain.imports.ImportProviderInfo
import io.buddybudget.core.domain.imports.ImportProviders
import io.buddybudget.core.domain.imports.ImportRow

/** «Importa operazioni» full-screen dialog (07-investments §8, INV-092…105). Twin of `BrokerImportView` on iOS. */
@Composable
fun BrokerImportView(
    model: BrokerImportModel,
    currency: String,
    suggestions: List<Instrument>,
    onOpenImports: (String?) -> Unit,
    onManage: () -> Unit,
    onNavigate: (String) -> Unit,
) {
    val strings = LocalStrings.current
    model.translate = { s, v -> strings.lookup(s, v) }
    val pick = rememberImportFilePicker(multiple = true) { model.pickAsync(it) }
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space5)) {
        FormDialogHeader(BBIcon.Upload, tr("Importa operazioni"), tr("Carica il file del tuo broker: lo leggo, ti mostro cosa importerei e importo solo quando confermi."))
        model.fallbackJobs.forEach { (name, id) ->
            InlineLinkText(listOf(LinkPart("$name: ${tr("Analisi AI avviata")} · "), LinkPart(tr("Segui l'analisi")) { onOpenImports(id) }),
                color = BuddyBudgetTheme.colors.foreground)
        }
        val jobId = model.fallbackJobId
        when {
            model.batchFinished -> {
                BBText("${tr("Tutti i")} ${model.batch.size} ${tr("file sono stati elaborati. I file già importati sono stati saltati senza creare doppioni.")}", BBTextStyle.Body)
                BBButton(tr("Chiudi"), { model.close() }, size = BBButtonSize.Touch)
            }
            jobId != null -> {
                BBText(tr("La lettura standard non è riuscita. L'analisi AI è stata avviata automaticamente; il supporto riceverà il report dell'errore."), BBTextStyle.Body)
                TextLinkButton(tr("Segui l'analisi")) { onOpenImports(jobId) }
                BBButton(tr(if (model.isBatch) "File successivo" else "Chiudi"), { model.finish() }, size = BBButtonSize.Touch)
            }
            else -> {
                if (model.isBatch) BatchProgress(model)
                if (!model.done) Stepper(model)
                model.error?.let { error ->
                    val explained = ImportMessages.explainFile(error)
                    ImportNotice(NoticeTone.Error, explained.text, explained.hint, if (explained.text == error) null else error,
                        io.buddybudget.core.domain.support.ReportError(io.buddybudget.core.domain.support.ReportErrorArea.ImportInvestimenti, error))
                }
                when (model.step) {
                    BrokerImportModel.Step.File -> FileStep(model, pick, onOpenImports)
                    BrokerImportModel.Step.Mapping -> if (model.statement != null) BrokerStatementStep(model) else BrokerMappingStep(model)
                    BrokerImportModel.Step.Instruments -> BrokerInstrumentsStep(model, currency, suggestions)
                    BrokerImportModel.Step.Summary -> BrokerSummaryStep(model, onManage, onNavigate)
                }
                if (model.reading || model.resolving || model.running || model.loadingFiles) {
                    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
                        ProgressBar(BBProgressState.Indeterminate, Modifier.fillMaxWidth().height(6.dp), tr("Elaborazione in corso"))
                        ShimmerText(tr(when {
                            model.reading || model.loadingFiles -> "Leggo il file…"
                            model.resolving -> "Cerco gli strumenti…"
                            model.step == BrokerImportModel.Step.Summary -> "Importo le operazioni…"
                            else -> "Controllo le operazioni…"
                        }))
                    }
                }
                Actions(model)
            }
        }
    }
}

@Composable
private fun BatchProgress(model: BrokerImportModel) {
    val c = BuddyBudgetTheme.colors
    val current = model.batch[minOf(model.batchIndex, model.batch.size - 1)]
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
        BBText("${tr("File")} ${model.batchIndex + 1} ${tr("di")} ${model.batch.size}: ${current.name}", BBTextStyle.BodyStrong)
        BBText(tr("Controlla e conferma un rendiconto alla volta: ognuno viene salvato da solo, quindi se ti fermi quelli già completati restano importati."),
            BBTextStyle.Body, color = c.mutedForeground)
        model.batch.forEachIndexed { i, file ->
            val state = tr(if (i < model.batchIndex) "elaborato" else if (i == model.batchIndex) "in corso" else "in attesa")
            Row(Modifier.semantics(mergeDescendants = true) { stateDescription = state }, verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
                if (i == model.batchIndex) BBSpinner(16.dp, c.mutedForeground)
                else BBIconView(if (i < model.batchIndex) BBIcon.Check else BBIcon.CircleDashed, size = 16.dp, color = if (i < model.batchIndex) c.pos else c.mutedForeground)
                BBText(file.name, BBTextStyle.Body, color = c.mutedForeground, maxLines = 1)
            }
        }
    }
}

@Composable
private fun Stepper(model: BrokerImportModel) {
    val c = BuddyBudgetTheme.colors
    val steps = BrokerImportModel.Step.entries
    val label = tr("Passi dell'import")
    Column(Modifier.semantics(mergeDescendants = true) { contentDescription = label }, verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
        BBText("${tr("Passo")} ${model.step.ordinal + 1} ${tr("di")} ${steps.size} · ${tr(model.step.label)}", BBTextStyle.BodyStrong)
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(BBSpacing.space1_5)) {
            steps.forEach { step ->
                Box(Modifier.weight(1f).height(4.dp).background(if (step.ordinal <= model.step.ordinal) c.primary else c.border, RoundedCornerShape(50)))
            }
        }
        BBText(tr(model.step.hint), BBTextStyle.Body, color = c.mutedForeground)
    }
}

@Composable
private fun FileStep(model: BrokerImportModel, pick: () -> Unit, onOpenImports: (String?) -> Unit) {
    val c = BuddyBudgetTheme.colors
    CheckboxRow(model.aiFallback, { model.aiFallback = it },
        tr("Se la lettura fallisce, autorizzo l'analisi AI automatica del file completo tramite OpenRouter, inclusi eventuali dati personali, senza conservazione presso il provider. Dopo i controlli i dati vengono importati automaticamente e il supporto riceve un report tecnico."),
        enabled = !model.busy)
    val chosen = model.provider?.let(ImportProviders::info)
    FilePickZone(
        if (model.busy) tr("Leggo il file…") else tr("Scegli il file del tuo broker"),
        if (model.busy) tr("Un attimo") else chosen?.fileLabel?.let { tr("Ti serve: {0}.", mapOf("0" to it)) } ?: tr("CSV o Excel"),
        model.busy, pick,
    )
    model.fileError?.let { error ->
        val explained = ImportMessages.explainFile(error)
        ImportNotice(NoticeTone.Error, explained.text, explained.hint, error, io.buddybudget.core.domain.support.ReportError(io.buddybudget.core.domain.support.ReportErrorArea.ImportInvestimenti, error))
    }
    BBText(tr("Più rendiconti? Selezionali insieme (fino a 20): IBKR, DEGIRO e Trade Republic."),
        style = BBTextStyle.Body.style.copy(textAlign = TextAlign.Center), modifier = Modifier.fillMaxWidth(), color = c.mutedForeground)
    BBSeparator()
    Row(Modifier.heightIn(min = BBLayout.minTouchTarget).bbPressable({ model.showGuide = !model.showGuide }, RoundedCornerShape(BBRadius.md), translate = false),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space1_5)) {
        BBText(tr("Come ottengo il file?"), BBTextStyle.BodyStrong, color = c.primary)
        BBIconView(BBIcon.ChevronDown, Modifier.rotate(if (model.showGuide) 180f else 0f), size = 16.dp, color = c.primary)
    }
    if (model.showGuide) {
        Column {
            ImportProviders.all.forEachIndexed { index, provider ->
                if (index > 0) BBSeparator()
                ProviderRow(model, provider)
            }
        }
    }
    InlineLinkText(listOf(LinkPart(tr("Il tuo broker non c'è?") + " "), LinkPart(tr("Crea il tuo formato")) { onOpenImports(null) }, LinkPart(".")))
}

@Composable
private fun ProviderRow(model: BrokerImportModel, provider: ImportProviderInfo) {
    val c = BuddyBudgetTheme.colors
    val isSelected = model.provider == provider.id
    Column {
        Row(
            Modifier.fillMaxWidth().heightIn(min = 56.dp)
                .bbPressable({ model.selectProvider(if (isSelected) null else provider.id) }, RoundedCornerShape(BBRadius.xl),
                    background = if (isSelected) c.alphaPrimary5 else Color.Transparent, translate = false)
                .semantics { selected = isSelected }
                .padding(BBSpacing.space2),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(BBSpacing.space3),
        ) {
            Box(Modifier.size(40.dp).background(c.muted, RoundedCornerShape(BBRadius.lg)), contentAlignment = Alignment.Center) {
                BBText(provider.initials, style = BBStyles.titleSmall.copy(fontSize = 14.sp, lineHeight = 20.sp))
            }
            Column(Modifier.weight(1f)) {
                BBText(provider.name, BBTextStyle.BodyStrong)
                BBText(tr(provider.tagline), BBTextStyle.Caption, color = c.mutedForeground)
            }
            Box(Modifier.size(20.dp).background(if (isSelected) c.primary else Color.Transparent, CircleShape)
                .border(1.dp, if (isSelected) c.primary else c.border, CircleShape), contentAlignment = Alignment.Center) {
                if (isSelected) BBIconView(BBIcon.Check, size = 12.dp, color = c.primaryForeground)
            }
        }
        if (isSelected) {
            Column(Modifier.padding(start = BBSpacing.space2, end = BBSpacing.space2, top = BBSpacing.space3, bottom = BBSpacing.space2),
                verticalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
                BBText("${tr("Come ottenere il file da")} ${provider.name}", BBTextStyle.BodyStrong)
                provider.exportSteps.forEachIndexed { i, step ->
                    Row(horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2_5)) {
                        Box(Modifier.size(20.dp).background(c.muted, CircleShape), contentAlignment = Alignment.Center) {
                            BBText((i + 1).toString(), style = BBTextStyle.Caption.style.copy(fontWeight = FontWeight.W500))
                        }
                        BBText(tr(step), BBTextStyle.Body, color = c.mutedForeground)
                    }
                }
                BBText(tr(provider.note), BBTextStyle.Body, color = c.mutedForeground)
            }
        }
    }
}

@Composable
private fun Actions(model: BrokerImportModel) {
    val tooMany = tr("Il file ha {0} strumenti: al massimo {1} per import", mapOf("0" to "#", "1" to "50"))
    val generic = tr("Impossibile riconoscere gli strumenti")
    val noOps = tr("Nessuna operazione da importare: scegli almeno uno strumento")
    val failed = tr("Import non riuscito")
    if (model.done) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
            BBButton(tr(if (model.isBatch) "File successivo" else "Chiudi"), { model.finish() }, size = BBButtonSize.Touch)
        }
        return
    }
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
        BBButton(tr(if (model.step == BrokerImportModel.Step.File) "Annulla" else "Indietro"), {
            if (model.step == BrokerImportModel.Step.File) model.close() else model.back()
        }, variant = BBButtonVariant.Ghost, size = BBButtonSize.Touch, enabled = !model.running && !(model.isBatch && model.step == BrokerImportModel.Step.Mapping))
        Spacer(Modifier.weight(1f))
        when (model.step) {
            BrokerImportModel.Step.File -> Unit
            BrokerImportModel.Step.Mapping -> BBButton(if (model.resolving) tr("Cerco gli strumenti…") else tr("Avanti"),
                { model.goToInstrumentsAsync({ tooMany.replace("#", it.toString()) }, generic) }, size = BBButtonSize.Touch,
                enabled = model.missing.isEmpty() && model.validRows > 0 && !model.resolving)
            BrokerImportModel.Step.Instruments -> BBButton(if (model.running) tr("Controllo…") else tr("Avanti"), { model.previewAsync(noOps, failed) },
                size = BBButtonSize.Touch, enabled = !(model.included.isEmpty() && model.cashCount == 0) && !model.running)
            BrokerImportModel.Step.Summary -> {
                val result = model.result ?: return@Row
                val label = when {
                    model.running -> tr("Importo…")
                    result.counts.error > 0 -> tr("Correggi le righe per continuare")
                    result.counts.new == 0 -> tr(if (model.isBatch) "Già importato · continua" else "Niente di nuovo da importare")
                    else -> tr("Importa {0} {1}", mapOf("0" to result.counts.new.toString(), "1" to tr(if (result.counts.new == 1) "operazione" else "operazioni")))
                }
                BBButton(label, { if (result.counts.new == 0 && model.isBatch) model.nextFile() else model.confirmAsync(noOps, failed) }, size = BBButtonSize.Touch,
                    isLoading = model.running, enabled = !(result.counts.new == 0 && !model.isBatch) && result.counts.error == 0 && !model.running)
            }
        }
    }
}

// ---------------------------------------------------------------- Shared pieces

enum class NoticeTone { Error, Warning, Info }

/** `ImportNotice`: tinted icon, title, explanation, «Cosa fare:» hint, technical detail on request. */
@Composable
fun ImportNotice(
    tone: NoticeTone, title: String, hint: String? = null, detail: String? = null,
    /** `Segnala questo problema` at the end (web `action`), with the error to attach. */
    report: io.buddybudget.core.domain.support.ReportError? = null,
    content: @Composable ColumnScope.() -> Unit = {},
) {
    val c = BuddyBudgetTheme.colors
    var showDetail by remember { mutableStateOf(false) }
    val (icon, color) = when (tone) {
        NoticeTone.Error -> BBIcon.CircleAlert to c.destructive
        NoticeTone.Warning -> BBIcon.TriangleAlert to c.swatchAmber
        NoticeTone.Info -> BBIcon.Info to c.swatchIndigo
    }
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
        BBIconBadge(icon, color, 32.dp, 16.dp)
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(BBSpacing.space1)) {
            BBText(tr(title), BBTextStyle.BodyStrong)
            content()
            if (hint != null) {
                Text(buildAnnotatedString {
                    withStyle(SpanStyle(fontWeight = FontWeight.W500)) { append(tr("Cosa fare:") + " ") }
                    append(tr(hint))
                }, style = BBTextStyle.Body.style.copy(color = c.foreground))
            }
            if (detail != null) {
                BBText(tr("Dettaglio tecnico"), BBTextStyle.Caption, Modifier.bbPressable({ showDetail = !showDetail }, RoundedCornerShape(BBRadius.sm), translate = false),
                    color = c.mutedForeground)
                if (showDetail) SelectionContainer {
                    Text(detail, style = BBTextStyle.Caption.style.copy(fontFamily = FontFamily.Monospace, color = c.mutedForeground))
                }
            }
            if (report != null) io.buddybudget.app.features.help.ReportErrorLink(report.area, report.message)
        }
    }
}

/** Big numbers side by side with their label (`PreviewNumbers`). */
@Composable
fun PreviewNumbers(items: List<Pair<Int, String>>) {
    val c = BuddyBudgetTheme.colors
    Row(Modifier.fillMaxWidth().height(IntrinsicSize.Min)) {
        items.forEachIndexed { i, (value, label) ->
            if (i > 0) Box(Modifier.padding(horizontal = BBSpacing.space3).width(1.dp).fillMaxHeight().background(c.border))
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                BBText(value.toString(), style = BBTextStyle.AmountLarge.style.copy(fontFeatureSettings = "tnum"), color = if (value == 0) c.mutedForeground else c.foreground)
                BBText(tr(label), BBTextStyle.Caption, color = c.mutedForeground)
            }
        }
    }
}

/** File read and how it was recognised (`PreviewHeader`). */
@Composable
fun PreviewHeader(fileName: String?, providerName: String?) {
    val c = BuddyBudgetTheme.colors
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space1)) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
            BBIconView(BBIcon.FileText, size = 16.dp, color = c.mutedForeground)
            BBText(fileName ?: tr("Testo incollato"), BBTextStyle.BodyStrong, maxLines = 1)
        }
        if (providerName != null) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space1_5)) {
                BBIconView(BBIcon.CircleCheck, size = 16.dp, color = c.pos)
                BBText("${tr("Formato riconosciuto:")} ${tr(providerName)}", BBTextStyle.Body, color = c.mutedForeground)
            }
        } else {
            BBText(tr("Non riconosco il formato di questo file: indicami cosa contiene ogni colonna."), BBTextStyle.Body, color = c.mutedForeground)
        }
    }
}

/** Section with an optional title and description (`DialogSection`). */
@Composable
fun ImportDialogSection(title: String? = null, description: String? = null, content: @Composable ColumnScope.() -> Unit) {
    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
        if (title != null) BBText(title, BBTextStyle.SectionTitle)
        if (description != null) BBText(description, BBTextStyle.Body, color = BuddyBudgetTheme.colors.mutedForeground)
        content()
    }
}

/** The first operations as they will be imported (phone list of `ImportRowsPreview`). */
@Composable
fun ImportRowsPreview(rows: List<ImportRow>, limit: Int = 6) {
    val c = BuddyBudgetTheme.colors
    val locale = LocalBBLocale.current
    val ok = rows.filterIsInstance<ImportRow.Ok>()
    if (ok.isEmpty()) return
    // INV-112: quantities and prices read from the file are the user's money too.
    val hide = io.buddybudget.app.designsystem.components.LocalHideAmounts.current
    fun number(v: Double) = if (hide) BBFormat.AMOUNT_MASK else BBFormat.formatNumber(v, locale, maximumFractionDigits = 8)
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
        Column {
            ok.take(limit).forEachIndexed { i, row ->
                if (i > 0) BBSeparator()
                val op = row.operation
                Row(Modifier.padding(vertical = BBSpacing.space2), horizontalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
                    Column(Modifier.weight(1f)) {
                        BBText(ImportNormalize.instrumentLabel(row.identity), BBTextStyle.BodyStrong, maxLines = 1)
                        BBText("${op.date.split("-").reversed().joinToString("/")} · ${tr(ImportOperationTypes.label(op.type))}", BBTextStyle.Caption, color = c.mutedForeground)
                    }
                    BBText((if (op.quantity != 0.0) tr("{0} × ", mapOf("0" to number(op.quantity))) else "") + number(op.grossAmount ?: op.price),
                        style = BBTextStyle.Caption.style.copy(fontFeatureSettings = "tnum"), color = c.mutedForeground)
                }
            }
        }
        if (ok.size > limit) {
            BBText("${tr("…e altre")} ${ok.size - limit} ${tr("operazioni: le vedi tutte dopo l'import, in Operazioni.")}", BBTextStyle.Caption, color = c.mutedForeground)
        }
    }
}

/** Rows not imported: errors to fix and rows skipped on purpose, grouped by reason (`SkippedRows`). */
@Composable
fun SkippedRowsView(rows: List<ImportRow>) {
    val c = BuddyBudgetTheme.colors
    val problems = rows.filter { !it.isOk }
    if (problems.isEmpty()) return
    val errors = problems.filterIsInstance<ImportRow.Error>()
    val skipped = LinkedHashMap<String, MutableList<Int>>()
    problems.filterIsInstance<ImportRow.Skipped>().forEach { skipped.getOrPut(it.text) { mutableListOf() }.add(it.line) }
    ImportDialogSection("${problems.size} ${tr(if (problems.size == 1) "riga non importata" else "righe non importate")}") {
        if (errors.isNotEmpty()) {
            Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
                errors.take(5).forEach { row ->
                    val e = ImportMessages.explainRow(row.text)
                    ImportNotice(NoticeTone.Warning, tr("Riga {0}: {1}", mapOf("0" to row.line.toString(), "1" to tr(e.text))), e.hint)
                }
                if (errors.size > 5) BBText("${tr("…e altre")} ${errors.size - 5} ${tr("righe con lo stesso tipo di problema.")}", BBTextStyle.Body, color = c.mutedForeground)
            }
        }
        if (skipped.isNotEmpty()) {
            Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space1)) {
                skipped.entries.take(5).forEach { (message, lines) ->
                    Text(buildAnnotatedString {
                        append(tr(ImportMessages.explainRow(message).text) + " ")
                        withStyle(BBTextStyle.Caption.style.toSpanStyle()) {
                            append("(" + (if (lines.size == 1) tr("riga {0}", mapOf("0" to lines[0].toString())) else tr("{0} righe", mapOf("0" to lines.size.toString()))) + ")")
                        }
                    }, style = BBTextStyle.Body.style.copy(color = c.mutedForeground))
                }
                if (skipped.size > 5) BBText("${tr("…e altri")} ${skipped.size - 5} ${tr("tipi di riga.")}", BBTextStyle.Body, color = c.mutedForeground)
            }
        }
    }
}
