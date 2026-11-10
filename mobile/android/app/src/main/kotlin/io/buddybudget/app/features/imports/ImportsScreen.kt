package io.buddybudget.app.features.imports

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.relocation.BringIntoViewRequester
import androidx.compose.foundation.relocation.bringIntoViewRequester
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.unit.dp
import io.buddybudget.app.designsystem.BuddyBudgetTheme
import io.buddybudget.app.designsystem.components.BBButton
import io.buddybudget.app.designsystem.components.BBButtonSize
import io.buddybudget.app.designsystem.components.BBButtonVariant
import io.buddybudget.app.designsystem.components.BBIconView
import io.buddybudget.app.designsystem.components.BBProgressState
import io.buddybudget.app.designsystem.components.BBScreen
import io.buddybudget.app.designsystem.components.BBSelect
import io.buddybudget.app.designsystem.components.BBSeparator
import io.buddybudget.app.designsystem.components.BBSpinner
import io.buddybudget.app.designsystem.components.BBStyles
import io.buddybudget.app.designsystem.components.BBText
import io.buddybudget.app.designsystem.components.BBTextField
import io.buddybudget.app.designsystem.components.LocalBBLocale
import io.buddybudget.app.designsystem.components.ProgressBar
import io.buddybudget.app.designsystem.components.bbPressable
import io.buddybudget.app.designsystem.generated.BBIcon
import io.buddybudget.app.designsystem.generated.BBLayout
import io.buddybudget.app.designsystem.generated.BBRadius
import io.buddybudget.app.designsystem.generated.BBSpacing
import io.buddybudget.app.designsystem.generated.BBTextStyle
import io.buddybudget.app.features.investments.PanelSection
import io.buddybudget.app.features.shell.LocalShell
import io.buddybudget.app.features.shell.LocalShellBack
import io.buddybudget.app.generated.LocalStrings
import io.buddybudget.app.tr
import io.buddybudget.core.domain.format.BBFormat
import io.buddybudget.core.domain.imports.PersonalImportIslandState
import io.buddybudget.core.domain.imports.PersonalImportListing
import io.buddybudget.core.domain.imports.PersonalImportReceiptFile
import io.buddybudget.core.domain.imports.PersonalImportRules
import io.buddybudget.core.domain.shell.AppDestination
import java.time.Instant
import java.time.ZoneId

/**
 * `/importazioni` (14-imports): intro (IMP-001), report of the selected / just uploaded / first active job — receipt,
 * «Righe da controllare» or correction (IMP-006) — then the three-step upload form and «Le tue importazioni»
 * (one scrolling page, as on the web). Twin of `ImportsScreen` on iOS.
 */
@OptIn(ExperimentalFoundationApi::class)
@Composable
fun ImportsScreen() {
    val shell = LocalShell.current
    val model = shell.imports
    val locale = LocalBBLocale.current
    val strings = LocalStrings.current
    val top = remember { BringIntoViewRequester() }
    val form = remember { BringIntoViewRequester() }
    val list = remember { BringIntoViewRequester() }
    LaunchedEffect(Unit) { model.start() }
    LaunchedEffect(model.scrollTarget) {
        val target = model.scrollTarget ?: return@LaunchedEffect
        kotlinx.coroutines.delay(50)
        when (target) {
            ImportsModel.ScrollTarget.Top -> top.bringIntoView()
            ImportsModel.ScrollTarget.Form -> form.bringIntoView()
            ImportsModel.ScrollTarget.List -> list.bringIntoView()
        }
        model.scrollTarget = null
    }
    BBScreen(null, onBack = LocalShellBack.current, onRefresh = { model.load() }) {
        Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space8)) {
            // Web header: the spreadsheet icon beside the page title, then the explanation.
            Column(Modifier.padding(top = BBSpacing.space4).bringIntoViewRequester(top), verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
                    io.buddybudget.app.designsystem.components.BBIconView(io.buddybudget.app.designsystem.generated.BBIcon.FileSpreadsheet, size = 28.dp,
                        color = BuddyBudgetTheme.colors.mutedForeground)
                    BBText(tr("Importa da CSV o Excel"), Modifier.semantics { heading() }, io.buddybudget.app.designsystem.components.BBStyles.screenTitle)
                }
                BBText(tr("Per le banche e i broker che BuddyBudget non supporta ancora. L'AI riconosce le colonne e il formato resta tuo: lo riusi ai file successivi senza altre analisi."),
                    BBTextStyle.BodyLarge, color = BuddyBudgetTheme.colors.text2)
            }
            model.reportJob?.let { job ->
                val file = model.reportFile(locale) { s, v -> strings.lookup(s, v) }
                when (PersonalImportRules.reportKind(job, model.correcting)) {
                    PersonalImportRules.ReportKind.Correction -> androidx.compose.runtime.key("c-${job.id}") { ImportCorrectionView(model, job) }
                    PersonalImportRules.ReportKind.Review -> androidx.compose.runtime.key("r-${job.id}") { ImportReviewView(model, job, file) }
                    PersonalImportRules.ReportKind.Receipt -> ImportReceiptView(model, model.listing?.jobs?.firstOrNull { it.id == job.id }, job.id, file)
                }
            }
            if (model.showsForm) Box(Modifier.bringIntoViewRequester(form)) { ImportUploadForm(model) }
            Box(Modifier.bringIntoViewRequester(list)) { ImportJobList(model) }
            Spacer(Modifier.height(BBSpacing.space8))
        }
    }
}

// ---------------------------------------------------------------- Receipt (IMP-026…033)

@Composable
fun ImportReceiptView(model: ImportsModel, job: PersonalImportListing.Job?, jobId: String, file: PersonalImportReceiptFile) {
    val c = BuddyBudgetTheme.colors
    val shell = LocalShell.current
    val locale = LocalBBLocale.current
    val status = job?.status
    val imported = status == "imported"
    val failed = job != null && PersonalImportRules.isFailed(status)
    val running = !imported && !failed
    val nothingNew = imported && PersonalImportRules.overlap(job?.results) == PersonalImportRules.Overlap.NothingNew
    @Composable fun count(n: Int, one: String, many: String): String = if (n == 1) "1 ${tr(one)}" else "$n ${tr(many)}"
    Column(
        Modifier.fillMaxWidth().border(1.dp, c.border, RoundedCornerShape(BBRadius.xl)).padding(BBSpacing.space4),
        verticalArrangement = Arrangement.spacedBy(BBSpacing.space5),
    ) {
        Row(horizontalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
            BBIconView(
                if (failed) BBIcon.CircleAlert else if (nothingNew) BBIcon.Info else BBIcon.CircleCheck, Modifier.padding(top = 2.dp), size = 24.dp,
                color = if (failed) c.destructive else if (nothingNew) c.mutedForeground else c.pos,
            )
            Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space1)) {
                BBText(tr(PersonalImportRules.receiptTitle(status, job?.results)), Modifier.semantics { heading() }, BBStyles.sectionHeading)
                BBText(
                    when {
                        imported -> PersonalImportRules.importSummary(job?.results).let { tr(it.template, it.values) }
                        failed -> job?.error ?: tr("Puoi riprovare con un altro file, oppure aprire il dettaglio dalla lista.")
                        else -> tr("L'abbiamo aggiunto alla lista delle tue importazioni e lo stiamo elaborando.")
                    }, BBTextStyle.Body, color = c.mutedForeground,
                )
                if (failed) io.buddybudget.app.features.help.ReportErrorLink(io.buddybudget.core.domain.support.ReportErrorArea.ImportMovimenti, job?.error ?: tr(PersonalImportRules.receiptTitle(status)))
            }
        }
        val parts = buildList {
            add(file.source)
            file.size?.let { add(PersonalImportRules.sizeText(it, locale)) }
            file.rows?.let { add(if (it == 1) tr("1 riga") else tr("{0} righe", mapOf("0" to it.toString()))) }
        }
        ImportFileRow(file.name, parts.joinToString(" · "))
        ReceiptStages(status, failed)
        if (running) ProgressBar(BBProgressState.Indeterminate, Modifier.fillMaxWidth().height(6.dp), tr("Importazione in corso"))
        val results = job?.results
        // IMP-030: what was added (not when nothing was new), then skipped rows, bank categories and older jobs' note.
        if (imported && results != null && PersonalImportRules.showsAddedLines(results)) {
            Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space1_5)) {
                BBText("${count(results.cash, "movimento aggiunto", "movimenti aggiunti")} ${tr("a Liquidità.")}", BBTextStyle.Body, color = c.mutedForeground)
                BBText("${count(results.investments, "operazione aggiunta", "operazioni aggiunte")} ${tr("a Investimenti.")}", BBTextStyle.Body, color = c.mutedForeground)
                PersonalImportRules.receiptNotes(results).forEach { note -> BBText(tr(note.template, note.values), BBTextStyle.Body, color = c.mutedForeground) }
            }
        }
        if (running) {
            Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space1)) {
                BBText(tr("Puoi chiudere questa pagina: ti scriviamo un'email appena abbiamo finito."), BBTextStyle.Body)
                if (job != null && job.estimatedAt.isNotEmpty()) {
                    BBText(tr("Stima: entro il") + " " + PersonalImportRules.dayMonthTime(job.estimatedAt, ZoneId.systemDefault(), locale) +
                        tr(". È una stima, non una scadenza garantita."), BBTextStyle.Body, color = c.mutedForeground)
                }
            }
        }
        Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
            if (imported && results != null) {
                if (results.cash > 0) BBButton(tr("Vai a Liquidità"), { shell.open(AppDestination.Liquidity) }, size = BBButtonSize.Touch, fullWidth = true)
                if (results.investments > 0) {
                    BBButton(tr("Vai alle operazioni"), { shell.open("/investimenti/operazioni") },
                        variant = if (results.cash > 0) BBButtonVariant.Outline else BBButtonVariant.Default, size = BBButtonSize.Touch, fullWidth = true)
                }
            }
            // IMP-049…054: off until the web ships corrections (decision 0004).
            if (imported && PersonalImportRules.CORRECTIONS_ENABLED) BBButton(tr("Il risultato è sbagliato"), { model.correcting = jobId }, variant = BBButtonVariant.Outline, size = BBButtonSize.Touch, fullWidth = true)
            BBButton(tr("Vedi le tue importazioni"), { model.scrollTarget = ImportsModel.ScrollTarget.List }, variant = BBButtonVariant.Outline,
                size = BBButtonSize.Touch, fullWidth = true)
            BBButton(tr("Carica un altro file"), { model.anotherFile() }, variant = BBButtonVariant.Ghost, size = BBButtonSize.Touch, fullWidth = true)
        }
    }
}

@Composable
private fun ReceiptStages(status: String?, failed: Boolean) {
    val c = BuddyBudgetTheme.colors
    val stage = PersonalImportRules.receiptStage(status)
    val label = tr("Avanzamento dell'importazione")
    Column(Modifier.semantics { contentDescription = label }, verticalArrangement = Arrangement.spacedBy(BBSpacing.space2_5)) {
        PersonalImportRules.receiptStages.forEachIndexed { index, text ->
            val done = index < stage
            val active = index == stage && !failed
            val state = tr(if (done) "fatto" else if (active) "in corso" else "in attesa")
            Row(Modifier.semantics(mergeDescendants = true) { stateDescription = state }, verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
                Box(Modifier.size(24.dp).background(if (done) c.posSoft else c.muted, CircleShape), contentAlignment = Alignment.Center) {
                    if (active) BBSpinner(12.dp, c.foreground) else BBIconView(if (done) BBIcon.Check else BBIcon.CircleDashed, size = 12.dp,
                        color = if (done) c.pos else c.mutedForeground)
                }
                if (active) ShimmerText(tr(text) + "…", style = BBTextStyle.BodyStrong)
                else BBText(tr(text), BBTextStyle.Body, color = if (done) c.foreground else c.mutedForeground)
            }
        }
    }
}

// ---------------------------------------------------------------- Upload form (IMP-012…025)

@Composable
fun ImportUploadForm(model: ImportsModel) {
    val c = BuddyBudgetTheme.colors
    val locale = LocalBBLocale.current
    val form = model.form
    val steps = PersonalImportRules.UploadStep.entries
    val pick = rememberImportFilePicker { files -> files.firstOrNull()?.let { model.pick(it, locale) } }
    var disclosure by remember { mutableStateOf(false) }
    val generic = tr("Operazione non riuscita. Riprova.")
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space6)) {
        io.buddybudget.app.features.accounts.StepProgressBar(form.step.ordinal, steps.size, tr("Passi dell'importazione"))
        Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space4)) {
            when (form.step) {
                PersonalImportRules.UploadStep.Source -> {
                    val formats = model.formats
                    StepHeading(tr("Da dove arriva il file?"),
                        if (formats.isEmpty()) tr("Il nome della tua banca o del tuo broker: serve a riconoscere il formato la prossima volta.")
                        else tr("Scegli un formato che hai già creato, oppure descrivine uno nuovo."))
                    if (formats.isNotEmpty()) {
                        BBSelect(listOf<Pair<String?, String>>(null to tr("Nuova banca o broker")) + formats.map { it.id to it.name }, form.formatId,
                            { model.selectFormat(it) }, label = tr("Formato"), height = BBLayout.minTouchTarget)
                    }
                    if (model.isNewFormat) {
                        BBTextField(form.name, { model.form = model.form.copy(name = it.take(PersonalImportRules.NAME_MAX_LENGTH)) },
                            label = tr("Nome della banca o del broker"), placeholder = tr("Es. Banca Sella"), height = BBLayout.minTouchTarget)
                    } else {
                        CheckboxRow(form.regenerate, { model.form = model.form.copy(regenerate = it) }, tr("Rileggi il formato con l'AI") + " ",
                            tr("(se il file è cambiato o il risultato precedente non era giusto)"))
                    }
                }
                PersonalImportRules.UploadStep.File -> {
                    StepHeading(tr("Carica il file"), tr("CSV o Excel (.xlsx), fino a {0} e {1} righe.",
                        mapOf("0" to PersonalImportRules.sizeText(PersonalImportRules.MAX_BYTES, locale),
                            "1" to BBFormat.formatNumber(PersonalImportRules.MAX_ROWS.toDouble(), locale))))
                    val file = form.file
                    if (file != null) {
                        ImportFileRow(file.name, PersonalImportRules.sizeText(file.size, locale) + " " + tr("· pronto"), filled = false,
                            removeLabel = tr("Rimuovi {0}", mapOf("0" to file.name))) { model.removeFile() }
                    } else {
                        FilePickZone(if (form.reading) tr("Leggo il file…") else tr("Scegli un file"),
                            if (form.reading) tr("Un attimo") else tr("CSV, TXT o Excel (.xlsx)"), form.reading, pick)
                    }
                    form.fileError?.let { io.buddybudget.app.features.help.ErrorWithReport(io.buddybudget.core.domain.support.ReportErrorArea.ImportMovimenti, tr(it.template, it.values)) }
                }
                PersonalImportRules.UploadStep.Consent -> {
                    StepHeading(tr("Ultimo passo: il consenso"), tr("Per capire le colonne di un formato nuovo, il file viene letto da un modello AI."))
                    CheckboxRow(form.consent, { model.setConsent(it, generic) },
                        tr("Acconsento all'analisi AI del file, anche automaticamente se il formato salvato non riesce a leggerlo."))
                    DisclosureBox(tr("Cosa succede ai tuoi dati"), disclosure, { disclosure = !disclosure }) {
                        BBText(tr("Il file originale completo è inviato a OpenRouter e al modello configurato, con fornitori senza conservazione dei dati. Può contenere descrizioni, dati finanziari ed eventuali dati personali presenti nel file."),
                            BBTextStyle.Body, color = c.mutedForeground)
                        BBText(tr("File e anteprima sono cifrati e restano disponibili per 7 giorni; il file originale viene eliminato al termine dell'analisi. Il formato che ne ricaviamo è privato. Pagamenti e investimenti si salvano da soli al termine dei controlli."),
                            BBTextStyle.Body, color = c.mutedForeground)
                    }
                }
            }
        }
        Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
                if (form.step != PersonalImportRules.UploadStep.Source) {
                    BBButton(tr("Indietro"), { model.back() }, variant = BBButtonVariant.Ghost, size = BBButtonSize.Touch)
                    Spacer(Modifier.weight(1f))
                }
                val last = form.step == PersonalImportRules.UploadStep.Consent
                BBButton(if (last) (if (form.uploading) tr("Carico il file…") else tr("Importa il file")) else tr("Continua"),
                    { if (last) model.submitAsync(generic) else model.next() }, size = BBButtonSize.Touch, isLoading = form.uploading,
                    fullWidth = form.step == PersonalImportRules.UploadStep.Source,
                    enabled = model.stepMissing.isEmpty() && !form.uploading)
            }
            if (model.stepMissing.isNotEmpty()) {
                BBText(tr("Per continuare:") + " " + model.stepMissing.map { tr(it) }.joinToString(", ") + ".", BBTextStyle.Body, color = c.mutedForeground)
            }
            form.uploadError?.let { message ->
                if (form.uploadNotice) {
                    // IMP-062: a file already imported is a notice, not a fault (no report link).
                    Row(
                        Modifier.fillMaxWidth().background(c.alphaMuted50, RoundedCornerShape(BBRadius.xl)).padding(BBSpacing.space3),
                        horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2),
                    ) {
                        BBIconView(BBIcon.Info, Modifier.padding(top = 2.dp), size = 16.dp, color = c.mutedForeground)
                        BBText(message, BBTextStyle.Body, Modifier.weight(1f))
                    }
                } else {
                    io.buddybudget.app.features.help.ErrorWithReport(io.buddybudget.core.domain.support.ReportErrorArea.ImportMovimenti, message)
                }
            }
        }
    }
}

@Composable
private fun StepHeading(title: String, description: String) {
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space1)) {
        BBText(title, BBTextStyle.SectionTitle, Modifier.semantics { heading() })
        BBText(description, BBTextStyle.Body, color = BuddyBudgetTheme.colors.mutedForeground)
    }
}

// ---------------------------------------------------------------- «Le tue importazioni» (IMP-007…011)

@Composable
fun ImportJobList(model: ImportsModel) {
    val c = BuddyBudgetTheme.colors
    PanelSection(tr("Le tue importazioni"), BBIcon.ListChecks, color = c.swatchSlate) {
        if (model.loading) BBText(tr("Caricamento…"), BBTextStyle.Body, color = c.mutedForeground)
        if (model.loadFailed) BBText(tr("Impossibile caricare i CSV personali. Riprova."), BBTextStyle.Body, color = c.destructive)
        if (model.jobs.isEmpty() && !model.loading && !model.loadFailed) {
            Column(Modifier.fillMaxWidth().padding(vertical = BBSpacing.space6), horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
                BBIconView(BBIcon.FileSpreadsheet, size = 32.dp, color = c.mutedForeground)
                BBText(tr("Nessun file caricato"), BBTextStyle.BodyStrong)
                BBText(tr("Quando carichi un file lo trovi qui, con il suo stato."),
                    style = BBTextStyle.Body.style.copy(textAlign = androidx.compose.ui.text.style.TextAlign.Center), color = c.mutedForeground)
            }
        }
        Column {
            model.jobs.forEachIndexed { index, job ->
                JobRow(model, job)
            }
        }
    }
}

@Composable
private fun JobRow(model: ImportsModel, job: PersonalImportListing.Job) {
    val c = BuddyBudgetTheme.colors
    val locale = LocalBBLocale.current
    val state = PersonalImportRules.islandState(job.status)
    val (described, _) = PersonalImportRules.describe(job)
    val message = if (described.verbatim) described.template else tr(described.template, described.values)
    val name = model.source(job)
    val day = PersonalImportRules.dayLabel(job.createdAt, Instant.now(), ZoneId.systemDefault(), locale)
    val isSelected = (model.reportJob?.id ?: model.selected) == job.id
    Column {
        Row(
            Modifier.fillMaxWidth().heightIn(min = 56.dp)
                .bbPressable({ model.tap(job) }, RoundedCornerShape(BBRadius.md), background = if (isSelected) c.alphaMuted40 else androidx.compose.ui.graphics.Color.Transparent,
                    translate = false)
                .semantics { selected = isSelected }
                .padding(vertical = BBSpacing.space3),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(BBSpacing.space3),
        ) {
            ImportStatusIcon(state)
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
                    BBText(name, BBTextStyle.BodyStrong, Modifier.weight(1f, fill = false), maxLines = 1)
                    BBText(tr(day.template, day.values), BBTextStyle.Caption, color = c.mutedForeground, maxLines = 1)
                }
                if (state == PersonalImportIslandState.Running) ShimmerText(message, color = c.mutedForeground)
                else BBText(message, BBTextStyle.Body, color = if (state == PersonalImportIslandState.Failed) c.neg else c.mutedForeground, maxLines = 1)
            }
            BBIconView(BBIcon.ChevronRight, size = 16.dp, color = c.mutedForeground)
        }
        if (state == PersonalImportIslandState.Running) {
            ProgressBar(BBProgressState.Indeterminate, Modifier.padding(start = 44.dp, bottom = BBSpacing.space3).fillMaxWidth().height(6.dp),
                tr("Importazione {0} in corso", mapOf("0" to name)))
        }
    }
}

@Composable
fun ImportStatusIcon(state: PersonalImportIslandState?) {
    val c = BuddyBudgetTheme.colors
    val (bg, content) = when (state) {
        PersonalImportIslandState.Running -> c.alphaPrimary10 to @Composable { BBSpinner(14.dp, c.primary) }
        PersonalImportIslandState.Review -> c.alphaPrimary10 to @Composable { BBIconView(BBIcon.ListChecks, size = 14.dp, color = c.primary) }
        PersonalImportIslandState.Done -> c.posSoft to @Composable { BBIconView(BBIcon.Check, size = 14.dp, color = c.pos) }
        else -> c.negSoft to @Composable { BBIconView(BBIcon.CircleAlert, size = 14.dp, color = c.neg) }
    }
    Box(Modifier.size(32.dp).background(bg, CircleShape), contentAlignment = Alignment.Center) { content() }
}
