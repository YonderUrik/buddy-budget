package io.buddybudget.app.features.categories

import io.buddybudget.app.designsystem.components.BBKeyboard
import androidx.compose.runtime.key
import io.buddybudget.app.designsystem.components.LocalHideAmounts
import io.buddybudget.app.designsystem.components.LocalBBLocale
import io.buddybudget.core.domain.format.BBFormat
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
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
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import io.buddybudget.app.LocalEnv
import io.buddybudget.app.R
import io.buddybudget.app.designsystem.BuddyBudgetTheme
import io.buddybudget.app.designsystem.components.BBAlertSheet
import io.buddybudget.app.designsystem.components.BBBadge
import io.buddybudget.app.designsystem.components.BBBadgeVariant
import io.buddybudget.app.designsystem.components.BBButton
import io.buddybudget.app.designsystem.components.BBButtonSize
import io.buddybudget.app.designsystem.components.BBButtonVariant
import io.buddybudget.app.designsystem.components.BBCard
import io.buddybudget.app.designsystem.components.BBCardHeader
import io.buddybudget.app.designsystem.components.BBCardSize
import io.buddybudget.app.designsystem.components.BBChip
import io.buddybudget.app.designsystem.components.BBIconButton
import io.buddybudget.app.designsystem.components.BBIconSize
import io.buddybudget.app.designsystem.components.BBIconView
import io.buddybudget.app.designsystem.components.BBListRow
import io.buddybudget.app.designsystem.components.BBScreen
import io.buddybudget.app.designsystem.components.BBSheet
import io.buddybudget.app.designsystem.components.BBSkeleton
import io.buddybudget.app.designsystem.components.BBSkeletonRows
import io.buddybudget.app.designsystem.components.BBStyles
import io.buddybudget.app.designsystem.components.BBSwipeToDelete
import io.buddybudget.app.designsystem.components.BBText
import io.buddybudget.app.designsystem.components.BBTextField
import io.buddybudget.app.designsystem.components.BBToastKind
import io.buddybudget.app.designsystem.components.LoadError
import io.buddybudget.app.designsystem.components.LogoCredit
import io.buddybudget.app.designsystem.components.MerchantLogo
import io.buddybudget.app.designsystem.components.SegmentedControl
import io.buddybudget.app.designsystem.components.bbPressable
import io.buddybudget.app.designsystem.components.bbSwatch
import io.buddybudget.app.designsystem.generated.BBIcon
import io.buddybudget.app.designsystem.generated.BBMotion
import io.buddybudget.app.designsystem.generated.BBRadius
import io.buddybudget.app.designsystem.generated.BBSpacing
import io.buddybudget.app.designsystem.generated.BBSwatch
import io.buddybudget.app.designsystem.generated.BBTextStyle
import io.buddybudget.app.features.settings.Loadable
import io.buddybudget.app.features.shell.LocalShell
import io.buddybudget.app.features.shell.LocalShellBack
import io.buddybudget.app.generated.l10n
import io.buddybudget.app.tr
import io.buddybudget.core.data.CategorizationRule
import io.buddybudget.core.data.CategoryPatch
import io.buddybudget.core.data.CategoryType
import io.buddybudget.core.data.MovementCategory
import io.buddybudget.core.data.RuleMatchType
import io.buddybudget.core.data.RulePatch
import io.buddybudget.core.domain.format.JSNumber
import io.buddybudget.core.domain.transactions.CategoryBoard
import io.buddybudget.core.domain.transactions.CategoryBoardSection
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

enum class CategoriesTab { Categories, Rules }

/**
 * «Categorie e regole» (CAT-005…035), phone layout of the mobile notes: Categorie | Regole switch, the board as a vertical
 * list of section cards with wrapping tiles, the category detail and rule editor as sheets. iOS: CategoriesScreen.swift.
 */
@Composable
fun CategoriesScreen(initialTab: CategoriesTab = CategoriesTab.Categories) {
    val env = LocalEnv.current
    val shell = LocalShell.current
    val model = remember {
        CategoriesModel(env).also {
            it.onChanged = {
                shell.liquidity.refresh()
            }
        }
    }
    var tab by remember { mutableStateOf(initialTab) }
    var newRule by remember { mutableStateOf(false) }
    LaunchedEffect(shell.dataVersion) { model.load() }
    // Web: «Categorie e regole» is a Liquidità view, so the heading is the Liquidità views sheet with the yellow add
    // button; Categorie | Regole is an inline segmented control under it.
    BBScreen(null, onBack = LocalShellBack.current, onRefresh = { model.load() }) {
        Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space5)) {
            io.buddybudget.app.designsystem.components.SectionViewsHeading(
                l10n(R.string.cash_84f6d5),
                io.buddybudget.core.domain.shell.LiquiditySegment.entries.map { view ->
                    io.buddybudget.app.designsystem.components.SectionViewItem(view.name, tr(view.title), tr(view.viewDescription), BBIcon.forKey(view.iconKey)) {
                        shell.open(view.destination)
                    }
                } + io.buddybudget.app.designsystem.components.SectionViewItem(
                    "categorie", l10n(R.string.categories_and_rules_d6e929), tr("Gruppi di spesa e regole automatiche"), BBIcon.Tags, true,
                ) {},
                Modifier.padding(top = BBSpacing.space4),
            ) { io.buddybudget.app.features.liquidity.LiquidityAddButton(shell.liquidity) }
            SegmentedControl(
                listOf(CategoriesTab.Categories to l10n(R.string.categories_790d98), CategoriesTab.Rules to l10n(R.string.rules_527ecd)),
                tab, { tab = it },
            )
            if (tab == CategoriesTab.Categories) CategoryBoardView(model) else RulesView(model, newRule) { newRule = it }
        }
    }
}

// ---------------------------------------------------------------- Board

@Composable
private fun CategoryBoardView(model: CategoriesModel) {
    val c = BuddyBudgetTheme.colors
    var detail by remember { mutableStateOf<String?>(null) }
    var confirmColors by remember { mutableStateOf(false) }
    val failed = l10n(R.string.colour_assignment_failed_try_again_f6062d)
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space4)) {
        Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space1)) {
            BBText(l10n(R.string.your_categories_e0e705), style = BBStyles.sectionHeading)
            BBText(l10n(R.string.tap_a_category_to_edit_it_or_move_it_to_5e54fa), BBTextStyle.Body, color = c.mutedForeground)
        }
        BBButton(l10n(R.string.assign_colours_e7f274), { confirmColors = true }, icon = BBIcon.Palette, variant = BBButtonVariant.Outline, size = BBButtonSize.Sm)
        when (val state = model.categories) {
            Loadable.Loading -> Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
                repeat(3) { BBSkeleton(height = 140.dp, radius = BBRadius.xl) }
            }
            Loadable.Failed -> LoadError(l10n(R.string.unable_to_load_categories_c34e83), { model.launch { model.loadCategories() } })
            is Loadable.Loaded -> for (section in CategoryBoard.sections(state.value)) {
                androidx.compose.runtime.key(section.key) { SectionCard(model, section) { detail = it.id } }
            }
        }
    }
    var shownDetail by remember { mutableStateOf(detail) }
    if (detail != null) shownDetail = detail
    BBSheet(detail != null, { detail = null }) {
        shownDetail?.let { id -> androidx.compose.runtime.key(id) { CategoryDetailSheet(model, id) { detail = null } } }
    }
    BBAlertSheet(
        confirmColors, l10n(R.string.assign_colours_automatically_90de69), l10n(R.string.each_category_except_uncategorised_will_b2a5d6),
        l10n(R.string.distribute_7bcc99),
        onConfirm = { model.launch { if (!model.distributeColors()) model.env.toasts.show(BBToastKind.Error, failed) } },
        onDismiss = { confirmColors = false },
        confirmVariant = BBButtonVariant.Default, icon = BBIcon.Palette,
    )
}

/** Title of a board section (CAT-006). */
@Composable
fun boardSectionTitle(key: String): String = when (key) {
    "entrata" -> l10n(R.string.income_5a21be)
    "trasferimento" -> l10n(R.string.transfers_between_accounts_ae7760)
    "fallback" -> l10n(R.string.to_categorise_f267aa)
    else -> tr(CategoryType.entries.firstOrNull { it.raw == key }?.label ?: key)
}

/** Description of a board section (CAT-006). */
@Composable
fun boardSectionDescription(key: String): String = when (key) {
    "entrata" -> l10n(R.string.salary_refunds_and_all_other_income_c14185)
    "trasferimento" -> l10n(R.string.transfers_between_your_accounts_do_not_c_cc1668)
    "fallback" -> l10n(R.string.transactions_without_a_category_review_t_b9b8f1)
    else -> CategoryType.entries.firstOrNull { it.raw == key }?.groupDescription?.let { tr(it) } ?: ""
}

@Composable
private fun SectionCard(model: CategoriesModel, section: CategoryBoardSection, onOpen: (MovementCategory) -> Unit) {
    val c = BuddyBudgetTheme.colors
    val scope = rememberCoroutineScope()
    var adding by remember { mutableStateOf(false) }
    var name by remember { mutableStateOf("") }
    var error by remember { mutableStateOf<String?>(null) }
    fun submit(type: CategoryType) {
        if (JSNumber.trim(name).isEmpty()) {
            adding = false
            return
        }
        scope.launch {
            val result = model.create(name, type)
            if (result != null) {
                error = result
            } else {
                name = ""
                adding = false
            }
        }
    }
    // Web `CategoryGroupColumn`: a soft `--muted @ 40%` panel, header, then the categories as wrapping chips.
    Column(
        Modifier.fillMaxWidth().background(c.muted.copy(alpha = 0.4f), RoundedCornerShape(BBRadius.xl)).padding(BBSpacing.space4),
        verticalArrangement = Arrangement.spacedBy(BBSpacing.space3),
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space0_5)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
                Box(Modifier.size(10.dp).background(bbGroup(section.key), CircleShape))
                BBText(boardSectionTitle(section.key), BBTextStyle.CardTitle)
                BBText(section.categories.size.toString(), BBTextStyle.Caption, color = c.text3)
            }
            BBText(boardSectionDescription(section.key), BBTextStyle.Caption, color = c.mutedForeground)
        }
        CategoryChipsFlow {
            for (category in section.categories) {
                val editLabel = tr("Modifica {0}", mapOf("0" to category.name))
                Row(
                    Modifier.heightIn(min = 40.dp).alpha(if (category.id in model.pending) 0.5f else 1f)
                        .background(c.card, CircleShape).border(1.dp, c.border, CircleShape)
                        .bbPressable({ onOpen(category) }, CircleShape, translate = false)
                        .semantics(mergeDescendants = true) { contentDescription = editLabel }
                        .padding(start = BBSpacing.space1, end = BBSpacing.space3, top = BBSpacing.space1, bottom = BBSpacing.space1),
                    verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2),
                ) {
                    CategoryAvatar(category, 28.dp)
                    BBText(category.name, style = BBTextStyle.Body.style.copy(fontWeight = FontWeight.W500), maxLines = 1, modifier = Modifier.weight(1f, fill = false))
                    // CAT-101: the monthly budget, when set.
                    model.budgets[category.id]?.let { budget ->
                        val amount = BBFormat.formatCurrency(budget, model.env.session.currency, LocalBBLocale.current, maximumFractionDigits = 0, masked = LocalHideAmounts.current)
                        BBText(l10n(R.string.s_0_month_b9ba41, amount), style = BBTextStyle.Caption.style.copy(fontFeatureSettings = "tnum"), color = c.text2, maxLines = 1)
                    }
                    val count = model.usage[category.id] ?: 0
                    if (count > 0) BBText(count.toString(), style = BBTextStyle.Caption.style.copy(fontFeatureSettings = "tnum"), color = c.text3)
                }
            }
            if (section.addType != null && !adding) {
                Row(
                    Modifier.heightIn(min = 40.dp).dashedPill(c.border)
                        .bbPressable({ adding = true; error = null }, CircleShape, translate = false)
                        .padding(horizontal = BBSpacing.space3),
                    verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space1_5),
                ) {
                    BBIconView(BBIcon.Plus, size = 14.dp, color = c.mutedForeground)
                    BBText(l10n(R.string.add_83f510), BBTextStyle.Body, color = c.mutedForeground)
                }
            }
        }
        section.addType?.let { type ->
            if (adding) {
                BBTextField(
                    name, { name = it }, placeholder = l10n(R.string.name_then_enter_bf33f4), error = error, height = 44.dp,
                    onSubmit = { submit(type) }, autofocus = true,
                )
            }
        }
    }
}

/** Wrapping row of category chips (web `flex flex-wrap gap-2`). */
@OptIn(androidx.compose.foundation.layout.ExperimentalLayoutApi::class)
@Composable
private fun CategoryChipsFlow(content: @Composable () -> Unit) {
    androidx.compose.foundation.layout.FlowRow(horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2),
        verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) { content() }
}

/** 1 dp dashed capsule outline (the «+ Aggiungi» chip). */
private fun Modifier.dashedPill(color: androidx.compose.ui.graphics.Color) = drawBehind {
    val stroke = 1.dp.toPx()
    drawRoundRect(color, cornerRadius = androidx.compose.ui.geometry.CornerRadius(size.height / 2), style = androidx.compose.ui.graphics.drawscope.Stroke(stroke,
        pathEffect = androidx.compose.ui.graphics.PathEffect.dashPathEffect(floatArrayOf(3.dp.toPx(), 3.dp.toPx()))),
        topLeft = androidx.compose.ui.geometry.Offset(stroke / 2, stroke / 2), size = androidx.compose.ui.geometry.Size(size.width - stroke, size.height - stroke))
}

// ---------------------------------------------------------------- Category detail (CAT-014…022)

@Composable
private fun CategoryDetailSheet(model: CategoriesModel, categoryId: String, onClose: () -> Unit) {
    val c = BuddyBudgetTheme.colors
    val category = model.category(categoryId) ?: return
    val scope = rememberCoroutineScope()
    var name by remember { mutableStateOf(category.name) }
    var description by remember { mutableStateOf(category.description ?: "") }
    var nameError by remember { mutableStateOf<String?>(null) }
    var confirmDelete by remember { mutableStateOf(false) }
    var deleting by remember { mutableStateOf(false) }
    var deleteFailed by remember { mutableStateOf(false) }

    fun saveName() {
        val trimmed = JSNumber.trim(name)
        if (category.isFallback || trimmed.isEmpty() || trimmed == category.name) {
            name = category.name
            return
        }
        nameError = null
        scope.launch {
            model.update(category, CategoryPatch(name = trimmed))?.let {
                nameError = it
                name = category.name
            }
        }
    }

    fun saveDescription() {
        val trimmed = JSNumber.trim(description)
        if (category.isFallback || trimmed == (category.description ?: "")) return
        scope.launch { model.update(category, CategoryPatch(description = trimmed)) }
    }

    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space5)) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
            CategoryAvatar(category, 44.dp)
            Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                BBText(category.name, BBTextStyle.CardTitle, maxLines = 2)
                val count = model.usage[category.id] ?: 0
                BBText(
                    if (count > 0) l10n(R.string.s_0_transactions_in_the_last_year_5fe23f, count.toString())
                    else l10n(R.string.no_transactions_in_the_last_year_f2a749),
                    BBTextStyle.Caption, color = c.text2,
                )
            }
        }
        BBTextField(
            name, { name = it }, label = l10n(R.string.name_13030d), error = nameError, enabled = !category.isFallback, height = 44.dp,
            onSubmit = { saveName() },
        )
        if (!category.isFallback) {
            Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space1_5)) {
                BBTextField(
                    description, { description = it.take(120) }, label = l10n(R.string.what_belongs_here_optional_9ea18a),
                    placeholder = l10n(R.string.e_g_supermarket_groceries_ecb0e8), height = 44.dp, onSubmit = { saveDescription() },
                )
                BBText(l10n(R.string.help_the_assistant_suggest_this_category_b4f74f), BBTextStyle.Caption, color = c.text3)
            }
            Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
                BBText(l10n(R.string.group_6f8314), BBTextStyle.BodyStrong)
                FlowChips(CategoryType.selectable, category.type, { tr(it.label) }) { type ->
                    model.launch { model.update(category, CategoryPatch(type = type)) }
                }
            }
            if (io.buddybudget.core.domain.transactions.CategoryBudgetField.appliesTo(category.type, category.isFallback)) {
                key(category.id) { CategoryBudgetFieldView(model, category) }
            }
        }
        Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
            BBText(l10n(R.string.colour_46db16), BBTextStyle.BodyStrong)
            Grid8(BBSwatch.pickerKeys) { key ->
                val selected = category.color == key
                Box(
                    Modifier.size(34.dp)
                        .border(2.dp, if (selected) c.foreground else Color.Transparent, CircleShape)
                        .padding(3.dp)
                        .background(bbSwatch(key), CircleShape)
                        .bbPressable({ model.launch { model.update(category, CategoryPatch(color = key)) } }, CircleShape, translate = false)
                        .semantics {
                            contentDescription = key
                            this.selected = selected
                        },
                )
            }
        }
        Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
            BBText(l10n(R.string.icon_15cb8b), BBTextStyle.BodyStrong)
            Grid8(BBIcon.categoryKeys) { key ->
                val selected = category.icon == key
                val color = bbSwatch(category.color)
                val shape = RoundedCornerShape(BBRadius.md)
                Box(
                    Modifier.size(36.dp)
                        .background(if (selected) color.copy(alpha = 0.16f) else Color.Transparent, shape)
                        .border(1.5.dp, if (selected) color else Color.Transparent, shape)
                        .bbPressable({ model.launch { model.update(category, CategoryPatch(icon = key)) } }, shape, translate = false)
                        .semantics { contentDescription = key },
                    contentAlignment = Alignment.Center,
                ) { BBIconView(BBIcon.category(key), size = BBIconSize.Lg.dp, color = if (selected) color else c.text2) }
            }
        }
        if (!category.isFallback) {
            if (confirmDelete) {
                Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
                    BBText(l10n(R.string.linked_transactions_become_uncategorised_20e51c), BBTextStyle.Body, color = c.text2)
                    if (deleteFailed) BBText(l10n(R.string.deletion_failed_try_again_80c7e8), BBTextStyle.Body, color = c.destructive)
                    Row(horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
                        BBButton(l10n(R.string.cancel_6c3de5), { confirmDelete = false }, Modifier.weight(1f), variant = BBButtonVariant.Outline,
                            size = BBButtonSize.Touch, fullWidth = true)
                        BBButton(
                            if (deleting) l10n(R.string.deleting_159671) else l10n(R.string.delete_category_a7e1d9), {
                                deleting = true
                                deleteFailed = false
                                scope.launch {
                                    val ok = model.delete(category)
                                    deleting = false
                                    if (ok) onClose() else deleteFailed = true
                                }
                            },
                            Modifier.weight(1f), variant = BBButtonVariant.Destructive, size = BBButtonSize.Touch, fullWidth = true, isLoading = deleting,
                        )
                    }
                }
            } else {
                BBButton(l10n(R.string.delete_category_a7e1d9), { confirmDelete = true }, icon = BBIcon.Trash2, variant = BBButtonVariant.Destructive,
                    size = BBButtonSize.Touch, fullWidth = true)
            }
        }
        BBButton(l10n(R.string.done_33cad7), {
            saveName()
            saveDescription()
            onClose()
        }, variant = BBButtonVariant.Outline, size = BBButtonSize.Touch, fullWidth = true)
    }
}

/** CAT-099/100: «Budget al mese (facoltativo)», saved when the field loses focus; emptied removes it. */
@Composable
private fun CategoryBudgetFieldView(model: CategoriesModel, category: MovementCategory) {
    val c = BuddyBudgetTheme.colors
    val locale = LocalBBLocale.current
    val scope = rememberCoroutineScope()
    val saved = model.budgets[category.id]
    var text by remember(saved) { mutableStateOf(io.buddybudget.core.domain.transactions.CategoryBudgetField.inputText(saved, locale)) }
    var error by remember { mutableStateOf<String?>(null) }
    fun commit() {
        val outcome = io.buddybudget.core.domain.transactions.CategoryBudgetField.commit(text, saved, locale)
        scope.launch {
            val problem = model.saveBudget(category, outcome)
            error = problem
            if (problem != null && outcome !is io.buddybudget.core.domain.transactions.CategoryBudgetField.Outcome.Invalid) {
                text = io.buddybudget.core.domain.transactions.CategoryBudgetField.inputText(saved, locale)
            }
        }
    }
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space1_5)) {
        BBTextField(
            text, { text = it; error = null }, label = l10n(R.string.monthly_budget_optional_b04b63),
            placeholder = l10n(R.string.no_budget_2ea397), keyboard = BBKeyboard.Amount,
            prefix = io.buddybudget.core.domain.shell.LocaleRules.currencySymbol(model.env.session.currency), height = 44.dp,
            onSubmit = { commit() }, onBlur = { commit() },
        )
        if (error != null) BBText(error!!, BBTextStyle.Caption, color = c.destructive)
        else BBText(l10n(R.string.leave_it_empty_for_no_limit_you_see_it_i_1ca260), BBTextStyle.Caption, color = c.text3)
    }
}

/** 8 equal columns, centered cells. */
@Composable
private fun <T> Grid8(items: List<T>, cell: @Composable (T) -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
        for (row in items.chunked(8)) {
            Row(horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
                for (item in row) Box(Modifier.weight(1f), contentAlignment = Alignment.Center) { cell(item) }
                repeat(8 - row.size) { Spacer(Modifier.weight(1f)) }
            }
        }
    }
}

/** Wrapping single-choice chips (group selector): two columns. */
@Composable
fun <T> FlowChips(items: List<T>, selected: T?, label: @Composable (T) -> String, onSelect: (T) -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
        for (row in items.chunked(2)) {
            Row(horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
                for (item in row) Box(Modifier.weight(1f)) { BBChip(label(item), isSelected = item == selected) { onSelect(item) } }
                repeat(2 - row.size) { Spacer(Modifier.weight(1f)) }
            }
        }
    }
}

// ---------------------------------------------------------------- Rules (CAT-025…035)

@Composable
private fun RulesView(model: CategoriesModel, newRule: Boolean, onNewRule: (Boolean) -> Unit) {
    val c = BuddyBudgetTheme.colors
    val scope = rememberCoroutineScope()
    var editing by remember { mutableStateOf<CategorizationRule?>(null) }
    var deleting by remember { mutableStateOf<CategorizationRule?>(null) }
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space4)) {
        Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space1)) {
            BBText(l10n(R.string.automatic_rules_0ea888), style = BBStyles.sectionHeading)
            BBText(l10n(R.string.rules_automatically_assign_categories_to_eb2254), BBTextStyle.Body, color = c.mutedForeground)
        }
        BBCard(size = BBCardSize.Sm) {
            BBCardHeader(l10n(R.string.categorisation_rules_a22d8a), l10n(R.string.rules_apply_automatically_to_new_transac_8cf2be), BBCardSize.Sm)
            BBButton(l10n(R.string.add_rule_e46fb4), { onNewRule(true) }, icon = BBIcon.Plus, size = BBButtonSize.Sm)
        }
        when (val state = model.rules) {
            Loadable.Loading -> BBSkeletonRows(4)
            Loadable.Failed -> LoadError(l10n(R.string.could_not_load_rules_bcd5c9), { model.launch { model.loadRules() } })
            is Loadable.Loaded -> if (state.value.isEmpty()) {
                BBText(l10n(R.string.no_rules_yet_create_rules_when_categoris_f44fba), BBTextStyle.Body, color = c.mutedForeground)
            } else {
                Column {
                    for (rule in state.value.sortedByDescending { it.hitCount }) {
                        androidx.compose.runtime.key(rule.id) {
                            BBSwipeToDelete({ deleting = rule }) { RuleRow(model, rule) { editing = rule } }
                        }
                    }
                }
                if (model.remoteLogoShown) LogoCredit()
            }
        }
    }
    val open = editing != null || newRule
    var shownRule by remember { mutableStateOf(editing) }
    if (open) shownRule = editing
    BBSheet(
        open, {
            editing = null
            onNewRule(false)
        },
        if (shownRule == null) l10n(R.string.new_rule_f92fd8) else l10n(R.string.edit_rule_d103e5),
    ) {
        androidx.compose.runtime.key(shownRule?.id ?: "new") {
            RuleSheet(model, shownRule, onDelete = { rule ->
                editing = null
                scope.launch {
                    delay(BBMotion.durationSheetExit.toLong() + 50)
                    deleting = rule
                }
            }) {
                editing = null
                onNewRule(false)
            }
        }
    }
    var lastDeleting by remember { mutableStateOf(deleting) }
    if (deleting != null) lastDeleting = deleting
    BBAlertSheet(
        deleting != null, l10n(R.string.delete_this_rule_b9b63a),
        l10n(R.string.the_pattern_0_will_no_longer_be_applied_57982a, lastDeleting?.pattern ?: ""), l10n(R.string.delete_6b177b),
        onConfirm = { lastDeleting?.let { rule -> model.launch { model.deleteRule(rule) } } },
        onDismiss = { deleting = null }, icon = BBIcon.Trash2,
    )
}

@Composable
private fun RuleRow(model: CategoriesModel, rule: CategorizationRule, onTap: () -> Unit) {
    val c = BuddyBudgetTheme.colors
    val category = model.category(rule.categoryId)
    BBListRow(
        rule.pattern,
        subtitle = "${tr(rule.matchType.label)} · ${rule.categoryName ?: category?.name ?: ""}",
        onClick = onTap,
        leading = {
            val logo = rule.logoPath
            if (logo != null) MerchantLogo(rule.pattern, logoPath = logo, onRemoteLogo = { model.remoteLogoShown = true }) else CategoryAvatar(category)
        },
        trailing = {
            Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(BBSpacing.space1)) {
                BBBadge(if (rule.isLearned) l10n(R.string.learned_98a790) else l10n(R.string.manual_58ab84), variant = BBBadgeVariant.Outline)
                BBText(l10n(R.string.used_0_times_033448, rule.hitCount.toString()), BBTextStyle.Caption, color = c.text3)
            }
        },
    )
}

/** New rule (CAT-030) or edit (CAT-027): pattern, type, category; save; delete for an existing rule. */
@Composable
private fun RuleSheet(model: CategoriesModel, rule: CategorizationRule?, onDelete: (CategorizationRule) -> Unit, onClose: () -> Unit) {
    val c = BuddyBudgetTheme.colors
    val scope = rememberCoroutineScope()
    val options = model.list.filterNot { it.isFallback }
    var pattern by remember { mutableStateOf(rule?.pattern ?: "") }
    var matchType by remember { mutableStateOf(rule?.matchType ?: RuleMatchType.contains) }
    var categoryId by remember { mutableStateOf(rule?.categoryId ?: options.firstOrNull()?.id) }
    var picking by remember { mutableStateOf(false) }
    var saving by remember { mutableStateOf(false) }
    var patternError by remember { mutableStateOf<String?>(null) }
    var categoryError by remember { mutableStateOf<String?>(null) }
    var formError by remember { mutableStateOf<String?>(null) }
    val patternRequired = l10n(R.string.pattern_is_required_6d7594)
    val selectCategory = l10n(R.string.select_a_category_c2ab97)

    fun save() {
        patternError = if (JSNumber.trim(pattern).isEmpty()) patternRequired else null
        categoryError = if (categoryId == null) selectCategory else null
        val id = categoryId
        if (patternError != null || categoryError != null || id == null) return
        saving = true
        formError = null
        scope.launch {
            val error = if (rule != null) {
                val patch = RulePatch(
                    pattern = JSNumber.trim(pattern).takeIf { it != rule.pattern },
                    matchType = matchType.takeIf { it != rule.matchType },
                    categoryId = id.takeIf { it != rule.categoryId },
                )
                if (patch == RulePatch()) null else model.updateRule(rule, patch)
            } else {
                model.createRule(pattern, matchType, id)
            }
            saving = false
            if (error != null) formError = error else onClose()
        }
    }

    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space4)) {
        if (picking) {
            BBButton(l10n(R.string.back_83c968), { picking = false }, icon = BBIcon.ChevronLeft, variant = BBButtonVariant.Ghost, size = BBButtonSize.Sm)
            CategorySheetContent(options, model.usage, onPick = { picked ->
                categoryId = picked.id
                categoryError = null
                picking = false
            }, selectedId = categoryId)
        } else {
            BBTextField(pattern, { pattern = it }, label = l10n(R.string.pattern_1fff6a), placeholder = l10n(R.string.e_g_supermarket_6419f6),
                error = patternError, height = 44.dp)
            Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
                BBText(l10n(R.string.type_6cc619), style = BBTextStyle.BodyStrong.style.copy(lineHeight = 14.sp))
                SegmentedControl(
                    listOf(RuleMatchType.merchant to l10n(R.string.exact_48e0a8), RuleMatchType.contains to l10n(R.string.contains_ac9430)),
                    matchType, { matchType = it }, stretch = true,
                )
            }
            Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
                BBText(l10n(R.string.category_5966b0), style = BBTextStyle.BodyStrong.style.copy(lineHeight = 14.sp))
                val category = model.category(categoryId)
                val shape = RoundedCornerShape(BBRadius.lg)
                Row(
                    Modifier.fillMaxWidth().height(44.dp)
                        .border(1.dp, if (categoryError != null) c.destructive else c.input, shape)
                        .bbPressable({ picking = true }, shape, translate = false)
                        .padding(horizontal = BBSpacing.space3),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(BBSpacing.space3),
                ) {
                    CategoryAvatar(category, 28.dp)
                    BBText(category?.name ?: selectCategory, BBTextStyle.BodyLarge, Modifier.weight(1f), maxLines = 1)
                    BBIconView(BBIcon.ChevronDown, color = c.mutedForeground)
                }
                categoryError?.let { BBText(it, BBTextStyle.Body, color = c.destructive) }
            }
            formError?.let { BBText(it, BBTextStyle.Body, color = c.destructive) }
            BBButton(
                if (rule == null) (if (saving) l10n(R.string.adding_91047c) else l10n(R.string.add_rule_e46fb4))
                else (if (saving) l10n(R.string.saving_f71782) else l10n(R.string.save_c5965d)),
                { save() }, size = BBButtonSize.Touch, fullWidth = true, isLoading = saving,
            )
            if (rule != null) {
                BBButton(l10n(R.string.delete_rule_c6bf29), { onDelete(rule) }, icon = BBIcon.Trash2, variant = BBButtonVariant.Destructive,
                    size = BBButtonSize.Touch, fullWidth = true)
            }
        }
    }
}
