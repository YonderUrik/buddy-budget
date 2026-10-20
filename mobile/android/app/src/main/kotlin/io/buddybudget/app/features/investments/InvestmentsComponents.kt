package io.buddybudget.app.features.investments

import android.graphics.BitmapFactory
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.layout.layout
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import io.buddybudget.app.designsystem.BuddyBudgetTheme
import io.buddybudget.app.designsystem.components.BBButton
import io.buddybudget.app.designsystem.components.BBButtonSize
import io.buddybudget.app.designsystem.components.BBButtonVariant
import io.buddybudget.app.designsystem.components.BBCheckbox
import io.buddybudget.app.designsystem.components.BBDateField
import io.buddybudget.app.designsystem.components.BBIconBadge
import io.buddybudget.app.designsystem.components.BBIconView
import io.buddybudget.app.designsystem.components.BBSeparator
import io.buddybudget.app.designsystem.components.BBSheet
import io.buddybudget.app.designsystem.components.BBSkeleton
import io.buddybudget.app.designsystem.components.BBStateAction
import io.buddybudget.app.designsystem.components.BBStyles
import io.buddybudget.app.designsystem.components.BBText
import io.buddybudget.app.designsystem.components.EmptyState
import io.buddybudget.app.designsystem.components.LoadError
import io.buddybudget.app.designsystem.components.LocalLogoLoader
import io.buddybudget.app.designsystem.components.ScrollableSegmentedControl
import io.buddybudget.app.designsystem.components.SegmentedControl
import io.buddybudget.app.designsystem.components.bbPressable
import io.buddybudget.app.designsystem.components.bbSwatch
import io.buddybudget.app.designsystem.generated.BBIcon
import io.buddybudget.app.designsystem.generated.BBLayout
import io.buddybudget.app.designsystem.generated.BBRadius
import io.buddybudget.app.designsystem.generated.BBSpacing
import io.buddybudget.app.designsystem.generated.BBTextStyle
import io.buddybudget.app.tr
import io.buddybudget.core.data.Instrument
import io.buddybudget.core.data.InvestmentsView
import io.buddybudget.core.domain.investments.ChartRange
import io.buddybudget.core.domain.investments.InstrumentIcons
import io.buddybudget.core.domain.investments.InvestmentsGate
import io.buddybudget.core.domain.investments.InvestmentsPeriod
import io.buddybudget.core.domain.investments.InvestmentsRules
import io.buddybudget.core.domain.investments.InvestmentsTextRun
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

// Building blocks shared by the Investimenti tabs and the security page. iOS: InvestmentsComponents.swift.

/** Web `PanelSection`: tinted icon + title (+ link or trailing control), optional description, then the content. */
@Composable
fun PanelSection(
    title: String,
    icon: BBIcon,
    modifier: Modifier = Modifier,
    color: Color = BuddyBudgetTheme.colors.primary,
    description: String? = null,
    linkLabel: String? = null,
    onLink: (() -> Unit)? = null,
    action: @Composable RowScope.() -> Unit = {},
    content: @Composable ColumnScope.() -> Unit,
) {
    val c = BuddyBudgetTheme.colors
    Column(modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
            BBText(title, Modifier.weight(1f).semantics { heading() }, BBStyles.sectionHeading)
            action()
            if (linkLabel != null && onLink != null) {
                Row(
                    Modifier.offset(x = BBSpacing.space2).heightIn(min = BBLayout.minTouchTarget)
                        .bbPressable(onLink, RoundedCornerShape(BBRadius.lg), pressedBackground = c.muted, translate = false)
                        .padding(horizontal = BBSpacing.space2),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(BBSpacing.space1),
                ) {
                    BBText(linkLabel, style = BBStyles.link, color = c.primary)
                    BBIconView(BBIcon.ArrowRight, color = c.primary)
                }
            }
        }
        if (description != null) BBText(description, BBTextStyle.Body, color = c.mutedForeground)
        content()
    }
}

/** A sentence made of runs. */
@Composable
fun RunsText(runs: List<InvestmentsTextRun>, modifier: Modifier = Modifier, style: TextStyle = BBTextStyle.BodyLarge.style) {
    val c = BuddyBudgetTheme.colors
    val text = buildAnnotatedString {
        for (run in runs) {
            val span = when (run.style) {
                InvestmentsTextRun.Style.Plain -> SpanStyle(color = c.foreground)
                InvestmentsTextRun.Style.Strong -> SpanStyle(color = c.foreground, fontWeight = FontWeight.SemiBold)
                InvestmentsTextRun.Style.Pos -> SpanStyle(color = c.pos, fontWeight = FontWeight.SemiBold)
                InvestmentsTextRun.Style.Neg -> SpanStyle(color = c.neg, fontWeight = FontWeight.SemiBold)
                InvestmentsTextRun.Style.Muted -> SpanStyle(color = c.mutedForeground)
            }
            withStyle(span) { append(run.text) }
        }
    }
    Text(text, modifier.fillMaxWidth(), style = style)
}

/** Instrument tile (web `InstrumentIcon`); stocks and known fund issuers try the server logo. */
@Composable
fun InstrumentIconView(instrument: Instrument, size: Dp = 36.dp, onRemoteLogo: (() -> Unit)? = null) {
    val spec = InstrumentIcons.spec(instrument.kind, instrument.name)
    val color = bbSwatch(spec.swatch)
    val radius = if (size >= 36.dp) BBRadius.lg else BBRadius.md
    val shape = RoundedCornerShape(radius)
    val loader = LocalLogoLoader.current
    var image by remember(instrument.id) { mutableStateOf<ImageBitmap?>(null) }
    LaunchedEffect(instrument.id, loader) {
        if (loader == null || instrument.id.isEmpty() || !InstrumentIcons.wantsRemoteLogo(instrument.kind, instrument.name)) return@LaunchedEffect
        val bytes = loader.data("/api/instruments/${instrument.id}/logo") ?: return@LaunchedEffect
        val decoded = withContext(Dispatchers.Default) { BitmapFactory.decodeByteArray(bytes, 0, bytes.size)?.asImageBitmap() }
        if (decoded != null) {
            image = decoded
            onRemoteLogo?.invoke()
        }
    }
    val bitmap = image
    if (bitmap != null) {
        Box(Modifier.size(size).background(Color.White, shape).border(1.dp, BuddyBudgetTheme.colors.border, shape), contentAlignment = Alignment.Center) {
            Image(bitmap, null, Modifier.size(size * 0.64f), contentScale = ContentScale.Fit)
        }
    } else {
        Box(Modifier.size(size).background(color.copy(alpha = 0.16f), shape), contentAlignment = Alignment.Center) {
            BBText(spec.initials, style = BBTextStyle.BodyStrong.style.copy(fontSize = if (size >= 36.dp) 14.sp else 12.sp, fontWeight = FontWeight.SemiBold), color = color)
        }
    }
}

/** Period selector (INV-016/017). */
@Composable
fun InvestmentsPeriodSelector(
    period: InvestmentsPeriod,
    range: ChartRange,
    today: String,
    onPeriod: (InvestmentsPeriod) -> Unit,
    onApply: (ChartRange) -> Unit,
) {
    // #408: the shared `PeriodSelector`, presets on one line and «Personalizzato» as the calendar sheet.
    val invalid = tr("Scegli date valide, in ordine e non successive a oggi.")
    io.buddybudget.app.designsystem.components.PeriodSelector(
        InvestmentsPeriod.entries.filter { it != InvestmentsPeriod.Custom }.map { it to tr(it.label) }, period,
        { if (it != InvestmentsPeriod.Custom) onPeriod(it) },
        accessibilityLabel = tr("Periodo del grafico"),
        custom = io.buddybudget.app.designsystem.components.PeriodCustom(
            InvestmentsPeriod.Custom, io.buddybudget.core.domain.periods.DateKeyRange(range.from, range.to), max = today,
            validate = { r -> if (InvestmentsRules.isValidRange(ChartRange(r.from, r.to), today)) null else invalid },
            onApply = { r -> onApply(ChartRange(r.from, r.to)) },
        ),
    )
}

/** INV-008 broker chip and sheet. */
@Composable
fun BrokerSelector(model: InvestmentsModel, brokers: List<InvestmentsView.Broker>) {
    val c = BuddyBudgetTheme.colors
    var open by remember { mutableStateOf(false) }
    val (source, values) = model.state.brokerChip(brokers)
    val filtered = model.state.excludedBrokers.isNotEmpty()
    val shape = RoundedCornerShape(50)
    Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
        if (brokers.all { it.id in model.state.excludedBrokers }) {
            BBText(tr("Nessun broker selezionato: riattivane uno per vedere i suoi investimenti."), BBTextStyle.Body, color = c.mutedForeground)
        }
        val label = tr("Scegli i broker inclusi nei numeri")
        Row(
            Modifier.height(32.dp)
                .background(if (filtered) c.alphaPrimary10 else Color.Transparent, shape)
                .border(1.dp, if (filtered) c.primary.copy(alpha = 0.4f) else c.border, shape)
                .bbPressable({ open = true }, shape, translate = false)
                .semantics { contentDescription = label }
                .padding(horizontal = BBSpacing.space3),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(BBSpacing.space1_5),
        ) {
            BBIconView(BBIcon.Landmark, size = 14.dp, color = if (filtered) c.primary else c.foreground)
            BBText(tr(source, values), BBTextStyle.Body, color = if (filtered) c.primary else c.foreground, maxLines = 1)
        }
    }
    BBSheet(open, { open = false }, tr("Broker inclusi nei numeri")) {
        Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
            for (broker in brokers) {
                val on = broker.id !in model.state.excludedBrokers
                Row(
                    Modifier.fillMaxWidth().heightIn(min = BBLayout.minTouchTarget)
                        .bbPressable({ model.toggleBroker(broker.id) }, RoundedCornerShape(BBRadius.md), translate = false),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(BBSpacing.space3),
                ) {
                    BBCheckbox(on, { model.toggleBroker(broker.id) }, accessibilityLabel = tr(broker.label))
                    BBText(tr(broker.label), BBTextStyle.BodyLarge)
                }
            }
            BBText(tr("Vale per totali, posizioni, performance, proventi, tasse e operazioni. Gli import restano salvati e il patrimonio generale non cambia."),
                BBTextStyle.Caption, color = c.mutedForeground)
            if (filtered) BBButton(tr("Mostra tutti"), { model.showAllBrokers() }, variant = BBButtonVariant.Ghost, size = BBButtonSize.Sm)
        }
    }
}

/** INV-010 states of a view-gated tab. */
@Composable
fun InvestmentsGateView(
    gate: InvestmentsGate,
    model: InvestmentsModel,
    onRetry: () -> Unit,
    errorMessage: String = "Impossibile caricare gli investimenti.",
    content: @Composable () -> Unit,
) {
    val c = BuddyBudgetTheme.colors
    when (gate) {
        InvestmentsGate.Loading -> Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space6)) {
            BBSkeleton(Modifier.fillMaxWidth(), height = 160.dp, radius = BBRadius.xl)
            BBSkeleton(Modifier.fillMaxWidth(), height = 288.dp, radius = BBRadius.xl)
        }
        InvestmentsGate.Failed -> LoadError(tr(errorMessage), onRetry)
        InvestmentsGate.EmptyFiltered -> Column(
            Modifier.fillMaxWidth().border(1.dp, c.border, RoundedCornerShape(BBRadius.xl)).padding(BBSpacing.space6),
            horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(BBSpacing.space3),
        ) {
            BBText(tr("Nessuna operazione per i broker selezionati."), BBTextStyle.BodyLarge)
            BBButton(tr("Mostra tutti i broker"), { model.showAllBrokers() }, variant = BBButtonVariant.Outline)
        }
        InvestmentsGate.Empty -> EmptyState(
            BBIcon.TrendingUp, tr("Registra il tuo primo investimento"),
            tr("Cerca uno strumento per nome, ticker o ISIN (ETF, azioni, BTP, fondi, crypto) e inserisci l'acquisto: valore e guadagno si aggiornano da soli con i prezzi di chiusura."),
            primary = BBStateAction(tr("Registra un acquisto")) { model.openRegister() },
            secondary = BBStateAction(tr("Importa da file CSV")) { model.openImport?.invoke() },
        )
        InvestmentsGate.Content -> content()
    }
}

/** Label / value row with a bottom border. */
@Composable
fun InvestmentsValueRow(label: String, value: String, valueColor: Color = BuddyBudgetTheme.colors.foreground, strong: Boolean = false, showsDivider: Boolean = true) {
    Column {
        Row(Modifier.fillMaxWidth().padding(vertical = BBSpacing.space2_5), verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(BBSpacing.space4)) {
            BBText(label, if (strong) BBTextStyle.BodyStrong else BBTextStyle.Body, Modifier.weight(1f))
            BBText(value, style = if (strong) BBTextStyle.BodyStrong.style.copy(fontSize = 16.sp, lineHeight = 24.sp, fontFeatureSettings = "tnum")
            else BBTextStyle.Body.style.copy(fontFeatureSettings = "tnum"), color = valueColor)
        }
    }
}

/** Small stat: label over a big value. */
@Composable
fun InvestmentsStat(label: String, value: String, modifier: Modifier = Modifier, valueColor: Color = BuddyBudgetTheme.colors.foreground, note: String? = null) {
    val c = BuddyBudgetTheme.colors
    Column(modifier, verticalArrangement = Arrangement.spacedBy(BBSpacing.space1)) {
        BBText(label, BBTextStyle.Body, color = c.mutedForeground)
        BBText(value, style = BBTextStyle.StatValue.style.copy(fontSize = 24.sp, lineHeight = 32.sp), color = valueColor, maxLines = 1)
        if (note != null) BBText(note, BBTextStyle.Caption, color = c.mutedForeground)
    }
}

/** Collapsible block, closed by default. */
@Composable
fun InvestmentsDisclosure(title: String, initiallyOpen: Boolean = false, content: @Composable ColumnScope.() -> Unit) {
    val c = BuddyBudgetTheme.colors
    var open by remember(initiallyOpen) { mutableStateOf(initiallyOpen) }
    val rotation by animateFloatAsState(if (open) 180f else 0f, label = "disclosure")
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
        Row(
            Modifier.fillMaxWidth().heightIn(min = BBLayout.minTouchTarget).bbPressable({ open = !open }, RoundedCornerShape(BBRadius.md), translate = false),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2),
        ) {
            BBIconView(BBIcon.ChevronDown, Modifier.rotate(rotation), color = c.mutedForeground)
            BBText(title, BBTextStyle.BodyStrong)
        }
        if (open) content()
    }
}

/** Info «i» that opens the explanation as a bottom sheet. */
@Composable
fun InfoHintButton(title: String, text: String) {
    var open by remember { mutableStateOf(false) }
    Box(
        Modifier.size(20.dp).bbPressable({ open = true }, CircleShape, translate = false).semantics { contentDescription = title },
        contentAlignment = Alignment.Center,
    ) { BBIconView(BBIcon.Info, size = 14.dp, color = BuddyBudgetTheme.colors.mutedForeground) }
    BBSheet(open, { open = false }, title) {
        BBText(text, BBTextStyle.Body, color = BuddyBudgetTheme.colors.text2)
    }
}

/** `--pos` / `--neg` by sign (0 counts as positive). */
@Composable
fun signedColor(value: Double?): Color {
    val c = BuddyBudgetTheme.colors
    return when {
        value == null -> c.mutedForeground
        value < 0 -> c.neg
        else -> c.pos
    }
}

/** Horizontal bar split in coloured parts. */
@Composable
fun StackedBar(parts: List<Pair<Color, Double>>, height: Dp = 8.dp) {
    val total = parts.sumOf { maxOf(0.0, it.second) }.coerceAtLeast(0.0001)
    Row(Modifier.fillMaxWidth().height(height).clip(CircleShape), horizontalArrangement = Arrangement.spacedBy(2.dp)) {
        for ((color, weight) in parts) {
            if (weight > 0) Box(Modifier.weight((weight / total).toFloat().coerceAtLeast(0.001f)).height(height).background(color))
        }
    }
}


/** Thin capsule bar with a fill fraction. */
@Composable
fun FillBar(fraction: Double, color: Color, height: Dp = 6.dp, modifier: Modifier = Modifier) {
    val c = BuddyBudgetTheme.colors
    Box(modifier.fillMaxWidth().height(height).background(c.muted, CircleShape)) {
        Box(Modifier.fillMaxWidth(fraction.coerceIn(0.0, 1.0).toFloat()).height(height).background(color, CircleShape))
    }
}

/** Extends a child 16 dp beyond the screen gutter on both sides (full-bleed charts). */
fun Modifier.fullBleed(gutter: Dp = 16.dp): Modifier = this.layout { measurable, constraints ->
    val extra = gutter.roundToPx() * 2
    val placeable = measurable.measure(constraints.copy(minWidth = constraints.maxWidth + extra, maxWidth = constraints.maxWidth + extra))
    layout(constraints.maxWidth, placeable.height) { placeable.place(-gutter.roundToPx(), 0) }
}

/** DEBUG-only `--ei bbSkip <n>` (see liquidity `debugShows`). */
fun debugShows(index: Int): Boolean = io.buddybudget.app.features.liquidity.debugShows(index)

/** Year segments beside a section title (web phone layout): inline up to this many options, else a scrolling row below. */
object TitleSegments {
    const val MAX_INLINE = 3
}
