package io.buddybudget.app.features.investments

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import io.buddybudget.app.AppEnvironment
import io.buddybudget.app.designsystem.BuddyBudgetTheme
import io.buddybudget.app.designsystem.components.BBButton
import io.buddybudget.app.designsystem.components.BBButtonSize
import io.buddybudget.app.designsystem.components.BBIconView
import io.buddybudget.app.designsystem.components.BBKeyboard
import io.buddybudget.app.designsystem.components.BBSelect
import io.buddybudget.app.designsystem.components.BBText
import io.buddybudget.app.designsystem.components.BBTextField
import io.buddybudget.app.designsystem.components.FormDialog
import io.buddybudget.app.designsystem.components.bbDisabled
import io.buddybudget.app.designsystem.components.bbPressable
import io.buddybudget.app.designsystem.components.bbSwatch
import io.buddybudget.app.designsystem.generated.BBIcon
import io.buddybudget.app.designsystem.generated.BBLayout
import io.buddybudget.app.designsystem.generated.BBRadius
import io.buddybudget.app.designsystem.generated.BBSpacing
import io.buddybudget.app.designsystem.generated.BBTextStyle
import io.buddybudget.app.LocalEnv
import io.buddybudget.app.tr
import io.buddybudget.core.data.ApiError
import io.buddybudget.core.data.Instrument
import io.buddybudget.core.data.InstrumentCreateInput
import io.buddybudget.core.data.InstrumentSearchResult
import io.buddybudget.core.data.InstrumentType
import io.buddybudget.core.domain.investments.InstrumentIcons
import io.buddybudget.core.domain.investments.InstrumentSearch
import io.buddybudget.core.domain.investments.SearchResultGroup
import kotlinx.coroutines.Job
import kotlinx.coroutines.MainScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/** Search state of the instrument picker (SEC-002…009): 300 ms debounce, ≥ 2 characters, create on choose. */
class InstrumentSearchModel(private val env: AppEnvironment) {
    var query by mutableStateOf("")
        private set
    var result by mutableStateOf<InstrumentSearchResult?>(null)
        private set
    var searching by mutableStateOf(false)
        private set
    var creating by mutableStateOf(false)
        private set
    var error by mutableStateOf<String?>(null)
    var filter by mutableStateOf<InstrumentType?>(null)
    private val scope = MainScope()
    private var job: Job? = null

    fun updateQuery(next: String) {
        query = next
        job?.cancel()
        val q = next.trim()
        if (!InstrumentSearch.isSearchable(q)) {
            result = null
            searching = false
            return
        }
        searching = true
        job = scope.launch {
            delay(300)
            val found = runCatching { env.instruments.search(q) }.getOrNull()
            result = found ?: InstrumentSearchResult(marketUnavailable = true)
            searching = false
        }
    }

    fun create(input: InstrumentCreateInput, deferHistory: Boolean, onCreated: (Instrument) -> Unit) {
        creating = true
        error = null
        scope.launch {
            try {
                onCreated(env.instruments.create(input, deferHistory))
            } catch (e: Exception) {
                error = (e as? ApiError.Http)?.body?.message ?: env.session.strings().lookup("Qualcosa è andato storto. Riprova.")
            }
            creating = false
        }
    }
}

/** Full-screen search content. Same structure as `InstrumentSearchContent` on iOS. */
@Composable
fun InstrumentSearchContent(env: AppEnvironment, suggestions: List<Instrument>, currency: String, deferHistory: Boolean = false, onChoose: (Instrument) -> Unit) {
    val model = remember { InstrumentSearchModel(env) }
    val c = BuddyBudgetTheme.colors
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
        BBTextField(model.query, { model.updateQuery(it) }, placeholder = tr("VWCE, Apple, IE00BK5BQT80…"), autofocus = true)
        if (!InstrumentSearch.isSearchable(model.query)) {
            if (suggestions.isNotEmpty()) {
                SectionTitle("I tuoi strumenti")
                suggestions.forEach { KnownRow(it) { onChoose(it) } }
            }
            BBText(tr(if (suggestions.isEmpty()) "Scrivi almeno 2 caratteri." else "Oppure cercane un altro: scrivi almeno 2 caratteri."), BBTextStyle.Body,
                color = c.mutedForeground)
        } else {
            if (model.searching && model.result == null) BBText(tr("Ricerca…"), BBTextStyle.Body, color = c.mutedForeground)
            model.result?.let { result -> Results(model, result, suggestions, currency, deferHistory, onChoose) }
            SectionTitle("Non lo trovi?")
            ManualInstrumentForm(model.result?.isin, currency, model.creating) { input -> model.create(input, deferHistory, onChoose) }
        }
        model.error?.let { BBText(it, BBTextStyle.Body, color = c.destructive) }
    }
}

@Composable
private fun SectionTitle(source: String) {
    BBText(tr(source).uppercase(), style = BBTextStyle.Caption.style.copy(fontWeight = FontWeight.Medium), color = BuddyBudgetTheme.colors.mutedForeground,
        modifier = Modifier.padding(top = BBSpacing.space2))
}

@Composable
private fun Results(model: InstrumentSearchModel, result: InstrumentSearchResult, suggestions: List<Instrument>, currency: String, deferHistory: Boolean,
    onChoose: (Instrument) -> Unit) {
    val c = BuddyBudgetTheme.colors
    val known = InstrumentSearch.rankKnown(result.known, suggestions)
    val groups = InstrumentSearch.group(result, model.query)
    if (known.isNotEmpty()) {
        SectionTitle("Già aggiunti")
        known.forEach { KnownRow(it) { onChoose(it) } }
    }
    val active = model.filter?.takeIf { f -> groups.any { it.type == f } }
    if (groups.size > 1) {
        Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(BBSpacing.space1_5)) {
            FilterChip(null, active) { model.filter = null }
            groups.forEach { g -> FilterChip(g.type, active) { model.filter = g.type } }
        }
    }
    for (group in groups.filter { active == null || it.type == active }) GroupBlock(model, group, result, currency, deferHistory, onChoose)
    if (result.marketUnavailable) {
        BBText(tr("La fonte di ETF, azioni e fondi non risponde in questo momento: riprova tra qualche minuto, oppure aggiungilo qui sotto."),
            BBTextStyle.Body, color = c.mutedForeground)
    } else if (known.isEmpty() && groups.isEmpty()) {
        BBText(tr("Nessun risultato dalle fonti di mercato."), BBTextStyle.Body, color = c.mutedForeground)
    }
}

@Composable
private fun GroupBlock(model: InstrumentSearchModel, group: SearchResultGroup, result: InstrumentSearchResult, currency: String, deferHistory: Boolean,
    onChoose: (Instrument) -> Unit) {
    val color = bbSwatch(InstrumentIcons.typeSwatch(group.type))
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space1)) {
        Row(Modifier.padding(top = BBSpacing.space2), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
            Box(Modifier.size(8.dp).background(color, CircleShape))
            BBText("${tr(InstrumentIcons.typePlural(group.type)).uppercase()} (${group.items.size})", style = BBTextStyle.Caption.style.copy(fontWeight = FontWeight.SemiBold))
        }
        Row {
            Box(Modifier.width(2.dp).heightIn(min = 1.dp).background(color))
            Column(Modifier.padding(start = BBSpacing.space1)) {
                for (item in group.items) {
                    ResultButton(item.title, item.detail(currency, tr("in")), Instrument(id = "", name = item.title, type = item.type.raw), enabled = !model.creating) {
                        model.create(item.createInput(currency, result.isin), deferHistory, onChoose)
                    }
                }
            }
        }
    }
}

@Composable
private fun FilterChip(type: InstrumentType?, active: InstrumentType?, onClick: () -> Unit) {
    val c = BuddyBudgetTheme.colors
    val selected = active == type
    val shape = RoundedCornerShape(50)
    Row(
        Modifier.height(28.dp).background(if (selected) c.foreground else Color.Transparent, shape).border(1.dp, if (selected) c.foreground else c.input, shape)
            .bbPressable(onClick, shape, translate = false).padding(horizontal = BBSpacing.space2_5),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space1_5),
    ) {
        if (type != null) Box(Modifier.size(8.dp).background(bbSwatch(InstrumentIcons.typeSwatch(type)), CircleShape))
        BBText(type?.let { tr(InstrumentIcons.typePlural(it)) } ?: tr("Tutti"), BBTextStyle.Caption, color = if (selected) c.background else c.foreground, maxLines = 1)
    }
}

@Composable
private fun KnownRow(instrument: Instrument, onClick: () -> Unit) {
    ResultButton(instrument.name, listOfNotNull(instrument.currency, instrument.isin).joinToString(" · "), instrument,
        tag = InstrumentIcons.typeLabel(instrument.kind), onClick = onClick)
}

@Composable
private fun ResultButton(title: String, detail: String, icon: Instrument, tag: String? = null, enabled: Boolean = true, onClick: () -> Unit) {
    val c = BuddyBudgetTheme.colors
    Row(
        Modifier.fillMaxWidth().heightIn(min = BBLayout.minTouchTarget).bbDisabled(!enabled)
            .bbPressable(if (enabled) onClick else null, RoundedCornerShape(BBRadius.md), pressedBackground = c.muted, translate = false)
            .padding(horizontal = BBSpacing.space2),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2_5),
    ) {
        InstrumentIconView(icon, size = 28.dp)
        Column(Modifier.weight(1f)) {
            BBText(title, BBTextStyle.Body, maxLines = 1)
            BBText(detail, BBTextStyle.Caption, color = c.mutedForeground, maxLines = 1)
        }
        if (tag != null) {
            Row(Modifier.height(22.dp).background(c.muted, RoundedCornerShape(50)).padding(horizontal = BBSpacing.space2),
                verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space1_5)) {
                Box(Modifier.size(8.dp).background(bbSwatch(InstrumentIcons.typeSwatch(icon.kind)), CircleShape))
                BBText(tr(tag), BBTextStyle.Caption, maxLines = 1)
            }
        }
    }
}

/** «Non lo trovi?» (SEC-009). */
@Composable
fun ManualInstrumentForm(isin: String?, currency: String, pending: Boolean, onCreate: (InstrumentCreateInput) -> Unit) {
    var name by remember { mutableStateOf("") }
    var type by remember { mutableStateOf<InstrumentType?>(null) }
    var code by remember { mutableStateOf<String?>(null) }
    val kind = type ?: InstrumentSearch.manualDefaultType(isin)
    val currencyText = code ?: currency
    val input = InstrumentSearch.manualInput(name, kind, currencyText, isin)
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
        BBTextField(name, { name = it }, placeholder = tr("Nome (es. BTP Valore 2029)"))
        Row(horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
            BBSelect(InstrumentType.entries.map { it to tr(InstrumentIcons.typeLabel(it)) }, kind, { type = it }, Modifier.weight(1f), title = tr("Tipo di strumento"))
            BBTextField(currencyText, { code = it.uppercase().take(3) }, Modifier.width(80.dp), keyboard = BBKeyboard.Email)
        }
        BBText(if (isin != null && kind == InstrumentType.Obbligazione) tr("I prezzi arriveranno da Borsa Italiana (ISIN {0}).", mapOf("0" to isin))
        else tr("Strumento visibile solo a te: i prezzi li inserisci a mano."), BBTextStyle.Caption, color = BuddyBudgetTheme.colors.mutedForeground)
        BBButton(tr(if (pending) "Aggiunta…" else "Aggiungi strumento"), { input?.let(onCreate) }, size = BBButtonSize.Sm, enabled = !pending && input != null)
    }
}

/** Picker field of the register form: shows the chosen instrument and opens the search full screen. */
@Composable
fun InstrumentPickerField(
    instrument: Instrument?,
    suggestions: List<Instrument>,
    currency: String,
    placeholder: String = "Cerca per nome, ticker o ISIN",
    enabled: Boolean = true,
    deferHistory: Boolean = false,
    onChange: (Instrument) -> Unit,
) {
    val c = BuddyBudgetTheme.colors
    val env = LocalEnv.current
    var open by remember { mutableStateOf(false) }
    val shape = RoundedCornerShape(BBRadius.lg)
    Row(
        Modifier.fillMaxWidth().height(36.dp).bbDisabled(!enabled)
            .background(if (BuddyBudgetTheme.isDark) c.alphaInput30 else Color.Transparent, shape).border(1.dp, c.input, shape)
            .bbPressable(if (enabled) ({ open = true }) else null, shape, translate = false).padding(horizontal = BBSpacing.space3),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2),
    ) {
        if (instrument != null) InstrumentIconView(instrument, size = 20.dp)
        BBText(instrument?.name ?: tr(placeholder), BBTextStyle.Body, Modifier.weight(1f), color = if (instrument == null) c.mutedForeground else c.foreground, maxLines = 1)
        BBIconView(BBIcon.ChevronDown, color = c.mutedForeground)
    }
    FormDialog(open, { open = false }) {
        Box(Modifier.padding(top = BBSpacing.space8)) {
            InstrumentSearchContent(env, suggestions, currency, deferHistory) { chosen ->
                onChange(chosen)
                open = false
            }
        }
    }
}
