package io.buddybudget.app.designsystem.components

import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.positionInParent
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import io.buddybudget.app.debug.DebugLaunch
import io.buddybudget.app.designsystem.BuddyBudgetTheme
import io.buddybudget.app.designsystem.generated.BBIcon
import io.buddybudget.app.designsystem.generated.BBLayout
import io.buddybudget.app.designsystem.generated.BBMotion
import io.buddybudget.app.designsystem.generated.BBRadius
import io.buddybudget.app.designsystem.generated.BBSpacing
import io.buddybudget.app.designsystem.generated.BBTextStyle
import io.buddybudget.app.tr
import io.buddybudget.core.domain.format.BBDateSkeleton
import io.buddybudget.core.domain.format.BBFormat
import io.buddybudget.core.domain.periods.CalendarDate
import io.buddybudget.core.domain.periods.CalendarDay
import io.buddybudget.core.domain.periods.CalendarRange
import io.buddybudget.core.domain.periods.DateKeyRange
import io.buddybudget.core.domain.periods.RangeDraft
import io.buddybudget.core.domain.periods.RangeGranularity

// The app's one period selector (spec: design/components.md «PeriodSelector»; web components/domain/shared/
// period-selector.tsx, decision 2026-10-17-selettore-del-periodo, #408). Presets on one line that never wraps (it
// scrolls sideways as a last resort), 44 dp tall; when a screen allows a custom range, a calendar button opens a bottom
// sheet with «Dal → Al», a day calendar (or a month grid) and «Applica». Logic: `CalendarRange` in :core.
// iOS: BBPeriodSelector.swift.

/** The custom range a [PeriodSelector] can offer. */
class PeriodCustom<T>(
    /** Value the selection takes while the custom range is in use. */
    val value: T,
    /** Last applied range: `YYYY-MM-DD` for days, `YYYY-MM` for months. */
    val range: DateKeyRange,
    val granularity: RangeGranularity = RangeGranularity.Day,
    val min: String? = null,
    /** Usually today (days) or the last full month (months). */
    val max: String? = null,
    /** Why a range cannot be used (already translated), or null. */
    val validate: ((DateKeyRange) -> String?)? = null,
    /** Show the chosen range under the presets (off where the screen already writes it). */
    val showCaption: Boolean = true,
    val onApply: (DateKeyRange) -> Unit,
)

@Composable
fun <T> PeriodSelector(
    options: List<Pair<T, String>>,
    selection: T,
    onSelectionChange: (T) -> Unit,
    modifier: Modifier = Modifier,
    accessibilityLabel: String = "",
    custom: PeriodCustom<T>? = null,
    /** Full width with equal segments. */
    stretch: Boolean = false,
) {
    val c = BuddyBudgetTheme.colors
    val density = LocalDensity.current
    val reduceMotion = rememberReduceMotion()
    val locale = LocalBBLocale.current
    var open by remember { mutableStateOf(false) }
    // `bbPeriodOpen`: opens the calendar sheet of the first selector with a custom range (screenshots).
    val debugOpen = remember { custom != null && DebugLaunch.periodOpen }
    if (debugOpen) LaunchedEffect(Unit) { kotlinx.coroutines.delay(1000); DebugLaunch.periodOpen = false; open = true }
    val customActive = custom != null && custom.value == selection
    val count = options.size + if (custom != null) 1 else 0
    val activeIndex = if (customActive) options.size else options.indexOfFirst { it.first == selection }
    val bounds = remember { mutableStateMapOf<Int, Pair<Dp, Dp>>() }
    val target = bounds[activeIndex]
    val spec = if (reduceMotion) tween<Dp>(150) else BBMotion.springBouncy.spec()
    val pillX by animateDpAsState(target?.first ?: 0.dp, spec, label = "pillX")
    val pillW by animateDpAsState(target?.second ?: 0.dp, spec, label = "pillW")
    fun label(custom: PeriodCustom<T>) = CalendarRange.shortLabel(
        custom.range.from, custom.range.to, custom.granularity, locale,
        CalendarDate.of(java.time.Instant.now(), java.time.ZoneId.systemDefault()).year,
    )
    Column(modifier, horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(BBSpacing.space1_5)) {
        Box(
            Modifier.then(if (stretch) Modifier.fillMaxWidth() else Modifier.horizontalScroll(rememberScrollState()))
                .background(c.muted, CircleShape)
                .padding(BBSpacing.space1)
                .semantics { contentDescription = accessibilityLabel },
        ) {
            if (target != null) Box(Modifier.offset(x = pillX).size(pillW, BBLayout.periodSegmentHeight).background(c.background, CircleShape))
            Row(if (stretch) Modifier.fillMaxWidth() else Modifier, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space1)) {
                for (i in 0 until count) {
                    val isCustom = i == options.size
                    val active = i == activeIndex
                    val description = if (isCustom && custom != null) {
                        if (customActive) tr("Date scelte: {0}. Cambia le date", mapOf("0" to label(custom)))
                        else tr(if (custom.granularity == RangeGranularity.Day) "Scegli le date" else "Scegli i mesi")
                    } else {
                        null
                    }
                    Box(
                        Modifier.then(if (stretch) Modifier.weight(1f) else Modifier)
                            .heightIn(min = BBLayout.periodSegmentHeight).widthIn(min = BBLayout.periodSegmentHeight)
                            .onGloballyPositioned { coords ->
                                with(density) { bounds[i] = coords.positionInParent().x.toDp() to coords.size.width.toDp() }
                            }
                            .bbPressable({ if (isCustom) open = true else onSelectionChange(options[i].first) }, CircleShape, translate = false, role = Role.Button)
                            .semantics { selected = active; if (description != null) contentDescription = description }
                            .padding(horizontal = BBSpacing.space2_5),
                        contentAlignment = Alignment.Center,
                    ) {
                        if (isCustom) {
                            BBIconView(BBIcon.CalendarDays, size = 16.dp, color = if (active) c.foreground else c.mutedForeground)
                        } else {
                            BBText(options[i].second, BBTextStyle.BodyStrong, color = if (active) c.foreground else c.mutedForeground, maxLines = 1)
                        }
                    }
                }
            }
        }
        if (custom != null && customActive && custom.showCaption) {
            BBText(
                label(custom), Modifier.bbPressable({ open = true }, CircleShape, translate = false).padding(horizontal = BBSpacing.space1_5),
                BBTextStyle.Caption.style.copy(fontFeatureSettings = "tnum"), color = c.mutedForeground,
            )
        }
    }
    if (custom != null) {
        BBSheet(open, { open = false }) {
            if (open) {
                PeriodRangePanel(custom, onApply = { range ->
                    custom.onApply(range)
                    if (selection != custom.value) onSelectionChange(custom.value)
                    open = false
                }, onCancel = { open = false })
            }
        }
    }
}

/**
 * Body of the custom-range sheet: the two ends («Dal», «Al»), a calendar of days or months, the reason a range cannot
 * be used, and «Applica». It keeps its own draft, so closing without applying changes nothing.
 */
@Composable
fun <T> PeriodRangePanel(custom: PeriodCustom<T>, onApply: (DateKeyRange) -> Unit, onCancel: () -> Unit) {
    val c = BuddyBudgetTheme.colors
    val locale = LocalBBLocale.current
    var draft by remember { mutableStateOf(RangeDraft(custom.range.from, custom.range.to)) }
    var monthYear by remember { mutableStateOf(CalendarRange.parseMonth(custom.range.to).first) }
    val day = custom.granularity == RangeGranularity.Day
    val complete = draft.to?.let { DateKeyRange(draft.from, it) }
    val error = complete?.let { custom.validate?.invoke(it) }
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
        BBText(tr(if (day) "Scegli le date" else "Scegli i mesi"), Modifier.semantics { heading() }, BBTextStyle.CardTitle.style)
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
            RangeEnd(tr("Dal"), CalendarRange.endLabel(draft.from, custom.granularity, locale), false, Modifier.weight(1f))
            BBIconView(BBIcon.ArrowRight, size = 16.dp, color = c.text3)
            RangeEnd(
                tr("Al"),
                draft.to?.let { CalendarRange.endLabel(it, custom.granularity, locale) } ?: tr(if (day) "Tocca l'ultimo giorno" else "Tocca l'ultimo mese"),
                draft.to == null, Modifier.weight(1f),
            )
        }
        if (day) {
            RangeCalendar(draft, custom.min, custom.max) { draft = CalendarRange.pick(draft, it) }
        } else {
            MonthGrid(monthYear, { monthYear = it }, custom.min, custom.max,
                isEdge = { it == draft.from || it == draft.to }, isInside = { CalendarRange.inDraft(draft, it) },
                onPick = { draft = CalendarRange.pick(draft, it) })
        }
        if (error != null) BBText(error, BBTextStyle.Caption, color = c.neg)
        Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
            BBButton(tr("Applica"), { complete?.let(onApply) }, size = BBButtonSize.Touch, fullWidth = true, enabled = complete != null && error == null)
            BBButton(tr("Annulla"), onCancel, variant = BBButtonVariant.Ghost, size = BBButtonSize.Touch, fullWidth = true)
        }
    }
}

@Composable
private fun RangeEnd(label: String, value: String, waiting: Boolean, modifier: Modifier) {
    val c = BuddyBudgetTheme.colors
    val shape = RoundedCornerShape(BBRadius.lg)
    Column(
        modifier
            .then(if (waiting) Modifier.border(3.dp, c.primary.copy(alpha = 0.2f), RoundedCornerShape(BBRadius.lg + 2.dp)).padding(1.dp) else Modifier)
            .border(1.dp, if (waiting) c.primary else c.border, shape)
            .padding(horizontal = BBSpacing.space3, vertical = BBSpacing.space2),
    ) {
        BBText(label, BBTextStyle.Caption, color = c.mutedForeground)
        BBText(value, style = BBTextStyle.BodyStrong.style.copy(fontFeatureSettings = "tnum"), color = if (waiting) c.mutedForeground else c.foreground, maxLines = 1)
    }
}

/** One month of days for picking a range by tapping its first and last day; the title opens a month view. */
@Composable
fun RangeCalendar(draft: RangeDraft, min: String?, max: String?, onPick: (String) -> Unit) {
    val c = BuddyBudgetTheme.colors
    val locale = LocalBBLocale.current
    var visible by remember { mutableStateOf(CalendarRange.monthOf(draft.to ?: draft.from)) }
    var monthsView by remember { mutableStateOf(false) }
    var monthYear by remember { mutableStateOf(CalendarRange.parseMonth(visible).first) }
    val (year, monthIndex) = CalendarRange.parseMonth(visible)
    if (monthsView) {
        MonthGrid(monthYear, { monthYear = it }, min, max, isEdge = { it == visible }, isInside = { false }) {
            visible = it
            monthsView = false
        }
        return
    }
    val minMonth = min?.let(CalendarRange::monthOf)
    val maxMonth = max?.let(CalendarRange::monthOf)
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space1)) {
        CalendarNav(
            BBFormat.capitalize(CalendarRange.monthTitle(visible, locale)), tr("Mese precedente"), tr("Mese successivo"),
            canPrevious = minMonth?.let { visible > it } ?: true, canNext = maxMonth?.let { visible < it } ?: true,
            onPrevious = { visible = CalendarRange.monthKey(year, monthIndex - 1) },
            onNext = { visible = CalendarRange.monthKey(year, monthIndex + 1) },
            onLabel = { monthYear = year; monthsView = true }, labelAction = tr("scegli il mese"),
        )
        Row(Modifier.fillMaxWidth()) {
            for (d in CalendarRange.weekdayInitials(locale)) {
                BBText(d, Modifier.weight(1f).padding(vertical = BBSpacing.space1), BBTextStyle.Caption.style.copy(textAlign = TextAlign.Center), color = c.text3)
            }
        }
        val days = CalendarRange.monthGrid(year, monthIndex)
        Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
            for (week in 0 until 6) {
                Row(Modifier.fillMaxWidth()) {
                    for (d in days.subList(week * 7, week * 7 + 7)) DayCell(d, draft, min, max, Modifier.weight(1f), onPick)
                }
            }
        }
    }
}

@Composable
private fun DayCell(day: CalendarDay, draft: RangeDraft, min: String?, max: String?, modifier: Modifier, onPick: (String) -> Unit) {
    val c = BuddyBudgetTheme.colors
    val locale = LocalBBLocale.current
    val disabled = CalendarRange.outOfBounds(day.key, min, max)
    val edge = day.key == draft.from || day.key == draft.to
    val inside = !edge && CalendarRange.inDraft(draft, day.key)
    val spans = draft.to != null && draft.to != draft.from
    val leftFlat = inside || (spans && day.key == draft.to)
    val rightFlat = inside || (spans && day.key == draft.from)
    val r = BBRadius.lg
    val shape = RoundedCornerShape(
        topStart = if (leftFlat) 0.dp else r, bottomStart = if (leftFlat) 0.dp else r,
        topEnd = if (rightFlat) 0.dp else r, bottomEnd = if (rightFlat) 0.dp else r,
    )
    val description = CalendarDate.parse(day.key)?.let { BBFormat.formatDate(it, BBDateSkeleton.EEEE_D_MMMM_Y, locale) } ?: day.key
    Box(
        modifier.heightIn(min = BBLayout.minTouchTarget)
            .background(if (edge) c.primary else if (inside) c.primary.copy(alpha = 0.12f) else Color.Transparent, shape)
            .alpha(if (disabled) 0.3f else 1f)
            .bbPressable(if (disabled) null else ({ onPick(day.key) }), shape, translate = false)
            .semantics { contentDescription = description; selected = edge || inside },
        contentAlignment = Alignment.Center,
    ) {
        BBText(
            day.day.toString(),
            style = BBTextStyle.Body.style.copy(fontFeatureSettings = "tnum", fontWeight = if (edge) FontWeight.W600 else null),
            color = if (edge) c.primaryForeground else if (day.inMonth) c.foreground else c.text3,
        )
    }
}

/** Twelve months of one year with arrows to change year (Analitiche's month range, the day calendar's month jump). */
@Composable
fun MonthGrid(
    year: Int,
    onYearChange: (Int) -> Unit,
    min: String?,
    max: String?,
    isEdge: (String) -> Boolean,
    isInside: (String) -> Boolean,
    onPick: (String) -> Unit,
) {
    val c = BuddyBudgetTheme.colors
    val locale = LocalBBLocale.current
    val minYear = min?.let { CalendarRange.parseMonth(it).first }
    val maxYear = max?.let { CalendarRange.parseMonth(it).first }
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
        CalendarNav(
            year.toString(), tr("Anno precedente"), tr("Anno successivo"),
            canPrevious = minYear?.let { year > it } ?: true, canNext = maxYear?.let { year < it } ?: true,
            onPrevious = { onYearChange(year - 1) }, onNext = { onYearChange(year + 1) },
        )
        for (row in 0 until 4) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(BBSpacing.space1)) {
                for (col in 0 until 3) {
                    val index = row * 3 + col
                    val key = CalendarRange.monthKey(year, index)
                    val disabled = CalendarRange.outOfBounds(key, min?.let(CalendarRange::monthOf), max?.let(CalendarRange::monthOf))
                    val edge = isEdge(key)
                    val inside = isInside(key)
                    val shape = RoundedCornerShape(BBRadius.lg)
                    Box(
                        Modifier.weight(1f).heightIn(min = BBLayout.minTouchTarget)
                            .background(if (edge) c.primary else if (inside) c.primary.copy(alpha = 0.12f) else Color.Transparent, shape)
                            .alpha(if (disabled) 0.35f else 1f)
                            .bbPressable(if (disabled) null else ({ onPick(key) }), shape, translate = false)
                            .semantics { selected = edge || inside },
                        contentAlignment = Alignment.Center,
                    ) {
                        BBText(BBFormat.capitalize(CalendarRange.shortMonth(year, index, locale)), BBTextStyle.BodyStrong, color = if (edge) c.primaryForeground else c.foreground)
                    }
                }
            }
        }
    }
}

/** Header of a calendar page: «‹ Ottobre 2026 ›»; with [onLabel] the title is a button. */
@Composable
fun CalendarNav(
    label: String,
    previousLabel: String,
    nextLabel: String,
    canPrevious: Boolean,
    canNext: Boolean,
    onPrevious: () -> Unit,
    onNext: () -> Unit,
    onLabel: (() -> Unit)? = null,
    labelAction: String? = null,
) {
    val c = BuddyBudgetTheme.colors
    @Composable
    fun arrow(icon: BBIcon, description: String, enabled: Boolean, onClick: () -> Unit) {
        Box(
            Modifier.size(BBLayout.minTouchTarget).alpha(if (enabled) 1f else 0.3f)
                .bbPressable(if (enabled) onClick else null, RoundedCornerShape(BBRadius.lg), pressedBackground = c.muted, translate = false)
                .semantics { contentDescription = description },
            contentAlignment = Alignment.Center,
        ) { BBIconView(icon, size = 16.dp, color = c.text2) }
    }
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        arrow(BBIcon.ChevronLeft, previousLabel, canPrevious, onPrevious)
        Box(Modifier.weight(1f), contentAlignment = Alignment.Center) {
            val description = labelAction?.let { "$label, $it" } ?: label
            BBText(
                label,
                if (onLabel != null) {
                    Modifier.heightIn(min = BBLayout.minTouchTarget)
                        .bbPressable(onLabel, RoundedCornerShape(BBRadius.lg), pressedBackground = c.muted, translate = false)
                        .semantics { contentDescription = description }
                        .padding(horizontal = BBSpacing.space3, vertical = BBSpacing.space2_5)
                } else {
                    Modifier
                },
                BBTextStyle.CardTitle.style,
            )
        }
        arrow(BBIcon.ChevronRight, nextLabel, canNext, onNext)
    }
}
