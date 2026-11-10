package io.buddybudget.app.features.imports

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.sizeIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import io.buddybudget.app.designsystem.BuddyBudgetTheme
import io.buddybudget.app.designsystem.components.BBIconView
import io.buddybudget.app.designsystem.components.BBSpinner
import io.buddybudget.app.designsystem.components.BBText
import io.buddybudget.app.designsystem.components.bbPressable
import io.buddybudget.app.designsystem.components.bbShadow
import io.buddybudget.app.designsystem.generated.BBIcon
import io.buddybudget.app.designsystem.generated.BBLayout
import io.buddybudget.app.designsystem.generated.BBShadow
import io.buddybudget.app.designsystem.generated.BBSpacing
import io.buddybudget.app.designsystem.generated.BBTextStyle
import io.buddybudget.app.tr
import io.buddybudget.core.domain.imports.PersonalImportIslandState
import io.buddybudget.core.domain.imports.PersonalImportListing
import io.buddybudget.core.domain.imports.PersonalImportRules

/**
 * Global import island (IMP-058/059): one compact pill per job created in the last 24 h and not dismissed, above the
 * bottom bar on every screen. Running pills can't be closed; finished ones remember their dismissal on the device.
 * Twin of `ImportIsland` on iOS.
 */
@Composable
fun ImportIsland(model: ImportsModel, onDetail: (String) -> Unit) {
    val jobs = model.islandJobs
    Column(Modifier.fillMaxWidth().padding(start = BBSpacing.space4, end = BBSpacing.space4, bottom = if (jobs.isEmpty()) 0.dp else BBSpacing.space2),
        verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
        jobs.forEach { job ->
            androidx.compose.runtime.key(job.id) {
                AnimatedVisibility(true, enter = slideInVertically { it } + fadeIn(), exit = slideOutVertically { it } + fadeOut()) {
                    ImportIslandCard(job, model.listing?.formatName(job.formatId) ?: "file", { onDetail(job.id) }, { model.dismissIsland(job.id) })
                }
            }
        }
    }
}

@Composable
fun ImportIslandCard(job: PersonalImportListing.Job, source: String, onDetail: () -> Unit, onDismiss: () -> Unit) {
    val c = BuddyBudgetTheme.colors
    val state = PersonalImportRules.islandState(job.status)
    val running = state == PersonalImportIslandState.Running
    val (titleText, detailText) = PersonalImportRules.islandText(job, source)
    val title = tr(titleText.template, titleText.values)
    val shape = RoundedCornerShape(18.dp)
    Row(
        Modifier.fillMaxWidth().bbShadow(BBShadow.xl, shape).background(c.islandBackground, shape)
            .padding(start = BBSpacing.space3, end = BBSpacing.space1, top = BBSpacing.space1, bottom = BBSpacing.space1),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(BBSpacing.space3),
    ) {
        Box(Modifier.size(24.dp), contentAlignment = Alignment.Center) {
            when {
                running -> BBSpinner(20.dp, c.islandForeground)
                job.status == "correction_ready" -> BBIconView(BBIcon.CircleAlert, size = 20.dp, color = c.primary)
                state == PersonalImportIslandState.Failed -> BBIconView(BBIcon.CircleAlert, size = 20.dp, color = c.islandNeg)
                else -> Box(Modifier.size(20.dp).background(c.islandPos, CircleShape), contentAlignment = Alignment.Center) {
                    BBIconView(BBIcon.Check, size = 14.dp, color = c.islandBackground)
                }
            }
        }
        Column(Modifier.weight(1f)) {
            if (running) ShimmerText(title, style = BBTextStyle.BodyStrong, color = c.islandForeground)
            else BBText(title, BBTextStyle.BodyStrong, color = c.islandForeground, maxLines = 1)
            BBText(tr(detailText.template, detailText.values), BBTextStyle.Caption, color = c.islandMuted, maxLines = 1)
        }
        Box(Modifier.heightIn(min = BBLayout.minTouchTarget).bbPressable(onDetail, CircleShape, translate = false), contentAlignment = Alignment.Center) {
            BBText(tr("Dettaglio"), BBTextStyle.BodyStrong,
                Modifier.background(if (running) Color.Transparent else c.islandForeground, CircleShape).padding(horizontal = BBSpacing.space3, vertical = 6.dp),
                color = if (running) c.islandMuted else c.islandBackground)
        }
        if (!running) {
            val label = tr("Chiudi riepilogo importazione")
            Box(Modifier.sizeIn(minWidth = BBLayout.minTouchTarget, minHeight = BBLayout.minTouchTarget).bbPressable(onDismiss, CircleShape, translate = false)
                .semantics { contentDescription = label }, contentAlignment = Alignment.Center) {
                BBIconView(BBIcon.X, size = 15.dp, color = c.islandMuted)
            }
        }
    }
}
