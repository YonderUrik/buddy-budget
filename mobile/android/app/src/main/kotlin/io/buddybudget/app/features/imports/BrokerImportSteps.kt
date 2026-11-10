package io.buddybudget.app.features.imports

import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import io.buddybudget.app.designsystem.BuddyBudgetTheme
import io.buddybudget.app.designsystem.components.BBButton
import io.buddybudget.app.designsystem.components.BBButtonSize
import io.buddybudget.app.designsystem.components.BBButtonVariant
import io.buddybudget.app.designsystem.components.BBCheckbox
import io.buddybudget.app.designsystem.components.BBIconBadge
import io.buddybudget.app.designsystem.components.BBIconView
import io.buddybudget.app.designsystem.components.BBSelect
import io.buddybudget.app.designsystem.components.BBSeparator
import io.buddybudget.app.designsystem.components.BBText
import io.buddybudget.app.designsystem.generated.BBIcon
import io.buddybudget.app.designsystem.generated.BBLayout
import io.buddybudget.app.designsystem.generated.BBRadius
import io.buddybudget.app.designsystem.generated.BBSpacing
import io.buddybudget.app.designsystem.generated.BBTextStyle
import io.buddybudget.app.features.investments.InstrumentPickerField
import io.buddybudget.app.features.investments.PanelSection
import io.buddybudget.app.tr
import io.buddybudget.core.data.Instrument
import io.buddybudget.core.domain.imports.ChoiceTone
import io.buddybudget.core.domain.imports.ImportChoices
import io.buddybudget.core.domain.imports.ImportDateOrder
import io.buddybudget.core.domain.imports.ImportDecimalSeparator
import io.buddybudget.core.domain.imports.ImportField
import io.buddybudget.core.domain.imports.ImportIdentityCount
import io.buddybudget.core.domain.imports.ImportMappingRules
import io.buddybudget.core.domain.imports.ImportMessages
import io.buddybudget.core.domain.imports.ImportNormalize
import io.buddybudget.core.domain.imports.ImportOperationTypes
import io.buddybudget.core.domain.imports.ImportProviderId
import io.buddybudget.core.domain.imports.ImportProviders
import io.buddybudget.core.domain.imports.ImportRow
import io.buddybudget.core.domain.imports.ImportRunResult
import io.buddybudget.core.domain.imports.InstrumentChoice
import java.util.Locale

/** Anteprima of a server statement (IBKR, DEGIRO, Trade Republic, INV-096/097). */
@Composable
fun BrokerStatementStep(model: BrokerImportModel) {
    val c = BuddyBudgetTheme.colors
    val rows = model.rows
    val operations = rows.count { it.isOk }
    val cash = model.statement?.cashMovements
    val warnings = model.warnings
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space6)) {
        ImportDialogSection {
            PreviewHeader(model.fileName, model.statement?.let { ImportProviders.info(it.provider).name })
            PreviewNumbers(buildList {
                add(operations to if (operations == 1) "operazione da importare" else "operazioni da importare")
                if (cash != null) add(cash.size to "movimenti del conto")
                add(rows.size - operations + warnings.size to "da guardare")
            })
            if (operations == 0 && cash.isNullOrEmpty()) {
                ImportNotice(NoticeTone.Error, "Non ci sono operazioni da importare in questo file",
                    "Controlla di aver esportato il periodo giusto e di aver scelto il file del broker corretto.")
            }
        }
        if (model.statement?.preset == "degiro" && model.portfolios.isNotEmpty()) {
            val portfolios = model.portfolios
            BBSelect((if (portfolios.size > 1) listOf("" to tr("Scegli un portafoglio")) else emptyList()) + portfolios.map { it.id to it.name },
                if (model.portfolioId.isEmpty() && portfolios.size == 1) portfolios[0].id else model.portfolioId, { model.portfolioId = it },
                label = tr("In quale portafoglio lo metto?"), height = BBLayout.minTouchTarget)
        }
        if (operations > 0) ImportDialogSection(tr("Le prime operazioni")) { ImportRowsPreview(rows) }
        if (!cash.isNullOrEmpty()) {
            ImportDialogSection(tr("Movimenti del conto"),
                tr("Pagamenti con carta, bonifici, interessi e bonus: finiscono in Liquidità → Movimenti, da categorizzare. Il saldo si calcola dallo storico completo partendo da zero, perché il file non contiene un saldo ufficiale.")) {
                Column {
                    cash.take(4).forEachIndexed { i, m ->
                        if (i > 0) BBSeparator()
                        Row(Modifier.padding(vertical = BBSpacing.space1_5), horizontalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
                            BBText("${m.date.split("-").reversed().joinToString("/")} · ${m.description}", BBTextStyle.Body, Modifier.weight(1f), maxLines = 1)
                            BBText("${String.format(Locale.ROOT, "%.2f", m.amount)} ${m.currency}", style = BBTextStyle.Caption.style.copy(fontFeatureSettings = "tnum"))
                        }
                    }
                }
                if (cash.size > 4) BBText("${tr("…e altri")} ${cash.size - 4} ${tr("movimenti, tutti inclusi.")}", BBTextStyle.Caption, color = c.mutedForeground)
            }
        }
        SkippedRowsView(rows)
        if (warnings.isNotEmpty()) {
            ImportNotice(NoticeTone.Warning,
                "${warnings.size} ${tr(if (warnings.size == 1) "voce del rendiconto non viene importata" else "voci del rendiconto non vengono importate")}",
                "Se contano per i tuoi numeri, registrale a mano da «Registra».") {
                warnings.take(5).forEach { w ->
                    BBText("${tr("Riga")} ${w.line} · ${w.section}: ${tr(w.message)}", BBTextStyle.Body, color = c.mutedForeground)
                }
                if (warnings.size > 5) BBText("${tr("…e altre")} ${warnings.size - 5}.", BBTextStyle.Body, color = c.mutedForeground)
            }
        }
    }
}

/** Anteprima of a column CSV (generic, Yahoo, Fineco, INV-098). */
@Composable
fun BrokerMappingStep(model: BrokerImportModel) {
    val c = BuddyBudgetTheme.colors
    var fieldsOpen by remember { mutableStateOf(false) }
    val rows = model.rows
    val ok = rows.filterIsInstance<ImportRow.Ok>()
    val withWarning = ok.count { it.warnings.isNotEmpty() }
    val missing = model.missing
    val recognizedAs = if (model.provider == ImportProviderId.Fineco) ImportProviders.info(ImportProviderId.Fineco).name else model.presetLabel
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space6)) {
        ImportDialogSection {
            PreviewHeader(model.fileName, recognizedAs)
            if (missing.isEmpty()) {
                PreviewNumbers(listOf(ok.size to if (ok.size == 1) "operazione da importare" else "operazioni da importare",
                    rows.size - ok.size to "righe non importate", withWarning to "con un avviso"))
            } else {
                ImportNotice(NoticeTone.Warning, "Mi manca qualche colonna",
                    tr("Indica quale colonna contiene {0}.", mapOf("0" to missing.map { tr(it) }.joinToString(", "))))
            }
        }
        if (missing.isEmpty() && ok.isNotEmpty()) {
            ImportDialogSection(tr("Le prime operazioni"),
                if (withWarning > 0) tr("{0} con un avviso: controllale prima di proseguire.", mapOf("0" to withWarning.toString())) else null) {
                BBText("${ok.size} ${tr("operazioni lette su")} ${rows.size} ${tr("righe")}" +
                    (if (rows.size > ok.size) tr(", {0} scartate", mapOf("0" to (rows.size - ok.size).toString())) else "") +
                    (if (withWarning > 0) tr(", {0} con un avviso", mapOf("0" to withWarning.toString())) else "") + ".", BBTextStyle.Body)
                ImportRowsPreview(rows)
            }
        }
        if (missing.isEmpty() && ok.isEmpty() && rows.isNotEmpty()) {
            ImportNotice(NoticeTone.Error, "Con queste colonne non trovo nessuna operazione valida",
                "Controlla qui sotto che colonne e formati (date, decimali) siano quelli del tuo file.")
        }
        if (missing.isEmpty()) SkippedRowsView(rows)
        if (recognizedAs != null && missing.isEmpty()) {
            DisclosureBox(tr("Come leggo le colonne"), fieldsOpen, { fieldsOpen = !fieldsOpen }, boxed = false) { MappingFields(model) }
        } else {
            PanelSection(tr("Come leggo le colonne"), BBIcon.Table, color = c.swatchIndigo,
                description = tr("Per ogni informazione scegli la colonna del tuo file. La prossima volta ricordo la scelta per file con le stesse intestazioni.")) {
                MappingFields(model)
            }
        }
    }
}

@Composable
private fun MappingFields(model: BrokerImportModel) {
    val c = BuddyBudgetTheme.colors
    val table = model.table ?: return
    val mapping = model.mapping ?: return
    val columnOptions: List<Pair<Int?, String>> = listOf<Pair<Int?, String>>(null to tr("Nessuna colonna")) + table.headers.indices.map { i ->
        val header = table.headers[i].ifEmpty { tr("Colonna {0}", mapOf("0" to (i + 1).toString())) }
        val example = ImportMappingRules.columnExample(table, i)
        i to header + (if (example.isEmpty()) "" else tr(" — es. {0}", mapOf("0" to example)))
    }
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
        ImportField.formOrder.forEach { field ->
            BBSelect(columnOptions, mapping.columns[field], { model.setColumn(field, it) }, label = tr(field.label))
        }
        BBSelect(listOf(ImportDateOrder.YMD to tr("Anno, mese, giorno (2026-01-31)"), ImportDateOrder.DMY to tr("Giorno, mese, anno (31/01/2026)"),
            ImportDateOrder.MDY to tr("Mese, giorno, anno (01/31/2026)")), mapping.dateOrder, { o -> model.updateMapping { it.copy(dateOrder = o) } },
            label = tr("Formato delle date"))
        BBSelect(listOf(ImportDecimalSeparator.DOT to tr("Punto (1,234.56)"), ImportDecimalSeparator.COMMA to tr("Virgola (1.234,56)")), mapping.decimal,
            { d -> model.updateMapping { it.copy(decimal = d) } }, label = tr("Separatore dei decimali"))
        val typeValues = ImportMappingRules.distinctValues(table, mapping.columns[ImportField.Type])
        if (mapping.columns[ImportField.Type] == null) {
            BBSelect(ImportOperationTypes.all.map { it to tr(ImportOperationTypes.label(it)) }, mapping.defaultType,
                { t -> model.updateMapping { it.copy(defaultType = t) } }, label = tr("Senza colonna tipo, ogni riga è un"))
        } else if (typeValues.isNotEmpty()) {
            Column(Modifier.fillMaxWidth().border(1.dp, c.border, RoundedCornerShape(BBRadius.lg)).padding(BBSpacing.space3),
                verticalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
                BBText(tr("Cosa significano i valori della colonna tipo"), BBTextStyle.Caption, color = c.mutedForeground)
                typeValues.forEach { value ->
                    BBSelect(ImportOperationTypes.typeTargets.map { it to tr(ImportOperationTypes.label(it)) }, mapping.typeValues[value.lowercase()] ?: "ignora",
                        { target -> model.updateMapping { it.copy(typeValues = it.typeValues + (value.lowercase() to target)) } }, label = "\"$value\"")
                }
            }
        }
    }
}

/** Strumenti (INV-099): what each instrument of the file was matched to and what to do; attention first. */
@Composable
fun BrokerInstrumentsStep(model: BrokerImportModel, currency: String, suggestions: List<Instrument>) {
    val c = BuddyBudgetTheme.colors
    val identities = model.identities
    if (identities.isEmpty()) {
        BBText(tr("Questo file contiene solo movimenti del conto: non ci sono strumenti da abbinare. Vai avanti per importarli tutti."), BBTextStyle.Body,
            color = c.mutedForeground)
        return
    }
    val included = model.included.size
    val missing = identities.count { ImportChoices.attentionRank(model.choices[it.identity.key]) == 0 && it.identity.key !in model.excluded }
    val toCheck = identities.count { ImportChoices.attentionRank(model.choices[it.identity.key]) == 1 }
    val sorted = model.order.mapNotNull { key -> identities.firstOrNull { it.identity.key == key } }.ifEmpty { identities }
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space4)) {
        Text(buildAnnotatedString {
            withStyle(SpanStyle(fontWeight = FontWeight.W500, color = c.foreground)) { append(included.toString()) }
            append(" ${tr("su")} ${identities.size} ${tr(if (identities.size == 1) "titolo" else "titoli")} ${tr("pronti da importare.")}")
            if (missing > 0) append(tr(" {0} non {1}: cercali oppure lasciali fuori, e le loro operazioni non verranno importate.",
                mapOf("0" to missing.toString(), "1" to tr(if (missing == 1) "è stato trovato" else "sono stati trovati"))))
            if (toCheck > 0) append(" $toCheck ${tr(if (toCheck == 1) "è da controllare" else "sono da controllare")}.")
            append(" " + tr("I titoli nuovi si aggiungono ai tuoi strumenti."))
        }, style = BBTextStyle.Body.style.copy(color = c.mutedForeground))
        Column {
            sorted.forEachIndexed { i, identity ->
                if (i > 0) BBSeparator()
                androidx.compose.runtime.key(identity.id) { InstrumentChoiceRow(model, identity, currency, suggestions) }
            }
        }
    }
}

@Composable
private fun InstrumentChoiceRow(model: BrokerImportModel, identity: ImportIdentityCount, currency: String, suggestions: List<Instrument>) {
    val c = BuddyBudgetTheme.colors
    var changing by remember { mutableStateOf(false) }
    val key = identity.identity.key
    val choice = model.choices[key]
    val status = ImportChoices.describe(choice)
    val usable = choice?.isUsable == true
    val included = usable && key !in model.excluded
    val attention = status.tone == ChoiceTone.Missing || status.tone == ChoiceTone.Check
    val (icon, color) = when (status.tone) {
        ChoiceTone.Ready -> BBIcon.CircleCheck to c.pos
        ChoiceTone.Manual -> BBIcon.PencilLine to c.swatchIndigo
        ChoiceTone.Check -> BBIcon.CircleQuestionMark to c.swatchAmber
        ChoiceTone.Missing -> BBIcon.CircleAlert to c.destructive
    }
    val chosen: Pair<String, String?>? = when (choice) {
        is InstrumentChoice.Known -> choice.instrument.name to choice.instrument.isin
        is InstrumentChoice.Create -> choice.label to "${choice.detail} · ${tr(ImportChoices.typeLabel(choice.type))}"
        else -> null
    }
    Row(Modifier.padding(vertical = BBSpacing.space4).alpha(if (included) 1f else 0.7f), horizontalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
        BBCheckbox(included, { model.setExcluded(key, !it) }, Modifier.padding(top = 4.dp),
            accessibilityLabel = tr("Importa {0}", mapOf("0" to ImportNormalize.identityLabel(identity.identity))), enabled = usable)
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
            Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
                BBText(identity.identity.name ?: identity.identity.symbol ?: identity.identity.isin ?: "", BBTextStyle.BodyStrong, Modifier.weight(1f), maxLines = 1)
                BBText("${identity.count} ${tr(if (identity.count == 1) "operazione" else "operazioni")}", BBTextStyle.Caption, color = c.mutedForeground)
            }
            if (identity.identity.name != null) {
                Text(listOfNotNull(identity.identity.symbol, identity.identity.isin).joinToString(" · "),
                    style = BBTextStyle.Caption.style.copy(fontFamily = FontFamily.Monospace, color = c.mutedForeground))
            }
            Row(horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
                BBIconBadge(icon, color, 20.dp, 12.dp)
                Text(buildAnnotatedString {
                    withStyle(SpanStyle(fontWeight = FontWeight.W500, color = c.foreground)) { append(tr(status.title)) }
                    withStyle(SpanStyle(color = c.mutedForeground)) { append(" · " + tr(status.text)) }
                }, style = BBTextStyle.Body.style)
            }
            if (chosen != null) {
                Text(buildAnnotatedString {
                    withStyle(SpanStyle(color = c.foreground)) { append(chosen.first) }
                    chosen.second?.let { withStyle(SpanStyle(color = c.mutedForeground)) { append(" · $it") } }
                }, Modifier.padding(start = 28.dp), style = BBTextStyle.Body.style)
            }
            Column(Modifier.padding(start = 28.dp)) {
                if (attention || changing) {
                    InstrumentPickerField(null, suggestions, identity.identity.currency ?: currency,
                        placeholder = if (usable) "Scegli un altro strumento…" else "Cerca lo strumento…") { instrument ->
                        model.choose(key, instrument)
                        changing = false
                    }
                } else {
                    BBButton(tr("Non è questo? Cambia strumento"), { changing = true }, variant = BBButtonVariant.Ghost, size = BBButtonSize.Sm)
                }
            }
        }
    }
}

/** Conferma (INV-100…102): what will happen, then what happened and where to find the data. */
@Composable
fun BrokerSummaryStep(model: BrokerImportModel, onManage: () -> Unit, onNavigate: (String) -> Unit) {
    val result = model.result ?: return
    if (model.done) SummaryDone(model, result, onManage, onNavigate) else SummaryPreview(model, result)
}

@Composable
private fun count(n: Int, one: String, many: String): String = if (n == 1) "1 ${tr(one)}" else "$n ${tr(many)}"

@Composable
private fun Fact(text: String) {
    val c = BuddyBudgetTheme.colors
    Row(horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
        BBIconView(BBIcon.Check, Modifier.padding(top = 2.dp), size = 16.dp, color = c.pos)
        BBText(text, BBTextStyle.Body, color = c.mutedForeground)
    }
}

@Composable
private fun SummaryDone(model: BrokerImportModel, result: ImportRunResult, onManage: () -> Unit, onNavigate: (String) -> Unit) {
    val c = BuddyBudgetTheme.colors
    Column(Modifier.fillMaxWidth().padding(vertical = BBSpacing.space4), horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
        BBIconView(BBIcon.CircleCheck, size = 40.dp, color = c.pos)
        BBText(result.inserted.toString(), style = BBTextStyle.AmountLarge.style.copy(fontFeatureSettings = "tnum"))
        BBText(tr(if (result.inserted == 1) "operazione importata" else "operazioni importate"), BBTextStyle.Body, color = c.mutedForeground)
    }
    ImportDialogSection(tr("Cosa è successo")) {
        Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space1_5)) {
            result.replacement?.let { r ->
                Fact("${count(r.statements, "rendiconto precedente sostituito", "rendiconti precedenti sostituiti")} (${r.operations} ${tr("operazioni, dal")} ${r.from} ${tr("al")} ${r.to}).")
            }
            if (result.instrumentsCreated > 0) Fact("${count(result.instrumentsCreated, "strumento nuovo aggiunto", "strumenti nuovi aggiunti")} ${tr("ai tuoi strumenti.")}")
            if (result.counts.duplicate > 0) {
                Fact(count(result.counts.duplicate, "operazione era già presente ed è stata saltata", "operazioni erano già presenti e sono state saltate") + tr(": nessun doppione."))
            }
            if (model.statement != null) Fact(tr("I dati originali del file sono conservati, così puoi sostituirli o cancellarli da «Gestisci importazioni»."))
        }
    }
    ImportDialogSection(tr("Cosa fare ora")) {
        Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space1_5)) {
            InlineLinkText(listOf(LinkPart(tr("Trovi le operazioni in") + " "), LinkPart(tr("Investimenti → Operazioni")) { onNavigate("/investimenti/operazioni") }, LinkPart(".")))
            if (model.cashCount > 0) {
                InlineLinkText(listOf(LinkPart(tr("I movimenti del conto sono in") + " "), LinkPart(tr("Liquidità → Movimenti")) { onNavigate("/liquidita") },
                    LinkPart(tr(", da categorizzare."))))
            }
            if (model.statement != null) {
                InlineLinkText(listOf(LinkPart(tr("Il file è nella lista delle importazioni: da") + " "), LinkPart(tr("Gestisci importazioni"), onManage),
                    LinkPart(" " + tr("puoi vederlo, sostituirlo o cancellarlo."))))
            }
            BBText(tr("I prezzi storici si scaricano in background: il grafico si completa entro qualche minuto."), BBTextStyle.Body, color = c.mutedForeground)
        }
    }
}

@Composable
private fun SummaryPreview(model: BrokerImportModel, result: ImportRunResult) {
    val c = BuddyBudgetTheme.colors
    val errors = result.rows.filter { it.status == "error" }
    val rows = model.rows
    val discarded = rows.count { !it.isOk }
    val freeShares = rows.filterIsInstance<ImportRow.Ok>().count { it.operation.price == 0.0 && it.operation.type == "acquisto" }
    ImportDialogSection {
        if (errors.isEmpty()) {
            PreviewNumbers(listOf(result.counts.new to if (result.counts.new == 1) "operazione da importare" else "operazioni da importare",
                result.counts.duplicate to "già presenti, saltate", model.newInstruments to if (model.newInstruments == 1) "strumento nuovo" else "strumenti nuovi"))
        }
        if (result.counts.new == 0 && errors.isEmpty()) {
            ImportNotice(NoticeTone.Info, "Non c'è niente di nuovo da importare") {
                BBText(tr("Tutte le operazioni di questo file sono già presenti: puoi caricarlo di nuovo senza creare doppioni."), BBTextStyle.Body, color = c.mutedForeground)
            }
        }
        result.replacement?.let { r ->
            ImportNotice(NoticeTone.Info, tr("Sostituisco {0} ({1} operazioni)", mapOf("0" to count(r.statements, "rendiconto", "rendiconti"), "1" to r.operations.toString()))) {
                BBText("${tr("Il nuovo file copre il periodo")} ${r.from} – ${r.to} ${tr("e prende il posto di quello che c'era. I periodi fuori da questo intervallo restano invariati. Se un controllo fallisce, non viene sostituito nulla.")}",
                    BBTextStyle.Body, color = c.mutedForeground)
            }
        }
        Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space1_5)) {
            if (result.counts.duplicate > 0) Fact(tr("Le operazioni già presenti vengono saltate: puoi reimportare lo stesso file senza creare doppioni."))
            if (freeShares > 0) Fact("${count(freeShares, "acquisto a prezzo zero", "acquisti a prezzo zero")} ${tr("(quote ricevute gratis, per esempio staking): abbassano il prezzo medio.")}")
            if (discarded > 0) Fact(count(discarded, "riga del file non viene importata", "righe del file non vengono importate") + tr(": le hai viste nell'anteprima."))
        }
    }
    if (errors.isNotEmpty()) {
        ImportDialogSection(if (errors.size == 1) tr("1 riga da correggere") else tr("{0} righe da correggere", mapOf("0" to errors.size.toString())),
            tr("Finché ci sono errori non importo nulla, così non resta un import a metà.")) {
            Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
                errors.take(5).forEach { row ->
                    val e = ImportMessages.explainRow(row.message ?: "Riga non valida")
                    ImportNotice(NoticeTone.Error, tr("Riga {0}: {1}", mapOf("0" to row.line.toString(), "1" to tr(e.text))), e.hint, row.message)
                }
                if (errors.size > 5) BBText("${tr("…e altre")} ${errors.size - 5} ${tr("righe.")}", BBTextStyle.Body, color = c.mutedForeground)
                BBText(tr("Correggi il file e ricaricalo, oppure torna indietro ed escludi lo strumento interessato."), BBTextStyle.Body, color = c.mutedForeground)
            }
        }
    }
}
