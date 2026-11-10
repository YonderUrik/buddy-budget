package io.buddybudget.app.features.investments

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import io.buddybudget.app.designsystem.BuddyBudgetTheme
import io.buddybudget.app.designsystem.components.AmountText
import io.buddybudget.app.designsystem.components.BBButton
import io.buddybudget.app.designsystem.components.BBButtonSize
import io.buddybudget.app.designsystem.components.BBButtonVariant
import io.buddybudget.app.designsystem.components.BBErrorBox
import io.buddybudget.app.designsystem.components.BBIconButton
import io.buddybudget.app.designsystem.components.BBIconView
import io.buddybudget.app.designsystem.components.BBKeyboard
import io.buddybudget.app.designsystem.components.BBSeparator
import io.buddybudget.app.designsystem.components.BBText
import io.buddybudget.app.designsystem.components.BBTextField
import io.buddybudget.app.designsystem.components.FormDialog
import io.buddybudget.app.designsystem.components.FormDialogHeader
import io.buddybudget.app.designsystem.components.LocalBBLocale
import io.buddybudget.app.designsystem.components.LocalHideAmounts
import io.buddybudget.app.designsystem.components.SegmentedControl
import io.buddybudget.app.designsystem.components.bbSwatch
import io.buddybudget.app.designsystem.generated.BBIcon
import io.buddybudget.app.designsystem.generated.BBRadius
import io.buddybudget.app.designsystem.generated.BBSpacing
import io.buddybudget.app.designsystem.generated.BBTextStyle
import io.buddybudget.app.tr
import io.buddybudget.core.data.InstrumentType
import io.buddybudget.core.data.InvestmentsView
import io.buddybudget.core.domain.format.BBFormat
import io.buddybudget.core.domain.format.JSNumber
import io.buddybudget.core.domain.investments.AllocationSuggestion
import io.buddybudget.core.domain.investments.AllocationTargets
import io.buddybudget.core.domain.investments.ExposureKeys
import io.buddybudget.core.domain.investments.InstrumentIcons
import io.buddybudget.core.domain.investments.InvestmentsRules
import io.buddybudget.core.domain.investments.OperationForm
import io.buddybudget.core.domain.investments.OperationType
import io.buddybudget.core.domain.investments.PlainLabels
import io.buddybudget.core.domain.investments.TargetDraft
import io.buddybudget.core.domain.investments.TargetsEditor
import io.buddybudget.core.domain.investments.analysis
import kotlin.math.abs

/** Investimenti › Diversificazione (INV-045…055). iOS: DiversificationTab.swift. */
@Composable
fun DiversificationTab(model: InvestmentsModel) {
    val query = model.state.baseQuery
    InvestmentsGateView(model.gate(query, countsCash = false), model, { model.launch { model.loadView(query) } }) {
        val view = model.views[query] ?: return@InvestmentsGateView
        Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space10)) {
            if (debugShows(0)) CompositionSection(view)
            if (debugShows(1) && view.analysis.exposureRows.isNotEmpty()) ExposureSection(model, view)
            if (debugShows(2)) AllocationSection(model, view)
            if (view.analysis.exposureRows.size >= 2) OverlapSection(view)
        }
    }
}

private fun typeOf(key: String) = InstrumentType.entries.firstOrNull { it.raw == key } ?: InstrumentType.Etf

@Composable
private fun CompositionSection(view: InvestmentsView) {
    val foreign = view.currencyExposure
    val main = view.byCurrency.firstOrNull()?.key ?: view.currency
    val topType = view.byType.firstOrNull()
    PanelSection(tr("Composizione"), BBIcon.ChartPie) {
        Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space8)) {
            CompositionGroup("Per tipo", view.byType, topType?.let {
                tr("Soprattutto {0} ({1}%).", mapOf("0" to tr(InstrumentIcons.typePlural(typeOf(it.key))), "1" to JSNumber.round(it.share * 100).toLong().toString()))
            }, view.currency, { key, _ -> bbSwatch(InstrumentIcons.typeSwatch(typeOf(key))) }) { tr(InstrumentIcons.typePlural(typeOf(it))) }
            CompositionGroup("Per valuta", view.byCurrency, if (view.byCurrency.isEmpty()) null else if (foreign < 0.05)
                tr("Quasi tutto in {0}: il cambio non sposta il valore.", mapOf("0" to main))
            else tr("Il {0}% è in altre valute: il cambio muove il valore anche a mercati fermi.", mapOf("0" to JSNumber.round(foreign * 100).toLong().toString())),
                view.currency, { _, i -> bbSwatch(ExposureKeys.currencyColors[i % ExposureKeys.currencyColors.size]) }) { it }
        }
    }
}

@Composable
private fun CompositionGroup(title: String, slices: List<InvestmentsView.Slice>, insight: String?, currency: String,
    color: @Composable (String, Int) -> androidx.compose.ui.graphics.Color, label: @Composable (String) -> String) {
    val c = BuddyBudgetTheme.colors
    val locale = LocalBBLocale.current
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
        Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
            BBText(tr(title), BBTextStyle.BodyStrong)
            if (insight != null) BBText(insight, BBTextStyle.Body, color = c.mutedForeground)
        }
        if (slices.isEmpty()) {
            BBText(tr("Nessun valore da mostrare."), BBTextStyle.Body, color = c.mutedForeground)
        } else {
            StackedBar(slices.mapIndexed { i, s -> color(s.key, i) to s.share }, height = 12.dp)
            Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space1_5)) {
                slices.forEachIndexed { i, slice ->
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
                        Box(Modifier.size(10.dp).background(color(slice.key, i), CircleShape))
                        BBText(label(slice.key), BBTextStyle.Body, Modifier.weight(1f))
                        AmountText(slice.value, currency, maximumFractionDigits = 0, style = BBTextStyle.Body.style.copy(color = c.mutedForeground))
                        BBText(ExposureKeys.share(slice.share, locale), style = BBTextStyle.BodyStrong.style.copy(fontFeatureSettings = "tnum",
                            textAlign = androidx.compose.ui.text.style.TextAlign.End), modifier = Modifier.width(52.dp))
                    }
                }
            }
        }
    }
}

@Composable
private fun ExposureSection(model: InvestmentsModel, view: InvestmentsView) {
    val c = BuddyBudgetTheme.colors
    val analysis = view.analysis
    val worst = minOf(analysis.areas.classifiedShare, analysis.sectors.classifiedShare)
    var editing by remember { mutableStateOf<InvestmentsView.ExposureRow?>(null) }
    var showAllSources by remember { mutableStateOf(false) }
    PanelSection(tr("Diversificazione"), BBIcon.Globe, color = c.swatchBlue, description = tr("Dove investi, guardando dentro ETF e fondi")) {
        Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space6)) {
            ExposureRows("Aree geografiche", analysis.areaInsight, analysis.areas.slices, view.currency, { ExposureKeys.areaLabels[it] ?: it },
                { ExposureKeys.areaColors[it] ?: "slate" }, null)
            ExposureRows("Settori", analysis.sectorInsight, analysis.sectors.slices, view.currency, { ExposureKeys.sectorLabels[it] ?: it },
                { ExposureKeys.sectorColors[it] ?: "slate" }) { ExposureKeys.sectorIcons[it]?.let { k -> BBIcon.forKey(k) } }
            if (worst < ExposureKeys.COVERAGE_THRESHOLD) {
                BBText(tr("Il {0}% del valore non è classificato: puoi correggerlo da \"Da dove vengono i dati\".", mapOf("0" to JSNumber.round((1 - worst) * 100).toLong().toString())),
                    BBTextStyle.Body, color = c.mutedForeground)
            }
            InvestmentsDisclosure(tr("Da dove vengono i dati")) {
                val rows = analysis.exposureRows
                val visible = if (showAllSources) rows else rows.take(5)
                Column(Modifier.border(1.dp, c.border, RoundedCornerShape(BBRadius.lg))) {
                    visible.forEachIndexed { i, row ->
                        Row(Modifier.padding(horizontal = BBSpacing.space3, vertical = BBSpacing.space2), verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
                            InstrumentIconView(row.instrument, size = 28.dp)
                            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                                val title = buildAnnotatedString {
                                    withStyle(SpanStyle(color = c.foreground)) { append(row.instrument.name) }
                                    withStyle(SpanStyle(color = c.mutedForeground)) { append(" · ${InvestmentsRules.percent(row.share)}") }
                                }
                                Text(title, style = BBTextStyle.Body.style, maxLines = 1)
                                BBText("${tr("Area:")} ${tr(ExposureKeys.sourceLabels[row.exposure?.areaSource ?: "nessuno"] ?: "")}", BBTextStyle.Caption, color = c.mutedForeground)
                                BBText("${tr("Settore:")} ${tr(ExposureKeys.sourceLabels[row.exposure?.sectorSource ?: "nessuno"] ?: "")}", BBTextStyle.Caption, color = c.mutedForeground)
                            }
                            BBButton(tr("Correggi"), { editing = row }, variant = BBButtonVariant.Ghost, size = BBButtonSize.Sm)
                        }
                    }
                }
                if (rows.size > 5) BBButton(if (showAllSources) tr("Mostra meno") else tr("Mostra tutte ({0})", mapOf("0" to rows.size.toString())),
                    { showAllSources = !showAllSources }, variant = BBButtonVariant.Ghost, size = BBButtonSize.Sm)
                BBText(tr("Per gli ETF Yahoo dà solo i settori: le aree degli indici più diffusi sono una stima indicativa, le altre puoi inserirle tu."),
                    BBTextStyle.Caption, color = c.mutedForeground)
            }
        }
    }
    val row = editing
    FormDialog(row != null, { editing = null }) { if (row != null) BreakdownDialog(model, row) { editing = null } }
}

@Composable
private fun ExposureRows(title: String, insight: String?, slices: List<InvestmentsView.Slice>, currency: String, label: (String) -> String,
    colorKey: (String) -> String, icon: ((String) -> BBIcon?)?) {
    val c = BuddyBudgetTheme.colors
    val locale = LocalBBLocale.current
    var showAll by remember { mutableStateOf(false) }
    val visible = if (showAll) slices else slices.take(ExposureKeys.VISIBLE_ROWS)
    val maxShare = maxOf(slices.maxOfOrNull { it.share } ?: 0.01, 0.01)
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
        Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
            BBText(tr(title), BBTextStyle.BodyStrong)
            if (insight != null) BBText(insight, BBTextStyle.Body, color = c.mutedForeground)
        }
        Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space2_5)) {
            for (slice in visible) {
                val color = bbSwatch(colorKey(slice.key))
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
                    val i = icon?.invoke(slice.key)
                    if (i != null) {
                        Box(Modifier.size(32.dp).background(color.copy(alpha = 0.16f), RoundedCornerShape(BBRadius.lg)), contentAlignment = Alignment.Center) {
                            BBIconView(i, size = 16.dp, color = color)
                        }
                    } else {
                        Box(Modifier.size(10.dp).background(color, CircleShape))
                    }
                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(BBSpacing.space1)) {
                        Row {
                            BBText(tr(label(slice.key)), BBTextStyle.Body, Modifier.weight(1f))
                            BBText(ExposureKeys.share(slice.share, locale), style = BBTextStyle.BodyStrong.style.copy(fontFeatureSettings = "tnum"))
                        }
                        FillBar(slice.share / maxShare, color)
                        AmountText(slice.value, currency, maximumFractionDigits = 0, style = BBTextStyle.Caption.style.copy(color = c.mutedForeground))
                    }
                }
            }
        }
        if (slices.size > ExposureKeys.VISIBLE_ROWS) BBButton(if (showAll) tr("Mostra meno") else tr("Mostra tutti ({0})", mapOf("0" to slices.size.toString())),
            { showAll = !showAll }, variant = BBButtonVariant.Ghost, size = BBButtonSize.Sm)
    }
}

private val sectorKeys = listOf("tecnologia", "finanza", "salute", "industria", "consumi_ciclici", "consumi_difensivi", "comunicazioni", "energia", "materiali",
    "servizi_pubblici", "immobiliare", "obbligazioni", "liquidita", "materie_prime", "crypto", "altro")
private val areaKeys = listOf("nord_america", "europa", "italia", "giappone", "pacifico", "emergenti", "nessuna")

/** «Correggi» (INV-048). */
@Composable
private fun BreakdownDialog(model: InvestmentsModel, row: InvestmentsView.ExposureRow, onClose: () -> Unit) {
    val c = BuddyBudgetTheme.colors
    val locale = LocalBBLocale.current
    var dimension by remember { mutableStateOf("areas") }
    val values = remember { mutableStateMapOf<String, Map<String, String>>() }
    val reset = remember { mutableStateListOf<String>() }
    var saving by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    fun initial(dim: String): Map<String, String> {
        val source = if (dim == "areas") (row.manual?.areas ?: row.exposure?.areas) else (row.manual?.sectors ?: row.exposure?.sectors)
        return (source ?: emptyMap()).filter { it.key != "non_classificato" && it.value > 0 }.mapValues { OperationForm.numberText(Math.rint(it.value * 1000) / 10) }
    }
    fun current(dim: String) = values[dim] ?: initial(dim)
    fun parsed(dim: String) = current(dim).mapNotNull { (k, v) -> BBFormat.parseAmount(v)?.takeIf { it > 0 }?.let { k to it } }.toMap()
    val keys = if (dimension == "areas") areaKeys else sectorKeys
    val labels = if (dimension == "areas") ExposureKeys.areaLabels else ExposureKeys.sectorLabels
    val total = parsed(dimension).values.sum()
    val over = total > 100.01
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space5)) {
        FormDialogHeader(BBIcon.PencilLine, tr("Correggi") + " · " + row.instrument.name,
            tr("Metti le percentuali che trovi nella scheda dell'emittente (KID o sito del fondo). Quello che manca a 100% resta “non classificato”. La correzione vale solo per te."))
        SegmentedControl(listOf("areas" to tr("Area geografica"), "sectors" to tr("Settore")), dimension, { dimension = it },
            accessibilityLabel = tr("Cosa correggere"), stretch = true)
        if (dimension in reset) {
            BBText(tr("Tornerà ai dati automatici quando salvi."), BBTextStyle.Body, color = c.mutedForeground)
        } else {
            Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
                for (key in keys) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
                        BBText(tr(labels[key] ?: key), BBTextStyle.Body, Modifier.weight(1f))
                        val a11y = tr("{0} in percentuale", mapOf("0" to tr(labels[key] ?: key)))
                        BBTextField(current(dimension)[key] ?: "", { v -> values[dimension] = current(dimension) + (key to v) },
                            Modifier.width(88.dp).semantics { contentDescription = a11y }, placeholder = "0", keyboard = BBKeyboard.Amount)
                        BBText("%", BBTextStyle.Body, color = c.mutedForeground)
                    }
                }
            }
            BBText("${tr("Totale")} ${BBFormat.formatNumber(total, locale, maximumFractionDigits = 1)}%" +
                if (total < 100) tr(" · non classificato {0}%", mapOf("0" to BBFormat.formatNumber(100 - total, locale, maximumFractionDigits = 1))) else "",
                BBTextStyle.BodyStrong, color = if (over) c.destructive else c.foreground)
        }
        error?.let { BBErrorBox(it) }
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
            BBButton(tr("Torna all'automatico"), { if (dimension !in reset) reset += dimension; values[dimension] = emptyMap() }, variant = BBButtonVariant.Ghost)
            Spacer(Modifier.weight(1f))
            BBButton(tr("Annulla"), onClose, variant = BBButtonVariant.Outline)
            BBButton(tr(if (saving) "Salvo…" else "Salva"), {
                fun dim(d: String): Map<String, Double>? {
                    if (d in reset) return null
                    if (values[d] == null) return if (d == "areas") row.manual?.areas else row.manual?.sectors
                    return parsed(d).mapValues { it.value / 100 }.ifEmpty { null }
                }
                saving = true
                model.launch {
                    error = model.saveBreakdown(row.instrument.id, dim("sectors"), dim("areas"))
                    saving = false
                    if (error == null) onClose()
                }
            }, isLoading = saving, enabled = !over)
        }
    }
}

// ---------------------------------------------------------------- Allocation

@Composable
private fun AllocationSection(model: InvestmentsModel, view: InvestmentsView) {
    val allocation = view.analysis.allocation
    var open by remember { mutableStateOf(false) }
    var editing by remember { mutableStateOf(false) }
    val outOfLine = allocation?.rows?.filter { it.status != "in_linea" } ?: emptyList()
    val description = when {
        allocation == null -> tr("Decidi quanto deve pesare ogni strumento: ti diciamo dove mettere il prossimo versamento.")
        outOfLine.isEmpty() -> tr("Tutto entro ±{0} punti dall'obiettivo.", mapOf("0" to "5"))
        else -> tr("{0} fuori di più di {1} punti.", mapOf("0" to if (outOfLine.size == 1) tr("Uno strumento è") else tr("{0} strumenti sono", mapOf("0" to outOfLine.size.toString())), "1" to "5"))
    }
    PanelSection(tr("Allocazione obiettivo"), BBIcon.Target, color = BuddyBudgetTheme.colors.swatchEmerald, description = description, action = {
        if (allocation != null) Row(horizontalArrangement = Arrangement.spacedBy(BBSpacing.space1)) {
            BBButton(tr("Modifica"), { editing = true }, variant = BBButtonVariant.Ghost, size = BBButtonSize.Sm)
            BBButton(tr(if (open) "Chiudi" else "Dettaglio"), { open = !open }, icon = if (open) BBIcon.ChevronUp else BBIcon.ChevronDown, iconTrailing = true,
                variant = BBButtonVariant.Outline, size = BBButtonSize.Sm)
        }
    }) {
        if (allocation != null) {
            if (open) AllocationDetail(model, view, allocation)
        } else {
            BBButton(tr("Imposta un obiettivo"), { editing = true }, variant = BBButtonVariant.Outline)
        }
    }
    FormDialog(editing, { editing = false }) { TargetsDialog(model, view) { editing = false } }
}

@Composable
private fun AllocationDetail(model: InvestmentsModel, view: InvestmentsView, allocation: InvestmentsView.Allocation) {
    val c = BuddyBudgetTheme.colors
    val locale = LocalBBLocale.current
    var amountText by remember { mutableStateOf("100") }
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space5)) {
        Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
            for (row in allocation.rows) {
                val (source, values) = ExposureKeys.driftText(row)
                Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space1_5)) {
                    BBText(view.instrument(row.instrumentId)?.name ?: "—", BBTextStyle.Body, maxLines = 1)
                    val line = buildAnnotatedString {
                        withStyle(SpanStyle(color = c.mutedForeground)) {
                            append(InvestmentsRules.percent(row.currentWeight) + (if (row.inTarget) tr(" su {0}", mapOf("0" to InvestmentsRules.percent(row.targetWeight))) else "") + " · ")
                        }
                        withStyle(SpanStyle(color = if (row.status == "in_linea") c.mutedForeground else c.foreground,
                            fontWeight = if (row.status == "in_linea") FontWeight.Normal else FontWeight.Medium)) { append(tr(source, values)) }
                    }
                    Text(line, style = BBTextStyle.Caption.style.copy(fontFeatureSettings = "tnum"))
                    AllocationBar(row)
                }
            }
        }
        if (allocation.unpricedIds.isNotEmpty()) {
            BBText("${tr("Esclusi perché senza prezzo:")} ${allocation.unpricedIds.joinToString(", ") { view.instrument(it)?.name ?: "—" }}.", BBTextStyle.Caption,
                color = c.mutedForeground)
        }
        val amount = BBFormat.parseAmount(amountText) ?: 0.0
        val suggestions = AllocationTargets.suggestContribution(allocation.analysis(), amount)
        Column(Modifier.fillMaxWidth().background(c.muted.copy(alpha = 0.5f), RoundedCornerShape(BBRadius.lg)).padding(BBSpacing.space3),
            verticalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
                BBText(tr("Se versi"), BBTextStyle.BodyStrong)
                BBTextField(amountText, { amountText = it }, Modifier.width(112.dp), keyboard = BBKeyboard.Amount)
                BBText("${view.currency}${tr(", compra:")}", BBTextStyle.Body, color = c.mutedForeground)
            }
            if (suggestions.isEmpty()) {
                BBText(tr("Inserisci un importo per vedere dove metterlo."), BBTextStyle.Body, color = c.mutedForeground)
            } else {
                for (s in suggestions) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
                        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                            val t = buildAnnotatedString {
                                withStyle(SpanStyle(fontWeight = FontWeight.Medium)) { append(BBFormat.formatCurrency(s.amount, view.currency, locale, maximumFractionDigits = 0)) }
                                append(" ${tr("di")} ${view.instrument(s.instrumentId)?.name ?: "—"}")
                            }
                            Text(t, style = BBTextStyle.Body.style.copy(color = c.foreground), maxLines = 1)
                            BBText("${tr("arriva al")} ${InvestmentsRules.percent(s.weightAfter)} ${tr("(obiettivo")} ${InvestmentsRules.percent(s.targetWeight)})",
                                BBTextStyle.Caption, color = c.mutedForeground)
                        }
                        BBButton(tr("Registra"), { register(model, view, s) }, variant = BBButtonVariant.Outline, size = BBButtonSize.Sm)
                    }
                }
            }
            BBText(tr("Solo acquisti: compra per primo ciò che è più sotto obiettivo, senza vendere niente."), BBTextStyle.Caption, color = c.mutedForeground)
        }
    }
}

/** INV-055. */
private fun register(model: InvestmentsModel, view: InvestmentsView, s: AllocationSuggestion) {
    val price = view.summary.rows.firstOrNull { it.instrument.id == s.instrumentId }?.lastPrice?.close
    val quantity = InvestmentsRules.suggestedQuantity(s.amount, price)
    model.openRegister(OperationForm(OperationType.Acquisto, view.instrument(s.instrumentId), InvestmentsModel.todayKey(),
        quantity = quantity?.let { OperationForm.numberText(it) } ?: "", price = price?.let { OperationForm.priceText(it) } ?: ""))
}

@Composable
private fun AllocationBar(row: InvestmentsView.AllocationRowView) {
    val c = BuddyBudgetTheme.colors
    val scale = maxOf(row.currentWeight, row.targetWeight, 0.01)
    val max = minOf(1.0, scale * 1.15)
    val color = when (row.status) {
        "in_linea" -> c.primary
        "sotto" -> c.swatchAmber
        else -> c.swatchViolet
    }
    BoxWithConstraints(Modifier.fillMaxWidth().height(16.dp)) {
        Box(Modifier.fillMaxWidth().height(8.dp).align(Alignment.CenterStart).background(c.muted, CircleShape))
        Box(Modifier.width(maxWidth * (row.currentWeight / max).toFloat().coerceIn(0f, 1f)).height(8.dp).align(Alignment.CenterStart).background(color, CircleShape))
        if (row.inTarget) Box(Modifier.offset(x = maxWidth * (row.targetWeight / max).toFloat() - 1.dp).width(2.dp).height(16.dp).background(c.foreground, RoundedCornerShape(1.dp)))
    }
}

/** «Obiettivo di allocazione» (INV-051/052). */
@Composable
private fun TargetsDialog(model: InvestmentsModel, view: InvestmentsView, onClose: () -> Unit) {
    val c = BuddyBudgetTheme.colors
    val locale = LocalBBLocale.current
    val rows = remember {
        mutableStateListOf<TargetDraft>().apply {
            addAll(TargetsEditor.initial(view.analysis.targets, view.analysis.currentWeights) { view.instrument(it)?.name ?: "—" })
        }
    }
    var saving by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    val missing = TargetsEditor.missing(rows)
    val suggestions = view.heldInstrumentIds.mapNotNull { view.instrument(it) }.filter { i -> rows.none { it.instrumentId == i.id } }
    fun save(targets: List<InvestmentsView.Target>) {
        saving = true
        error = null
        model.launch {
            error = model.saveTargets(targets)
            saving = false
            if (error == null) onClose()
        }
    }
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space5)) {
        FormDialogHeader(BBIcon.Target, tr("Obiettivo di allocazione"),
            tr("Quanto vuoi che pesi ogni strumento sul totale. Serve per vedere quanto ti sei allontanato e dove mettere il prossimo versamento."), color = c.swatchEmerald)
        Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
            rows.forEachIndexed { i, row ->
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
                    BBText(row.name, BBTextStyle.Body, Modifier.weight(1f), maxLines = 2)
                    val a11y = tr("Peso obiettivo di {0} in percentuale", mapOf("0" to row.name))
                    BBTextField(row.percent, { rows[i] = row.copy(percent = it) }, Modifier.width(80.dp).semantics { contentDescription = a11y }, keyboard = BBKeyboard.Amount)
                    BBText("%", BBTextStyle.Body, color = c.mutedForeground)
                    BBIconButton(BBIcon.X, tr("Togli {0}", mapOf("0" to row.name))) { rows.removeAt(i) }
                }
            }
        }
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
            BBText("${tr("Totale")} ${BBFormat.formatNumber(TargetsEditor.total(rows), locale, maximumFractionDigits = 1)}%" + when {
                abs(missing) < 0.05 -> ""
                missing > 0 -> tr(" · mancano {0}", mapOf("0" to BBFormat.formatNumber(missing, locale, maximumFractionDigits = 1) + "%"))
                else -> tr(" · {0} di troppo", mapOf("0" to BBFormat.formatNumber(-missing, locale, maximumFractionDigits = 1) + "%"))
            }, BBTextStyle.BodyStrong, Modifier.weight(1f), color = if (abs(missing) < 0.05) c.foreground else c.destructive)
            if (abs(missing) >= 0.05 && rows.isNotEmpty()) {
                BBButton("${tr("Aggiungi")} ${tr("la differenza a")} ${tr("l'ultimo")}", {
                    val next = TargetsEditor.fillLast(rows.toList())
                    rows.clear(); rows.addAll(next)
                }, variant = BBButtonVariant.Link, size = BBButtonSize.Sm)
            }
        }
        if (rows.size < InvestmentsRules.MAX_TARGETS) {
            InstrumentPickerField(null, suggestions, model.currency, "Aggiungi uno strumento") { chosen ->
                if (rows.none { it.instrumentId == chosen.id }) rows += TargetDraft(chosen.id, chosen.name, "")
            }
        }
        error?.let { BBErrorBox(it) }
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
            if (view.analysis.targets.isNotEmpty()) BBButton(tr("Togli l'obiettivo"), { save(emptyList()) }, variant = BBButtonVariant.Ghost)
            Spacer(Modifier.weight(1f))
            BBButton(tr("Annulla"), onClose, variant = BBButtonVariant.Outline)
            BBButton(tr(if (saving) "Salvo…" else "Salva"), { save(TargetsEditor.weights(rows.toList())) }, isLoading = saving, enabled = TargetsEditor.canSave(rows.toList()))
        }
    }
}

// ---------------------------------------------------------------- Overlaps

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun OverlapSection(view: InvestmentsView) {
    val c = BuddyBudgetTheme.colors
    val locale = LocalBBLocale.current
    val hide = LocalHideAmounts.current
    val analysis = view.analysis
    var showAllPairs by remember { mutableStateOf(false) }
    val strings = io.buddybudget.app.generated.LocalStrings.current
    val name = { id: String -> view.instrument(id)?.name ?: "—" }
    PanelSection(tr("Sovrapposizioni"), BBIcon.Layers, color = c.swatchViolet, description = tr("Quando due posizioni sono, in pratica, la stessa scommessa")) {
        Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space8)) {
            Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
                Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    BBText(tr("Investimenti doppi"), BBTextStyle.BodyStrong)
                    BBText(tr("Fondi che contengono in buona parte le stesse aziende."), BBTextStyle.Body, color = c.mutedForeground)
                }
                if (analysis.overlaps.isEmpty() && analysis.stocksInFunds.isEmpty()) {
                    BBText(tr("Nessuna sovrapposizione rilevante tra le tue posizioni."), BBTextStyle.Body, color = c.mutedForeground)
                }
                for (o in analysis.overlaps) {
                    val (label, _) = PlainLabels.overlap(o.share)
                    Column(Modifier.fillMaxWidth().border(1.dp, c.border, RoundedCornerShape(BBRadius.xl)).padding(BBSpacing.space3),
                        verticalArrangement = Arrangement.spacedBy(2.dp)) {
                        val t = buildAnnotatedString {
                            withStyle(SpanStyle(fontWeight = FontWeight.Medium, color = c.foreground)) { append(tr(label)) }
                            withStyle(SpanStyle(color = c.mutedForeground)) { append(" · ${JSNumber.round(o.share * 100).toLong()}${tr("% in comune")}") }
                        }
                        Text(t, style = BBTextStyle.Body.style)
                        BBText("${name(o.aId)} + ${name(o.bId)}", BBTextStyle.Body, color = c.mutedForeground)
                        BBText(tr(PlainLabels.overlapMethodNote(o.method)), BBTextStyle.Caption, color = c.mutedForeground)
                    }
                }
                for (item in analysis.stocksInFunds) {
                    val money = { v: Double -> BBFormat.formatCurrency(v, view.currency, locale, maximumFractionDigits = 0, masked = hide) }
                    val direct = if (item.totalValue > 0) item.directValue / item.totalValue else 1.0
                    Column(Modifier.fillMaxWidth().border(1.dp, c.border, RoundedCornerShape(BBRadius.xl)).padding(BBSpacing.space3),
                        verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
                        val t = buildAnnotatedString {
                            withStyle(SpanStyle(fontWeight = FontWeight.Medium)) { append(name(item.stockId)) }
                            append(" ${tr("pesa in tutto")} ")
                            withStyle(SpanStyle(fontWeight = FontWeight.Medium)) { append(money(item.totalValue)) }
                            append("${tr(", perché la hai anche dentro")} ${if (item.funds.size == 1) tr("un ETF") else tr("{0} ETF", mapOf("0" to item.funds.size.toString()))}.")
                        }
                        Text(t, style = BBTextStyle.Body.style.copy(color = c.foreground))
                        StackedBar(listOf(c.swatchBlue to direct, c.swatchAmber to (1 - direct)))
                        BBText("${money(item.directValue)} ${tr("come azioni ·")} ${money(item.totalValue - item.directValue)} ${tr("dentro gli ETF (")}" +
                            item.funds.joinToString(", ") {
                                strings.lookup("{0}% di {1}", mapOf("0" to BBFormat.formatNumber(it.weightInFund * 100, locale, minimumFractionDigits = 1, maximumFractionDigits = 1), "1" to name(it.fundId)))
                            } + ")", BBTextStyle.Caption, color = c.mutedForeground)
                    }
                }
            }
            if (analysis.correlations != null) {
                val average = PlainLabels.averageCorrelation(analysis.correlationPairs)
                Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
                    Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                        BBText(tr("Quanto si muovono insieme"), BBTextStyle.BodyStrong)
                        BBText(average?.let { tr("In media {0}: più è vicino a 0, più le posizioni si compensano quando il mercato scende.", mapOf("0" to PlainLabels.decimal2(it, locale))) }
                            ?: tr("Servono almeno 20 giorni di prezzi in comune per confrontare due posizioni."), BBTextStyle.Body, color = c.mutedForeground)
                    }
                    val families = analysis.correlationFamilies
                    if (average != null && families != null) {
                        families.families.forEachIndexed { index, family ->
                            FamilyBox(buildAnnotatedString {
                                withStyle(SpanStyle(fontWeight = FontWeight.Medium)) { append("${tr("Famiglia")} ${index + 1}${tr(": si muovono quasi insieme")}") }
                                withStyle(SpanStyle(color = c.mutedForeground)) { append(" ${tr("· contano come una sola scommessa")}") }
                            }, family, view, true)
                        }
                        if (families.independent.isNotEmpty()) {
                            FamilyBox(buildAnnotatedString {
                                withStyle(SpanStyle(fontWeight = FontWeight.Medium)) { append(tr(if (families.families.isEmpty()) "Nessuna coppia si muove insieme" else "Vanno per conto loro")) }
                                withStyle(SpanStyle(color = c.mutedForeground)) { append(" ${tr("· diversificano il resto")}") }
                            }, families.independent, view, false)
                        }
                        InvestmentsDisclosure(tr("Tutte le coppie")) {
                            val pairs = analysis.correlationPairs
                            for (pair in if (showAllPairs) pairs else pairs.take(4)) {
                                val (label, severity) = PlainLabels.correlation(pair.value)
                                Column(Modifier.fillMaxWidth().border(1.dp, c.border, RoundedCornerShape(BBRadius.xl)).padding(BBSpacing.space3),
                                    verticalArrangement = Arrangement.spacedBy(BBSpacing.space1_5)) {
                                    BBText("${name(pair.aId)} ${tr("e")} ${name(pair.bId)}", BBTextStyle.Body)
                                    BBText("${tr(label)} (${PlainLabels.decimal2(pair.value, locale)})", BBTextStyle.Caption, color = c.mutedForeground)
                                    FillBar(maxOf(0.04, maxOf(0.0, pair.value)), when (severity) { "alta" -> c.neg; "media" -> c.swatchAmber; else -> c.pos })
                                }
                            }
                            if (pairs.size > 4) BBButton(if (showAllPairs) tr("Mostra meno") else tr("Mostra tutte le coppie ({0})", mapOf("0" to pairs.size.toString())),
                                { showAllPairs = !showAllPairs }, variant = BBButtonVariant.Ghost, size = BBButtonSize.Sm)
                        }
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun FamilyBox(title: androidx.compose.ui.text.AnnotatedString, ids: List<String>, view: InvestmentsView, highlight: Boolean) {
    val c = BuddyBudgetTheme.colors
    val shape = RoundedCornerShape(BBRadius.xl)
    Column(Modifier.fillMaxWidth().background(if (highlight) c.swatchAmber.copy(alpha = 0.08f) else androidx.compose.ui.graphics.Color.Transparent, shape)
        .border(1.dp, if (highlight) c.swatchAmber.copy(alpha = 0.5f) else c.border, shape).padding(BBSpacing.space3),
        verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
        Text(title, style = BBTextStyle.Body.style.copy(color = c.foreground))
        FlowRow(horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2), verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
            for (id in ids) {
                val instrument = view.instrument(id)
                Row(Modifier.background(c.background, RoundedCornerShape(50)).border(1.dp, c.border, RoundedCornerShape(50))
                    .padding(start = 6.dp, end = BBSpacing.space3, top = 4.dp, bottom = 4.dp),
                    verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space1_5)) {
                    if (instrument != null) InstrumentIconView(instrument, size = 20.dp)
                    BBText(instrument?.name ?: "—", BBTextStyle.Body, maxLines = 1)
                }
            }
        }
    }
}
