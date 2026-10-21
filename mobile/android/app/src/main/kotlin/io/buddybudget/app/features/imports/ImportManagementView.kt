package io.buddybudget.app.features.imports

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import io.buddybudget.app.AppEnvironment
import io.buddybudget.app.debug.DebugLaunch
import io.buddybudget.app.designsystem.BuddyBudgetTheme
import io.buddybudget.app.designsystem.components.BBButton
import io.buddybudget.app.designsystem.components.BBButtonSize
import io.buddybudget.app.designsystem.components.BBButtonVariant
import io.buddybudget.app.designsystem.components.BBSeparator
import io.buddybudget.app.designsystem.components.BBSheet
import io.buddybudget.app.designsystem.components.BBText
import io.buddybudget.app.designsystem.components.BBTextField
import io.buddybudget.app.designsystem.components.FormDialogHeader
import io.buddybudget.app.designsystem.components.LocalBBLocale
import io.buddybudget.app.designsystem.components.bbPressable
import io.buddybudget.app.designsystem.generated.BBIcon
import io.buddybudget.app.designsystem.generated.BBLayout
import io.buddybudget.app.designsystem.generated.BBRadius
import io.buddybudget.app.designsystem.generated.BBSpacing
import io.buddybudget.app.designsystem.generated.BBTextStyle
import io.buddybudget.app.generated.LocalStrings
import io.buddybudget.app.tr
import io.buddybudget.core.data.ImportApiFailure
import io.buddybudget.core.domain.format.BBLocale
import io.buddybudget.core.domain.imports.BrokerStatementRecord
import io.buddybudget.core.domain.imports.ImportHistory
import io.buddybudget.core.domain.imports.ImportHistoryItem
import io.buddybudget.core.domain.imports.ImportStatusTone
import io.buddybudget.core.domain.imports.InvestmentResetPreview
import kotlinx.coroutines.MainScope
import kotlinx.coroutines.async
import kotlinx.coroutines.launch
import java.time.ZoneId

/**
 * «Importazioni» dialog from «Importazioni fatte» (07-investments §9, INV-106…110): the files uploaded grouped by
 * source, deletion with a confirmation of what goes and what stays (decision 0003), full reset with a typed
 * confirmation. Same fields as `ImportManagementModel` on iOS.
 */
class ImportManagementModel(val env: AppEnvironment, val imports: ImportsModel) {
    data class Confirmation(
        val brokerIds: List<String>?,
        val id: String,
        val token: String?,
        val title: String,
        val intro: String,
        val items: List<String>,
        val removes: List<String>,
        val keeps: List<String>,
        val confirmLabel: String,
    )

    var statements by mutableStateOf<List<BrokerStatementRecord>>(emptyList())
        private set
    var loading by mutableStateOf(false)
        private set
    var statementsFailed by mutableStateOf(false)
        private set
    var personalFailed by mutableStateOf(false)
        private set
    var showAll by mutableStateOf(false)
    var listOpen by mutableStateOf(false)
    var advancedOpen by mutableStateOf(false)
    var verifying by mutableStateOf(false)
        private set
    var verifyError by mutableStateOf<String?>(null)
        private set
    var deleted by mutableStateOf(false)
        private set
    var confirmation by mutableStateOf<Confirmation?>(null)
    var deleting by mutableStateOf(false)
        private set
    var deleteError by mutableStateOf<String?>(null)
        private set
    var resetOpen by mutableStateOf(false)
    var resetPreview by mutableStateOf<InvestmentResetPreview?>(null)
        private set
    var resetPreviewLoading by mutableStateOf(false)
        private set
    var resetPreviewError by mutableStateOf<String?>(null)
        private set
    var resetText by mutableStateOf("")
    var resetting by mutableStateOf(false)
        private set
    var resetError by mutableStateOf<String?>(null)
        private set
    var resetDone by mutableStateOf(false)
        private set
    var onChanged: (() -> Unit)? = null
    private val scope = MainScope()

    val history: List<ImportHistoryItem> get() = ImportHistory.build(statements, imports.listing)

    suspend fun load() {
        loading = true
        deleted = false
        val personal = scope.async { imports.load() }
        try {
            statements = env.brokerImports.statements()
            statementsFailed = false
        } catch (e: Exception) {
            statementsFailed = true
        }
        personal.await()
        personalFailed = imports.listing == null
        loading = false
    }

    fun loadAsync() {
        scope.launch { load() }
    }

    /** INV-107 / INV-108. */
    suspend fun requestDelete(item: ImportHistoryItem, locale: BBLocale, t: (String, Map<String, String>) -> String) {
        deleteError = null
        deleted = false
        val zone = ZoneId.systemDefault()
        if (item.kind == ImportHistoryItem.Kind.Broker) {
            val affected = ImportHistory.affectedStatements(item.id, statements)
            val source = translatedSource(item.source, t)
            val many = affected.size > 1
            confirmation = Confirmation(
                brokerIds = affected.map { it.id }, id = item.id, token = null,
                title = if (many) t("Eliminare {0} importazioni di {1}?", mapOf("0" to affected.size.toString(), "1" to source))
                else t("Eliminare l'importazione di {0}?", mapOf("0" to source)),
                intro = t(if (many) "Insieme a quella scelta vanno tolti i caricamenti successivi dello stesso conto, perché i loro saldi partono da questo."
                else "Il rendiconto e le sue operazioni vengono tolti dal portafoglio.", emptyMap()),
                items = affected.map { ImportHistory.period(it.statement.from, it.statement.to, zone, locale) },
                removes = listOf(t(if (item.source.startsWith("Trade Republic")) "Le operazioni di questi rendiconti e i movimenti del conto importati con loro"
                else "Le operazioni di questi rendiconti", emptyMap()), t("La liquidità torna all'ultima chiusura conservata, o a zero", emptyMap())),
                keeps = listOf(t("Strumenti e prezzi storici", emptyMap()), t("Puoi ripristinare tutto importando di nuovo i file originali", emptyMap())),
                confirmLabel = if (many) t("Elimina {0} importazioni", mapOf("0" to affected.size.toString())) else t("Elimina l'importazione", emptyMap()),
            )
            return
        }
        verifying = true
        verifyError = null
        try {
            val preview = env.personalImports.deletionSummary(item.id)
            confirmation = Confirmation(
                brokerIds = null, id = item.id, token = preview.token,
                title = t("Eliminare l'importazione «{0}»?", mapOf("0" to preview.name)),
                intro = t("I dati caricati con questo formato personale vengono tolti dal tuo patrimonio.", emptyMap()),
                items = preview.uploads.map { t("Caricamento del {0}", mapOf("0" to ImportHistory.date(it.createdAt, zone, locale))) },
                removes = listOf(t("{0} movimenti di cassa (inclusi i regolamenti degli investimenti)", mapOf("0" to preview.cashCount.toString())),
                    t("{0} operazioni di investimento", mapOf("0" to preview.investmentCount.toString()))),
                keeps = listOf(t("Il formato personale, i conti e gli strumenti", emptyMap()),
                    t("Puoi reimportare il CSV quando vuoi: i saldi si aggiornano di nuovo", emptyMap())),
                confirmLabel = t("Elimina l'importazione", emptyMap()),
            )
        } catch (e: Exception) {
            verifyError = ImportApiFailure.of(e).message ?: "Operazione non riuscita"
        } finally {
            verifying = false
        }
    }

    suspend fun confirmDelete() {
        val c = confirmation ?: return
        deleting = true
        deleteError = null
        try {
            val ids = c.brokerIds
            if (ids != null) env.brokerImports.deleteStatement(c.id, ids) else env.personalImports.delete(c.id, c.token ?: "")
            confirmation = null
            load()
            deleted = true
            onChanged?.invoke()
        } catch (e: Exception) {
            deleteError = ImportApiFailure.of(e).message ?: "Operazione non riuscita"
        } finally {
            deleting = false
        }
    }

    fun reviewReset() {
        resetText = ""
        resetError = null
        resetPreview = null
        resetPreviewError = null
        resetOpen = true
        resetPreviewLoading = true
        scope.launch {
            try {
                resetPreview = env.brokerImports.resetPreview()
            } catch (e: Exception) {
                resetPreviewError = ImportApiFailure.of(e).message ?: "Operazione non riuscita"
            } finally {
                resetPreviewLoading = false
            }
        }
    }

    val canReset: Boolean
        get() = resetPreview != null && !resetPreviewLoading && !resetting && resetError == null && resetText == ImportHistory.RESET_CONFIRMATION

    fun reset() {
        val preview = resetPreview ?: return
        if (!canReset) return
        resetting = true
        scope.launch {
            try {
                env.brokerImports.reset(preview.revision)
                resetOpen = false
                resetDone = true
                load()
                onChanged?.invoke()
            } catch (e: Exception) {
                resetError = ImportApiFailure.of(e).message ?: "Operazione non riuscita"
            } finally {
                resetting = false
            }
        }
    }

    fun translatedSource(source: String, t: (String, Map<String, String>) -> String): String =
        if (ImportHistory.isIbkrSource(source)) source.replace(" · conto …", " · ${t("conto", emptyMap())} …") else t(source, emptyMap())
}

@Composable
fun ImportManagementView(model: ImportManagementModel, onOpenJob: (String) -> Unit) {
    val c = BuddyBudgetTheme.colors
    val locale = LocalBBLocale.current
    val strings = LocalStrings.current
    val t: (String, Map<String, String>) -> String = { s, v -> strings.lookup(s, v) }
    val scope = androidx.compose.runtime.rememberCoroutineScope()
    val history = model.history
    LaunchedEffect(Unit) {
        model.load()
        // `--es bbImportDelete show|confirm` (debug only): the deletion confirmation of the newest import.
        val mode = DebugLaunch.value("bbImportDelete")
        val first = model.history.firstOrNull()
        if (mode != null && first != null) {
            model.requestDelete(first, locale, t)
            if (mode == "confirm") model.confirmDelete()
        }
    }
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space4)) {
        FormDialogHeader(BBIcon.Database, tr("Importazioni"),
            tr("I file che hai caricato. Per aggiornare un periodo importa un file più recente: le operazioni già presenti vengono saltate."), c.swatchSlate)
        if (model.loading && history.isEmpty()) BBText(tr("Caricamento importazioni…"), BBTextStyle.Body, color = c.mutedForeground)
        if (model.statementsFailed) Failure(tr("Non riesco a leggere i rendiconti.")) { model.loadAsync() }
        if (model.personalFailed) Failure(tr("Non riesco a leggere i CSV personali.")) { model.loadAsync() }
        if (!model.loading && !model.statementsFailed && !model.personalFailed && history.isEmpty()) {
            BBText(tr("Non hai ancora importato nessun file: con «Importa un file» carichi il rendiconto del tuo broker."), BBTextStyle.Body, color = c.mutedForeground)
        }
        if (model.verifying) BBText(tr("Verifico cosa verrebbe eliminato…"), BBTextStyle.Body, color = c.mutedForeground)
        model.verifyError?.let { BBText(tr(it), BBTextStyle.Body, color = c.destructive) }
        if (model.deleted) BBText(tr("Importazione eliminata. Saldi e posizioni sono aggiornati."), BBTextStyle.Body)
        if (model.resetDone) BBText(tr("Investimenti azzerati. Ora puoi reimportare i rendiconti completi."), BBTextStyle.Body)
        if (history.isNotEmpty()) {
            Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
                Row(Modifier.fillMaxWidth().heightIn(min = BBLayout.minTouchTarget).bbPressable({ model.listOpen = !model.listOpen }, RoundedCornerShape(BBRadius.md),
                    translate = false), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                        BBText(tr("Vedi e gestisci i file caricati"), BBTextStyle.BodyStrong)
                        val sources = history.map { it.source }.toSet().size
                        val files = if (history.size == 1) "1 ${tr("file caricato")}" else "${history.size} ${tr("file caricati")}"
                        val origins = if (sources == 1) tr("1 origine") else tr("{0} origini", mapOf("0" to sources.toString()))
                        BBText(tr("{0} da {1} · ultimo il {2}", mapOf("0" to files, "1" to origins, "2" to ImportHistory.date(history[0].createdAt, ZoneId.systemDefault(), locale))),
                            BBTextStyle.Caption, color = c.mutedForeground)
                    }
                    io.buddybudget.app.designsystem.components.BBIconView(BBIcon.ChevronDown, Modifier.rotate(if (model.listOpen) 180f else 0f), size = 16.dp, color = c.mutedForeground)
                }
                if (model.listOpen) {
                    val groups = ImportHistory.group(if (model.showAll) history else history.take(ImportHistory.VISIBLE))
                    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space5)) {
                        groups.forEach { group ->
                            Column {
                                BBText(model.translatedSource(group.source, t), style = BBTextStyle.BodyStrong.style.copy(fontWeight = FontWeight.W600))
                                group.items.forEachIndexed { i, item ->
                                    if (i > 0) BBSeparator()
                                    HistoryRow(model, item, onOpenJob) { scope.launch { model.requestDelete(item, locale, t) } }
                                }
                            }
                        }
                        if (history.size > ImportHistory.VISIBLE) {
                            BBButton(if (model.showAll) tr("Mostra meno") else tr("Mostra tutte ({0})", mapOf("0" to history.size.toString())), { model.showAll = !model.showAll },
                                variant = BBButtonVariant.Ghost, size = BBButtonSize.Sm)
                        }
                        Text(buildAnnotatedString {
                            withStyle(SpanStyle(fontWeight = FontWeight.W500, color = c.foreground)) { append(tr("Annullare un'importazione:") + " ") }
                            withStyle(SpanStyle(color = c.mutedForeground)) {
                                append(tr("«Elimina» toglie le operazioni e i saldi che quel file aveva portato; ti mostro cosa sparisce prima di confermare e puoi sempre reimportare il file."))
                            }
                        }, style = BBTextStyle.Body.style)
                        DisclosureBox(tr("Opzioni avanzate") + " " + tr("· ripartire da zero"), model.advancedOpen, { model.advancedOpen = !model.advancedOpen }, boxed = false) {
                            BBText(tr("Riparti da zero"), style = BBTextStyle.BodyStrong.style.copy(fontWeight = FontWeight.W600))
                            BBText(tr("Numeri duplicati dopo un vecchio import? Azzera lo storico investimenti e poi importa nuovamente i CSV completi, dal più vecchio al più recente. Si eliminano anche le operazioni inserite a mano."),
                                BBTextStyle.Body, color = c.mutedForeground)
                            BBButton(tr("Rimuovi tutti gli import e azzera gli investimenti"), { model.reviewReset() }, variant = BBButtonVariant.Outline,
                                size = BBButtonSize.Touch, fullWidth = true)
                        }
                    }
                }
            }
        }
    }
    val confirmation = model.confirmation
    BBSheet(confirmation != null, { if (!model.deleting) model.confirmation = null }, confirmation?.title) {
        if (confirmation != null) DeleteSheet(model, confirmation) { scope.launch { model.confirmDelete() } }
    }
    BBSheet(model.resetOpen, { if (!model.resetting) model.resetOpen = false }, tr("Azzerare tutto lo storico investimenti?")) { ResetSheet(model) }
}

@Composable
private fun Failure(text: String, onRetry: () -> Unit) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space1)) {
        BBText(text, BBTextStyle.Body, color = BuddyBudgetTheme.colors.destructive)
        TextLinkButton(tr("Riprova"), onRetry)
    }
}

@Composable
private fun HistoryRow(model: ImportManagementModel, item: ImportHistoryItem, onOpenJob: (String) -> Unit, onDelete: () -> Unit) {
    val c = BuddyBudgetTheme.colors
    val locale = LocalBBLocale.current
    val strings = LocalStrings.current
    val zone = ZoneId.systemDefault()
    val color = when (item.tone) {
        ImportStatusTone.Ok -> c.pos
        ImportStatusTone.Warning -> c.swatchAmber
        ImportStatusTone.Error -> c.destructive
        ImportStatusTone.Pending -> c.swatchIndigo
    }
    val details = item.details.map { d -> d.count?.let { "$it ${tr(if (it == 1) d.one else d.many)}" } ?: tr(d.one) }
    val status = item.warnings?.let { "$it ${tr(if (it == 1) "avviso" else "avvisi")}" } ?: tr(item.statusLabel)
    val period = item.period?.let { ImportHistory.period(it.first, it.second, zone, locale) }
    val label = tr("{0}{1}, caricato il {2}", mapOf("0" to model.translatedSource(item.source) { s, v -> strings.lookup(s, v) },
        "1" to (period?.let { ", $it" } ?: ""), "2" to ImportHistory.date(item.createdAt, zone, locale)))
    Column(Modifier.padding(vertical = BBSpacing.space3), verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
        Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
            BBText(period ?: tr("File caricato"), BBTextStyle.BodyStrong)
            BBText((listOf(tr("Caricato il") + " " + ImportHistory.date(item.createdAt, zone, locale)) + details).joinToString(" · "), BBTextStyle.Caption,
                color = c.mutedForeground)
        }
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space1_5)) {
                Box(Modifier.size(8.dp).background(color, CircleShape))
                BBText(status, BBTextStyle.Body, color = c.mutedForeground)
            }
            Spacer(Modifier.weight(1f))
            if (item.kind == ImportHistoryItem.Kind.Personal) {
                val openLabel = tr("Apri l'importazione: {0}", mapOf("0" to label))
                BBText(tr("Apri"), BBTextStyle.BodyStrong, Modifier.heightIn(min = BBLayout.minTouchTarget).bbPressable({ onOpenJob(item.id) }, RoundedCornerShape(BBRadius.sm),
                    translate = false).semantics { contentDescription = openLabel }.padding(vertical = BBSpacing.space3), color = c.primary)
            }
            val deleteLabel = tr("Elimina l'importazione: {0}", mapOf("0" to label))
            BBText(tr("Elimina"), BBTextStyle.BodyStrong, Modifier.heightIn(min = BBLayout.minTouchTarget).bbPressable(onDelete, RoundedCornerShape(BBRadius.sm),
                translate = false, enabled = !model.verifying).semantics { contentDescription = deleteLabel }.padding(vertical = BBSpacing.space3), color = c.destructive)
        }
    }
}

@Composable
private fun DeleteSheet(model: ImportManagementModel, c: ImportManagementModel.Confirmation, onConfirm: () -> Unit) {
    val colors = BuddyBudgetTheme.colors
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space4)) {
        BBText(c.intro, BBTextStyle.Body, color = colors.mutedForeground)
        Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space1_5)) {
            BBText(tr("Viene eliminato"), BBTextStyle.BodyStrong)
            c.items.forEach { BBText(it, BBTextStyle.BodyStrong) }
            c.removes.forEach { BBText(it, BBTextStyle.Body, color = colors.mutedForeground) }
        }
        Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space1_5)) {
            BBText(tr("Resta com'è"), BBTextStyle.BodyStrong)
            c.keeps.forEach { BBText(it, BBTextStyle.Body, color = colors.mutedForeground) }
        }
        model.deleteError?.let { BBText(tr(it), BBTextStyle.Body, color = colors.destructive) }
        Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
            BBButton(if (model.deleting) tr("Eliminazione…") else c.confirmLabel, onConfirm, variant = BBButtonVariant.Destructive, size = BBButtonSize.Touch,
                fullWidth = true, isLoading = model.deleting, enabled = !model.deleting)
            BBButton(tr("Annulla"), { model.confirmation = null }, variant = BBButtonVariant.Ghost, size = BBButtonSize.Touch, fullWidth = true, enabled = !model.deleting)
        }
    }
}

@Composable
private fun ResetSheet(model: ImportManagementModel) {
    val c = BuddyBudgetTheme.colors
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
        BBText(tr("I vecchi import non sono distinguibili dalle operazioni manuali. Questa azione elimina tutte le operazioni di investimento, anche quelle inserite a mano, tutti i rendiconti e i prezzi personali, inclusi i movimenti del conto importati da Trade Republic. Cancella lo storico del valore degli investimenti e azzera la liquidità dei conti collegati agli import. Non è annullabile: per ripristinare i dati servono i CSV originali."),
            BBTextStyle.Body, color = c.mutedForeground)
        BBText(tr("Conti bancari e relativi movimenti, budget, debiti e pensioni restano invariati. Portafogli, strumenti e impostazioni restano disponibili."), BBTextStyle.Body)
        if (model.resetPreviewLoading) BBText(tr("Preparazione del riepilogo…"), BBTextStyle.Body, color = c.mutedForeground)
        model.resetPreviewError?.let { BBText(tr(it), BBTextStyle.Body, color = c.destructive) }
        model.resetPreview?.let { p ->
            Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space1)) {
                BBText("${p.operations} ${tr("operazioni da eliminare (")} ${p.untrackedOperations} ${tr("senza origine tracciata, incluse eventuali operazioni manuali)")}", BBTextStyle.Body)
                BBText("${p.statements} ${tr("rendiconti da eliminare")}", BBTextStyle.Body)
                BBText("${p.prices} ${tr("prezzi personali da eliminare")}", BBTextStyle.Body)
                BBText("${p.cashAccounts} ${tr("conti di liquidità broker da azzerare")}", BBTextStyle.Body)
            }
            Text(buildAnnotatedString {
                append(tr("Per confermare scrivi") + " ")
                withStyle(SpanStyle(fontWeight = FontWeight.W600)) { append(ImportHistory.RESET_CONFIRMATION) }
            }, style = BBTextStyle.Body.style.copy(color = c.foreground))
            BBTextField(model.resetText, { model.resetText = it }, enabled = !model.resetting, height = BBLayout.minTouchTarget)
        }
        model.resetError?.let { BBText(tr(it), BBTextStyle.Body, color = c.destructive) }
        if (model.resetPreviewError != null || model.resetError != null) {
            BBButton(tr("Aggiorna riepilogo"), { model.reviewReset() }, variant = BBButtonVariant.Outline, size = BBButtonSize.Touch, fullWidth = true)
        }
        BBButton(if (model.resetting) tr("Azzeramento…") else tr("Azzera definitivamente gli investimenti"), { model.reset() }, variant = BBButtonVariant.Destructive,
            size = BBButtonSize.Touch, fullWidth = true, isLoading = model.resetting, enabled = model.canReset)
        BBButton(tr("Annulla"), { model.resetOpen = false }, variant = BBButtonVariant.Ghost, size = BBButtonSize.Touch, fullWidth = true, enabled = !model.resetting)
    }
}
