package io.buddybudget.app.features.planningde

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import io.buddybudget.app.designsystem.BuddyBudgetTheme
import io.buddybudget.app.designsystem.components.BBButton
import io.buddybudget.app.designsystem.components.BBButtonSize
import io.buddybudget.app.designsystem.components.BBButtonVariant
import io.buddybudget.app.designsystem.components.BBCard
import io.buddybudget.app.designsystem.components.BBCheckbox
import io.buddybudget.app.designsystem.components.BBErrorBox
import io.buddybudget.app.designsystem.components.BBIconSize
import io.buddybudget.app.designsystem.components.BBIconView
import io.buddybudget.app.designsystem.components.BBKeyboard
import io.buddybudget.app.designsystem.components.BBSelect
import io.buddybudget.app.designsystem.components.BBSeparator
import io.buddybudget.app.designsystem.components.BBSkeleton
import io.buddybudget.app.designsystem.components.BBStyles
import io.buddybudget.app.designsystem.components.BBText
import io.buddybudget.app.designsystem.components.BBTextField
import io.buddybudget.app.designsystem.components.LoadError
import io.buddybudget.app.designsystem.components.LocalBBLocale
import io.buddybudget.app.designsystem.components.bbPressable
import io.buddybudget.app.designsystem.generated.BBIcon
import io.buddybudget.app.designsystem.generated.BBLayout
import io.buddybudget.app.designsystem.generated.BBRadius
import io.buddybudget.app.designsystem.generated.BBSpacing
import io.buddybudget.app.designsystem.generated.BBTextStyle
import io.buddybudget.app.features.auth.openUrl
import io.buddybudget.app.tr
import io.buddybudget.core.data.PlanningResults
import io.buddybudget.core.domain.format.BBFormat
import io.buddybudget.core.domain.planningde.GermanPlanEditor
import io.buddybudget.core.domain.planningde.GermanPlanMessage
import io.buddybudget.core.domain.planningde.GermanPlanningOption
import io.buddybudget.core.domain.planningde.GermanPlanningRow
import io.buddybudget.core.domain.planningde.GermanPlanningText
import io.buddybudget.core.domain.planningde.PlanningNumberInput

// Building blocks of the German planning screens (web `fields.tsx`, `planning-screen.tsx`): panel, result row, numeric
// field with clamping, checkbox row, disclosure, save bar, footer. Twin: GermanPlanningComponents.swift.

/** Web `Panel`: card with a section title. */
@Composable
fun PlanningPanel(title: String, content: @Composable ColumnScope.() -> Unit) {
    BBCard {
        BBText(title, Modifier.semantics { heading() }, BBStyles.sectionHeading)
        content()
    }
}

/** Muted explanatory paragraph (web `text-sm text-muted-foreground`). */
@Composable
fun PlanningNote(text: String) {
    BBText(text, BBTextStyle.Body, Modifier.fillMaxWidth(), color = BuddyBudgetTheme.colors.mutedForeground)
}

/** Web `Result`: label left, amount right. */
@Composable
fun PlanningResultRow(row: GermanPlanningRow, muted: Boolean = false) {
    val c = BuddyBudgetTheme.colors
    Row(Modifier.fillMaxWidth().padding(vertical = BBSpacing.space2).semantics(mergeDescendants = true) {},
        horizontalArrangement = Arrangement.spacedBy(BBSpacing.space4)) {
        BBText(row.label, BBTextStyle.Body, Modifier.weight(1f))
        BBText(row.value, Modifier, BBTextStyle.Body.style.copy(fontFeatureSettings = "tnum", textAlign = TextAlign.End),
            color = if (muted) c.mutedForeground else c.foreground)
    }
}

/**
 * Web `NumberField` (PLAN-015): decimal keypad, values clamped as typed (the text is replaced by the limit), empty = 0,
 * the minimum shown as helper text.
 */
@Composable
fun PlanningNumberField(
    label: String,
    value: Double,
    min: Double = 0.0,
    max: Double = PlanningNumberInput.DEFAULT_MAX,
    onChange: (Double) -> Unit,
) {
    val locale = LocalBBLocale.current
    var text by remember { mutableStateOf<String?>(null) }
    LaunchedEffect(value) {
        // Discard / reload / save: show the stored value unless the typed text already means it.
        val typed = text
        if (typed != null && PlanningNumberInput.value(typed, min, max) != value) text = null
    }
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space1_5)) {
        BBTextField(text ?: PlanningNumberInput.text(value, locale), { typed ->
            if (PlanningNumberInput.needsClamp(typed, min, max)) {
                val clamped = PlanningNumberInput.value(typed, min, max)
                text = PlanningNumberInput.text(clamped, locale)
                onChange(clamped)
            } else {
                text = typed
                onChange(PlanningNumberInput.value(typed, min, max))
            }
        }, label = label, keyboard = BBKeyboard.Amount)
        BBText(tr("Min. {0}", mapOf("0" to BBFormat.formatCurrency(min, GermanPlanningText.CURRENCY, locale, maximumFractionDigits = 0))),
            BBTextStyle.Caption, color = BuddyBudgetTheme.colors.mutedForeground)
    }
}

/** Web `Choice`: native picker (sheet) with translated labels and stable stored values. */
@Composable
fun PlanningChoice(label: String, options: List<GermanPlanningOption>, value: String, onChange: (String) -> Unit) {
    BBSelect(options.map { it.value to it.label }, value, onChange, label = label)
}

/** Checkbox with its sentence (the whole row toggles). */
@Composable
fun PlanningCheckRow(label: String, checked: Boolean, onChange: (Boolean) -> Unit) {
    Row(
        Modifier.fillMaxWidth()
            .bbPressable({ onChange(!checked) }, RoundedCornerShape(BBRadius.md), translate = false, role = Role.Checkbox)
            .semantics(mergeDescendants = true) {
                contentDescription = label
                stateDescription = if (checked) "1" else "0"
            },
        horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2),
    ) {
        Box(Modifier.padding(top = 2.dp)) { BBCheckbox(checked, { onChange(it) }, accessibilityLabel = label) }
        BBText(label, BBTextStyle.Body, Modifier.weight(1f))
    }
}

/** Web `<details>`: a disclosure row with a chevron. */
@Composable
fun PlanningDisclosure(title: String, content: @Composable ColumnScope.() -> Unit) {
    // DEBUG `bbSheet=open`: disclosures start open (screenshots of the expanded lists).
    var open by remember { mutableStateOf(io.buddybudget.app.debug.DebugLaunch.sheet == "open") }
    val c = BuddyBudgetTheme.colors
    Column {
        Row(
            Modifier.fillMaxWidth().heightIn(min = BBLayout.minTouchTarget)
                .bbPressable({ open = !open }, RoundedCornerShape(BBRadius.md), translate = false)
                .semantics { stateDescription = if (open) "1" else "0" },
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2),
        ) {
            BBIconView(BBIcon.ChevronRight, Modifier.rotate(if (open) 90f else 0f), BBIconSize.Md.dp, c.mutedForeground)
            BBText(title, BBTextStyle.BodyStrong, Modifier.weight(1f))
        }
        AnimatedVisibility(open) { Column { content() } }
    }
}

/** Bulleted line (web `list-disc`). */
@Composable
fun PlanningBullet(text: String) {
    Row(horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
        Box(Modifier.padding(top = 8.dp).size(4.dp).background(BuddyBudgetTheme.colors.foreground, CircleShape))
        BBText(text, BBTextStyle.Body, Modifier.weight(1f))
    }
}

/** PLAN-017: disclaimer and the official sources (open in the browser). */
@Composable
fun PlanningFooter() {
    val c = BuddyBudgetTheme.colors
    val context = LocalContext.current
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
        BBText(tr("Planning estimates for German residents holding private assets. Results depend on complete records and your assumptions; they do not replace a tax return or pension statement."),
            BBTextStyle.Caption, color = c.mutedForeground)
        PlanningDisclosure(tr("Rules and official sources")) {
            Column(Modifier.padding(start = BBSpacing.space6)) {
                GermanPlanningText.sources.forEach { source ->
                    Row(
                        Modifier.fillMaxWidth().heightIn(min = BBLayout.minTouchTarget)
                            .bbPressable({ openUrl(context, source.url) }, RoundedCornerShape(BBRadius.md), translate = false),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2),
                    ) {
                        BBText(source.label, BBTextStyle.Body, color = c.primary)
                        BBIconView(BBIcon.ExternalLink, size = BBIconSize.Sm.dp, color = c.primary)
                    }
                }
            }
        }
    }
}

/**
 * PLAN-010…013 messages (web `role="alert"` lines) shown in the bottom save bar, next to the button they explain: save
 * failure / conflict (with «Reload»), invalid plan.
 */
@Composable
fun PlanningMessages(model: GermanPlanningModel, editor: GermanPlanEditor) {
    val message = editor.message
    if (message != null) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
            BBErrorBox(tr(message.key), Modifier.weight(1f))
            if (message == GermanPlanMessage.CONFLICT) {
                BBButton(tr("Reload"), { model.reloadPrompt = true }, icon = BBIcon.RefreshCw, variant = BBButtonVariant.Outline, size = BBButtonSize.Sm)
            }
        }
    }
    editor.validationKey?.let { BBErrorBox(tr(it)) }
}

/** Bottom save bar (mobile adaptation of the web sticky bar, PLAN-010): status and `Save plan`. */
@Composable
fun GermanPlanSaveBar(model: GermanPlanningModel) {
    val editor = model.editor ?: return
    if (model.phase != GermanPlanningModel.Phase.LOADED) return
    val c = BuddyBudgetTheme.colors
    Column(Modifier.fillMaxWidth().background(c.background)) {
        BBSeparator()
        if (editor.message != null || editor.validationKey != null) {
            Column(Modifier.padding(start = BBSpacing.space4, end = BBSpacing.space4, top = BBSpacing.space3),
                verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) { PlanningMessages(model, editor) }
        }
        Row(
            Modifier.fillMaxWidth().padding(horizontal = BBSpacing.space4, vertical = BBSpacing.space3),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(BBSpacing.space3),
        ) {
            BBText(tr(editor.statusKey), BBTextStyle.Body, Modifier.weight(1f), color = if (editor.isDirty) c.foreground else c.mutedForeground)
            BBButton(tr(editor.buttonKey), { model.launch { model.save() } }, isLoading = editor.saving, enabled = editor.canSave)
        }
    }
}

/** Loading / error / unsupported currency around a planning screen (PLAN-007, PLAN-009). */
@Composable
fun GermanPlanningContainer(
    model: GermanPlanningModel,
    title: String,
    content: @Composable ColumnScope.(GermanPlanEditor, PlanningResults) -> Unit,
) {
    LaunchedEffect(Unit) { model.start() }
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space6)) {
        BBText(title, Modifier.semantics { heading() }, BBStyles.sectionHeading)
        when (model.phase) {
            GermanPlanningModel.Phase.LOADING -> Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space6)) {
                BBSkeleton(height = 288.dp, radius = BBRadius.xl)
                BBSkeleton(height = 160.dp, radius = BBRadius.xl)
            }
            GermanPlanningModel.Phase.FAILED -> LoadError(tr("Could not load the plan."), { model.retry() })
            GermanPlanningModel.Phase.LOADED -> {
                val editor = model.editor
                val results = model.savedResults
                if (editor != null && results != null) {
                    if (results.supported) {
                        content(editor, results)
                        PlanningFooter()
                    } else {
                        PlanningNote(tr("German financial planning currently requires account currency EUR. Your saved data has not been changed."))
                    }
                }
            }
        }
    }
}

/** The unsaved-changes sheet content (mobile adaptation, 13-planning-de): save, discard or stay. */
@Composable
fun UnsavedPlanSheetContent(model: GermanPlanningModel) {
    val c = BuddyBudgetTheme.colors
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space4)) {
        BBText(tr("Save your changes to the plan before leaving?"), BBTextStyle.Body, color = c.mutedForeground)
        Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
            BBButton(tr("Save plan"), { model.launch { model.resolveLeave(save = true) } }, size = BBButtonSize.Touch, fullWidth = true,
                isLoading = model.editor?.saving ?: false, enabled = model.editor?.canSave ?: false)
            BBButton(tr("Discard changes"), { model.launch { model.resolveLeave(save = false) } }, variant = BBButtonVariant.Outline,
                size = BBButtonSize.Touch, fullWidth = true)
            BBButton(tr("Annulla"), { model.pendingLeave = null }, variant = BBButtonVariant.Ghost, size = BBButtonSize.Touch, fullWidth = true)
        }
    }
}
