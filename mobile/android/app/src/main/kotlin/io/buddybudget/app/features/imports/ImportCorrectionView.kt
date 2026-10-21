package io.buddybudget.app.features.imports

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import io.buddybudget.app.designsystem.BuddyBudgetTheme
import io.buddybudget.app.designsystem.components.BBButton
import io.buddybudget.app.designsystem.components.BBButtonSize
import io.buddybudget.app.designsystem.components.BBButtonVariant
import io.buddybudget.app.designsystem.components.BBStyles
import io.buddybudget.app.designsystem.components.BBText
import io.buddybudget.app.designsystem.components.BBTextArea
import io.buddybudget.app.designsystem.components.LocalBBLocale
import io.buddybudget.app.designsystem.generated.BBIcon
import io.buddybudget.app.designsystem.generated.BBRadius
import io.buddybudget.app.designsystem.generated.BBSpacing
import io.buddybudget.app.designsystem.generated.BBTextStyle
import io.buddybudget.app.tr
import io.buddybudget.core.data.ImportApiFailure
import io.buddybudget.core.domain.format.BBFormat
import io.buddybudget.core.domain.format.JSNumber
import io.buddybudget.core.domain.imports.ImportOperationTypes
import io.buddybudget.core.domain.imports.PersonalImportCorrection
import io.buddybudget.core.domain.imports.PersonalImportListing
import io.buddybudget.core.domain.imports.PersonalImportRules
import kotlinx.coroutines.launch

/**
 * «Il risultato è sbagliato» (IMP-049…054): start a correction of an imported job, follow it, compare current and
 * proposed data, confirm the replacement or discard it. Comparison tables become stacked rows on phone.
 * Twin of `ImportCorrectionView` on iOS.
 */
@Composable
fun ImportCorrectionView(model: ImportsModel, job: PersonalImportListing.Job) {
    val c = BuddyBudgetTheme.colors
    val locale = LocalBBLocale.current
    val scope = rememberCoroutineScope()
    var feedback by remember { mutableStateOf("") }
    var file by remember { mutableStateOf<PickedFile?>(null) }
    var consent by remember { mutableStateOf(false) }
    var approved by remember { mutableStateOf(false) }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var comparison by remember { mutableStateOf<PersonalImportCorrection?>(null) }
    var comparisonError by remember { mutableStateOf<String?>(null) }
    var comparing by remember { mutableStateOf(false) }
    val open = remember { androidx.compose.runtime.mutableStateMapOf<String, Boolean>() }
    val pick = rememberImportFilePicker { files -> file = files.firstOrNull() }
    val starting = job.status == "imported"
    val generic = tr("Operazione non riuscita")
    val unavailable = tr("Confronto non disponibile")
    LaunchedEffect(job.id, job.status) {
        if (job.status != "correction_ready") return@LaunchedEffect
        comparing = true
        try {
            comparison = model.comparison(job.id)
            comparisonError = null
        } catch (e: Exception) {
            comparisonError = ImportApiFailure.of(e).message ?: unavailable
        }
        comparing = false
    }
    fun finish(replace: Boolean) {
        busy = true
        error = null
        scope.launch {
            error = model.finishCorrection(job, replace, generic)
            busy = false
        }
    }
    Column(
        Modifier.fillMaxWidth().border(1.dp, c.border, RoundedCornerShape(BBRadius.xl)).padding(BBSpacing.space4),
        verticalArrangement = Arrangement.spacedBy(BBSpacing.space4),
    ) {
        BBText(tr(if (starting) "Il risultato è sbagliato" else "Correzione dell’importazione"), Modifier.semantics { heading() }, BBStyles.sectionHeading)
        BBText(tr("I movimenti originali restano invariati fino alla conferma della sostituzione."), BBTextStyle.Body)
        if (starting) {
            BBTextArea(feedback, { feedback = it }, label = tr("Che cosa è sbagliato?"), maxLength = PersonalImportRules.FEEDBACK_MAX_LENGTH)
            Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
                BBText(tr("Ricarica il file originale CSV o Excel"), BBTextStyle.BodyStrong)
                val chosen = file
                if (chosen != null) {
                    ImportFileRow(chosen.name, PersonalImportRules.sizeText(chosen.data.size, locale), filled = false,
                        removeLabel = tr("Rimuovi {0}", mapOf("0" to chosen.name))) { file = null }
                } else {
                    BBButton(tr("Scegli un file"), pick, icon = BBIcon.Upload, variant = BBButtonVariant.Outline, size = BBButtonSize.Touch, fullWidth = true)
                }
            }
            BBText(tr("Il file precedente è stato eliminato dopo l’importazione. L’AI analizzerà il file completo insieme alla tua segnalazione tramite OpenRouter, senza conservazione presso il fornitore."),
                BBTextStyle.Body, color = c.mutedForeground)
            CheckboxRow(consent, { consent = it }, tr("Acconsento a inviare il file completo e la segnalazione per una nuova analisi AI."))
            BBButton(tr(if (busy) "Invio…" else "Analizza la correzione"), {
                val chosen = file ?: return@BBButton
                busy = true
                error = null
                scope.launch {
                    error = model.startCorrection(job.id, feedback, chosen, generic)
                    busy = false
                }
            }, size = BBButtonSize.Touch, fullWidth = true, isLoading = busy, enabled = !busy && file != null && JSNumber.trim(feedback).isNotEmpty() && consent)
            BBButton(tr("Annulla"), { model.open(job.id) }, variant = BBButtonVariant.Ghost, size = BBButtonSize.Touch, fullWidth = true, enabled = !busy)
        } else {
            if (job.status == "queued" || job.status == "processing") {
                BBText(tr("Nuova analisi in corso. Ti avviseremo via email quando potrai controllarla."), BBTextStyle.Body)
            }
            job.error?.let { BBText(it, BBTextStyle.Body, color = c.destructive) }
            if (job.status == "expired") BBText(tr("La correzione è scaduta. Scartala e ricarica il file dall’importazione originale."), BBTextStyle.Body)
            if (comparing) BBText(tr("Caricamento del confronto…"), BBTextStyle.Body, color = c.mutedForeground)
            comparisonError?.let { BBText(it, BBTextStyle.Body, color = c.destructive) }
            comparison?.let { data ->
                val money = { v: Double -> BBFormat.formatCurrency(v, data.currency, locale) }
                Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
                    BBText(tr("Effetto dell’importazione sul conto"), BBTextStyle.BodyStrong)
                    CompareRow(tr("Movimenti"), data.before.size.toString(), data.after.size.toString())
                    CompareRow(tr("Operazioni di investimento"), data.investmentsBefore.toString(), data.investmentsAfter.toString())
                    CompareRow(tr("Variazione di liquidità"), money(data.cashBefore), money(data.cashAfter))
                }
                listOf(tr("Movimenti attuali") to data.before, tr("Movimenti proposti") to data.after).forEach { (title, rows) ->
                    DisclosureBox(title, open[title] == true, { open[title] = open[title] != true }, boxed = false) {
                        rows.forEach { r -> BBText("${BBFormat.formatShortDate(r.date, locale)} · ${r.description} · ${money(r.amount)}", BBTextStyle.Body,
                            Modifier.padding(vertical = BBSpacing.space1)) }
                    }
                }
                listOf(tr("Investimenti attuali") to data.tradesBefore, tr("Investimenti proposti") to data.tradesAfter).forEach { (title, rows) ->
                    DisclosureBox(title, open[title] == true, { open[title] = open[title] != true }, boxed = false) {
                        BBText(tr("Prezzo e lordo nella valuta dello strumento; commissioni e imposte nella valuta del profilo."), BBTextStyle.Caption, color = c.mutedForeground)
                        rows.forEach { r ->
                            Column(Modifier.padding(vertical = BBSpacing.space1), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                                BBText("${r.date?.let { BBFormat.formatShortDate(it, locale) } ?: ""} · ${r.description ?: ""}", BBTextStyle.BodyStrong)
                                BBText(listOf(
                                    tr(ImportOperationTypes.label(r.type)),
                                    "${tr("Quantità")} ${BBFormat.formatNumber(r.quantity, locale, maximumFractionDigits = 10)}",
                                    "${tr("Prezzo")} ${BBFormat.formatNumber(r.price, locale, maximumFractionDigits = 8)} ${r.currency}",
                                    "${tr("Lordo")} ${r.grossAmount?.let { "${BBFormat.formatNumber(it, locale, maximumFractionDigits = 3)} ${r.currency}" } ?: "—"}",
                                    "${tr("Commissioni")} ${money(r.fees)}", "${tr("Imposte")} ${money(r.taxes)}",
                                ).joinToString(" · "), BBTextStyle.Caption, color = c.mutedForeground)
                            }
                        }
                    }
                }
                CheckboxRow(approved, { approved = it }, tr("Ho controllato il confronto e voglio sostituire i dati dell’importazione originale."))
                BBButton(tr("Conferma e sostituisci"), { finish(true) }, size = BBButtonSize.Touch, fullWidth = true, isLoading = busy, enabled = !busy && approved)
            }
            BBButton(tr("Scarta correzione e mantieni originale"), { finish(false) }, variant = BBButtonVariant.Outline, size = BBButtonSize.Touch,
                fullWidth = true, enabled = !busy)
        }
        error?.let { BBText(tr(it), BBTextStyle.Body, color = c.destructive) }
    }
}

@Composable
private fun CompareRow(label: String, before: String, after: String) {
    val c = BuddyBudgetTheme.colors
    Column(Modifier.fillMaxWidth().background(c.alphaMuted50, RoundedCornerShape(BBRadius.lg)).padding(BBSpacing.space3),
        verticalArrangement = Arrangement.spacedBy(BBSpacing.space1)) {
        BBText(label, BBTextStyle.Body)
        Row(horizontalArrangement = Arrangement.spacedBy(BBSpacing.space4)) {
            Column(Modifier.weight(1f)) {
                BBText(tr("Attuale"), BBTextStyle.Caption, color = c.mutedForeground)
                BBText(before, style = BBTextStyle.BodyStrong.style.copy(fontFeatureSettings = "tnum"))
            }
            Column(Modifier.weight(1f)) {
                BBText(tr("Proposto"), BBTextStyle.Caption, color = c.mutedForeground)
                BBText(after, style = BBTextStyle.BodyStrong.style.copy(fontFeatureSettings = "tnum"))
            }
        }
    }
}
