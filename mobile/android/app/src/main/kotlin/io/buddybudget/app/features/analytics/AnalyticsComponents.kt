package io.buddybudget.app.features.analytics

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.Composable
import androidx.compose.runtime.compositionLocalOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.LinkAnnotation
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withLink
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import io.buddybudget.app.designsystem.BuddyBudgetTheme
import io.buddybudget.app.designsystem.components.BBIconView
import io.buddybudget.app.designsystem.components.BBSeparator
import io.buddybudget.app.designsystem.components.BBSheet
import io.buddybudget.app.designsystem.components.BBText
import io.buddybudget.app.designsystem.components.bbPressable
import io.buddybudget.app.designsystem.generated.BBIcon
import io.buddybudget.app.designsystem.generated.BBLayout
import io.buddybudget.app.designsystem.generated.BBRadius
import io.buddybudget.app.designsystem.generated.BBSpacing
import io.buddybudget.app.designsystem.generated.BBTextStyle
import io.buddybudget.app.tr
import io.buddybudget.core.domain.analytics.AnalyticsContent
import io.buddybudget.core.domain.analytics.AnalyticsTextPart
import io.buddybudget.core.domain.analytics.AnalyticsVerdict

// Building blocks of Analitiche (web components/domain/analytics/{analytics-card,question-section,explainer,term,
// glossed-text}.tsx). iOS: AnalyticsComponents.swift.

/** Opens a glossary term in the bottom sheet (ANA-032). */
val LocalAnalyticsTerm = compositionLocalOf<(String) -> Unit> { {} }

/** Text with glossary terms underlined (dotted, `--primary @ 60%`); tapping a term opens its definition. */
@Composable
fun GlossedText(parts: List<AnalyticsTextPart>, style: TextStyle = BBTextStyle.BodyLarge.style, color: Color = BuddyBudgetTheme.colors.mutedForeground) {
    val openTerm = LocalAnalyticsTerm.current
    val underline = BuddyBudgetTheme.colors.primary.copy(alpha = 0.6f)
    val ranges = mutableListOf<IntRange>()
    val text = buildAnnotatedString {
        for (part in parts) {
            when (part) {
                is AnalyticsTextPart.Text -> append(part.string)
                is AnalyticsTextPart.Term -> {
                    val start = length
                    withLink(LinkAnnotation.Clickable(part.id) { openTerm(part.id) }) { append(part.string) }
                    ranges += start until length
                }
            }
        }
    }
    var layout by remember { mutableStateOf<TextLayoutResult?>(null) }
    BasicText(
        text,
        Modifier.drawBehind {
            val l = layout ?: return@drawBehind
            for (r in ranges) {
                if (r.isEmpty()) continue
                var lineIndex = l.getLineForOffset(r.first)
                var left = l.getBoundingBox(r.first).left
                var right = left
                for (i in r) {
                    val line = l.getLineForOffset(i)
                    val box = l.getBoundingBox(i)
                    if (line != lineIndex) {
                        drawDotted(left, right, l.getLineBaseline(lineIndex) + 3.dp.toPx(), underline)
                        lineIndex = line
                        left = box.left
                    }
                    right = box.right
                }
                drawDotted(left, right, l.getLineBaseline(lineIndex) + 3.dp.toPx(), underline)
            }
        },
        style = style.copy(color = color),
        onTextLayout = { layout = it },
    )
}

private fun androidx.compose.ui.graphics.drawscope.DrawScope.drawDotted(left: Float, right: Float, y: Float, color: Color) {
    drawLine(color, Offset(left, y), Offset(right, y), 1.5.dp.toPx(), cap = StrokeCap.Round,
        pathEffect = PathEffect.dashPathEffect(floatArrayOf(0.1f, 3.dp.toPx())))
}

/** `Metric`: border-t, label (optionally a glossary term), value font-heading text-2xl tabular, note text-xs. */
@Composable
fun AnalyticsMetric(label: String, value: String, modifier: Modifier = Modifier, sub: String? = null, tone: AnalyticsVerdict.Tone = AnalyticsVerdict.Tone.DEFAULT, term: String? = null) {
    val c = BuddyBudgetTheme.colors
    Column(modifier.fillMaxWidth()) {
        Column(Modifier.padding(top = BBSpacing.space3)) {
            if (term != null) GlossedText(listOf(AnalyticsTextPart.Term(term, label)), BBTextStyle.Body.style)
            else BBText(label, BBTextStyle.Body, color = c.mutedForeground)
            BBText(value, style = BBTextStyle.AmountLarge.style.copy(fontFeatureSettings = "tnum"),
                color = when (tone) { AnalyticsVerdict.Tone.POS -> c.pos; AnalyticsVerdict.Tone.NEG -> c.neg; else -> c.foreground })
            if (sub != null) BBText(sub, BBTextStyle.Caption, color = c.mutedForeground)
        }
    }
}

/** `AnalyticsCard`: rule, overline title, content, optional explainer. */
@Composable
fun AnalyticsBlock(title: String, explainer: String? = null, content: @Composable () -> Unit) {
    val c = BuddyBudgetTheme.colors
    Column(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(top = BBSpacing.space4), verticalArrangement = Arrangement.spacedBy(BBSpacing.space4)) {
            BBText(title, BBTextStyle.Overline, color = c.mutedForeground)
            content()
            if (explainer != null) AnalyticsExplainerBox(explainer)
        }
    }
}

/** `MissingData`: dashed box saying what is needed. */
@Composable
fun AnalyticsMissing(text: String) {
    val c = BuddyBudgetTheme.colors
    val radius = BBRadius.lg
    BBText(
        text,
        Modifier.fillMaxWidth().drawBehind {
            drawRoundRect(c.border, cornerRadius = androidx.compose.ui.geometry.CornerRadius(radius.toPx()),
                style = Stroke(1.dp.toPx(), pathEffect = PathEffect.dashPathEffect(floatArrayOf(4.dp.toPx(), 3.dp.toPx()))))
        }.padding(BBSpacing.space4),
        BBTextStyle.Body.style, color = c.mutedForeground,
    )
}

/** «Come leggere e come è calcolata»: the short «what», details on demand. */
@Composable
fun AnalyticsExplainerBox(id: String) {
    val e = AnalyticsContent.explainer(id) ?: return
    val c = BuddyBudgetTheme.colors
    var open by remember { mutableStateOf(false) }
    Column(
        Modifier.fillMaxWidth().background(c.muted.copy(alpha = 0.4f), RoundedCornerShape(BBRadius.lg))
            .padding(horizontal = BBSpacing.space3_5, vertical = BBSpacing.space3),
        verticalArrangement = Arrangement.spacedBy(BBSpacing.space2),
    ) {
        BBText(tr(e.what), BBTextStyle.Body, color = c.mutedForeground)
        Row(
            Modifier.heightIn(min = 28.dp).bbPressable({ open = !open }, RoundedCornerShape(BBRadius.md), translate = false),
            verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space1),
        ) {
            BBIconView(BBIcon.ChevronRight, Modifier.rotate(if (open) 90f else 0f), color = c.foreground)
            BBText(tr("Come leggerla e come è calcolata"), BBTextStyle.BodyStrong)
        }
        if (open) {
            Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space2_5)) {
                ExplainerItem("Come leggerla", e.read)
                ExplainerItem("Come è calcolata", e.how)
                ExplainerItem("Limiti", e.limits)
                if (e.sources.isNotEmpty()) {
                    Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                        BBText(tr("Fonti"), BBTextStyle.BodyStrong)
                        e.sources.forEach { BBText("• " + tr(it.label), BBTextStyle.Body, color = c.mutedForeground) }
                    }
                }
            }
        }
    }
}

@Composable
private fun ExplainerItem(title: String, text: String) {
    Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
        BBText(tr(title), BBTextStyle.BodyStrong)
        BBText(tr(text), BBTextStyle.Body, color = BuddyBudgetTheme.colors.mutedForeground)
    }
}

/** `QuestionSection`: the plain answer, then the collapsible «Per esperti · {hint}» (ANA-026, collapsed by default). */
@Composable
fun AnalyticsQuestionSection(hint: String, expertOpen: Boolean, onToggle: () -> Unit, content: @Composable () -> Unit, expert: @Composable () -> Unit) {
    val c = BuddyBudgetTheme.colors
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space5)) {
        if (io.buddybudget.app.features.investments.debugShows(3)) content()
        Column(Modifier.fillMaxWidth()) {
            Row(
                Modifier.padding(top = BBSpacing.space3).fillMaxWidth().heightIn(min = BBLayout.minTouchTarget)
                    .bbPressable(onToggle, RoundedCornerShape(BBRadius.md), translate = false),
                verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2),
            ) {
                BBIconView(BBIcon.ChevronRight, Modifier.rotate(if (expertOpen) 90f else 0f), color = c.mutedForeground)
                val annotated = buildAnnotatedString {
                    pushStyle(androidx.compose.ui.text.SpanStyle(fontWeight = FontWeight.W600))
                    append(tr("Per esperti"))
                    pop()
                    append(" · " + tr(hint))
                }
                BasicText(annotated, style = BBTextStyle.Body.style.copy(color = c.mutedForeground))
            }
            if (expertOpen) Box(Modifier.padding(top = BBSpacing.space3)) { expert() }
        }
    }
}

/** Thin progress bar (h 12 or 8, `--muted` track, `--primary` fill). */
@Composable
fun AnalyticsProgress(value: Double, modifier: Modifier = Modifier, height: androidx.compose.ui.unit.Dp = 12.dp, color: Color = BuddyBudgetTheme.colors.primary) {
    val c = BuddyBudgetTheme.colors
    Box(modifier.fillMaxWidth().height(height).background(c.muted, CircleShape)) {
        val f = value.coerceIn(0.0, 1.0).toFloat()
        if (f > 0f) Box(Modifier.fillMaxWidth(f).height(height).background(color, CircleShape))
    }
}

/** Info button that opens a hint in a bottom sheet (`InfoHint`). */
@Composable
fun AnalyticsInfoButton(label: String, text: String) {
    var open by remember { mutableStateOf(false) }
    Box(
        Modifier.size(24.dp).bbPressable({ open = true }, CircleShape, translate = false)
            .semantics { contentDescription = label },
        contentAlignment = Alignment.Center,
    ) { BBIconView(BBIcon.Info, size = 14.dp, color = BuddyBudgetTheme.colors.mutedForeground) }
    BBSheet(open, { open = false }, title = label) {
        BBText(text, BBTextStyle.Body, color = BuddyBudgetTheme.colors.mutedForeground)
    }
}
