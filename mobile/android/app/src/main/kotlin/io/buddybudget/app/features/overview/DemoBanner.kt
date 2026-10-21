package io.buddybudget.app.features.overview

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.CubicBezierEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
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
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.draw.scale
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import io.buddybudget.app.debug.DebugLaunch
import io.buddybudget.app.designsystem.BuddyBudgetTheme
import io.buddybudget.app.designsystem.components.BBButton
import io.buddybudget.app.designsystem.components.BBButtonSize
import io.buddybudget.app.designsystem.components.BBButtonVariant
import io.buddybudget.app.designsystem.components.BBIconView
import io.buddybudget.app.designsystem.components.BBSheet
import io.buddybudget.app.designsystem.components.BBText
import io.buddybudget.app.designsystem.components.bbPressable
import io.buddybudget.app.designsystem.components.rememberReduceMotion
import io.buddybudget.app.designsystem.generated.BBIcon
import io.buddybudget.app.designsystem.generated.BBLayout
import io.buddybudget.app.designsystem.generated.BBRadius
import io.buddybudget.app.designsystem.generated.BBSpacing
import io.buddybudget.app.designsystem.generated.BBTextStyle
import io.buddybudget.app.features.shell.LocalShell
import io.buddybudget.app.tr
import io.buddybudget.core.data.WhatsNewEntry
import io.buddybudget.core.domain.overview.InAppLinks

/**
 * Demo-data banner (SHELL-048, OV-041/042): mounted once in the shell above the tab content, shown on every
 * authenticated screen while `GET /api/start` says `demoActive`. One-tap reset (as the web), snackbar afterwards.
 * Twin of `DemoBanner` on iOS.
 */
@Composable
fun DemoBanner(modifier: Modifier = Modifier) {
    val model = LocalShell.current.overview
    if (!model.demoActive) return
    val c = BuddyBudgetTheme.colors
    val shape = RoundedCornerShape(BBRadius.xl)
    Column(
        modifier.padding(start = BBSpacing.space4, end = BBSpacing.space4, top = BBSpacing.space2).fillMaxWidth()
            .background(c.alphaPrimary5, shape)
            .drawBehind {
                val r = BBRadius.xl.toPx()
                drawRoundRect(
                    c.primary.copy(alpha = 0.4f), topLeft = Offset(0.5.dp.toPx(), 0.5.dp.toPx()),
                    size = Size(size.width - 1.dp.toPx(), size.height - 1.dp.toPx()), cornerRadius = CornerRadius(r, r),
                    style = Stroke(1.dp.toPx(), pathEffect = PathEffect.dashPathEffect(floatArrayOf(4.dp.toPx(), 3.dp.toPx()))),
                )
            }
            .padding(horizontal = BBSpacing.space4, vertical = BBSpacing.space3),
        verticalArrangement = Arrangement.spacedBy(BBSpacing.space2),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
            BBIconView(BBIcon.FlaskConical, size = 16.dp, color = c.primary)
            Text(
                buildAnnotatedString {
                    withStyle(SpanStyle(fontWeight = FontWeight.W600)) { append(tr("Dati d'esempio.")) }
                    append(" " + tr("Quello che vedi è inventato. Azzera per aggiungere i tuoi conti e movimenti."))
                },
                Modifier.weight(1f),
                style = BBTextStyle.Body.style.copy(color = c.foreground),
            )
        }
        BBButton(
            if (model.demoClearing) tr("Azzero…") else tr("Azzera e inizia"), model::clearDemo,
            size = BBButtonSize.Touch, enabled = !model.demoClearing,
        )
        model.demoClearError?.let { BBText(it, BBTextStyle.Body, color = c.neg) }
    }
}

/**
 * «Novità» chip next to the date (SHELL-049) opening a sheet with title, summary, `Non mostrare più` and the CTA
 * (SHELL-050). Twin of `WhatsNewChip` on iOS.
 */
@Composable
fun WhatsNewChip(entry: WhatsNewEntry, model: OverviewModel) {
    val c = BuddyBudgetTheme.colors
    val shell = LocalShell.current
    val reduceMotion = rememberReduceMotion()
    // DEBUG `--es bbSheet whatsnew` opens the sheet at launch for screenshots.
    var open by remember { mutableStateOf(DebugLaunch.value("bbSheet") == "whatsnew") }
    val appear = remember { Animatable(if (reduceMotion) 1f else 0f) }
    LaunchedEffect(Unit) { if (appear.value < 1f) appear.animateTo(1f, tween(600, delayMillis = 600, easing = CubicBezierEasing(0.16f, 1f, 0.3f, 1f))) }
    Row(
        Modifier.heightIn(min = 20.dp).alpha(appear.value).bbPressable({ open = true }, RoundedCornerShape(BBRadius.md), translate = false),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(BBSpacing.space1_5),
    ) {
        BBIconView(BBIcon.Sparkles, Modifier.rotate(-90f * (1 - appear.value)).scale(0.6f + 0.4f * appear.value), size = 14.dp, color = c.primary)
        BBText(tr("Novità:") + " " + entry.title, BBTextStyle.BodyStrong, color = c.primary, maxLines = 1)
    }
    BBSheet(open, { open = false }) {
        Column(Modifier.padding(bottom = BBSpacing.space4), verticalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
                BBIconView(BBIcon.Sparkles, size = 16.dp, color = c.primary)
                BBText(entry.title, BBTextStyle.CardTitle)
            }
            BBText(entry.summary, style = BBTextStyle.Body.style.copy(lineHeight = 23.sp), color = c.mutedForeground)
            Row(Modifier.padding(top = BBSpacing.space1), verticalAlignment = Alignment.CenterVertically) {
                BBButton(tr("Non mostrare più"), {
                    open = false
                    model.dismissWhatsNew(entry.id)
                }, variant = BBButtonVariant.Ghost, size = BBButtonSize.Touch)
                Spacer(Modifier.weight(1f))
                BBButton(entry.ctaLabel, {
                    open = false
                    shell.open(InAppLinks.nativePath(entry.href))
                }, size = BBButtonSize.Touch)
            }
        }
    }
}
