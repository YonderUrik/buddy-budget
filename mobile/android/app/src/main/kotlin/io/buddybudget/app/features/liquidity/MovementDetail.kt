package io.buddybudget.app.features.liquidity

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import io.buddybudget.app.AppEnvironment
import io.buddybudget.app.R
import io.buddybudget.app.designsystem.BuddyBudgetTheme
import io.buddybudget.app.designsystem.components.AmountText
import io.buddybudget.app.designsystem.components.BBAlertSheet
import io.buddybudget.app.designsystem.components.BBButton
import io.buddybudget.app.designsystem.components.BBButtonSize
import io.buddybudget.app.designsystem.components.BBButtonVariant
import io.buddybudget.app.designsystem.components.BBIconView
import io.buddybudget.app.designsystem.components.BBSheet
import io.buddybudget.app.designsystem.components.BBSkeleton
import io.buddybudget.app.designsystem.components.BBStyles
import io.buddybudget.app.designsystem.components.BBText
import io.buddybudget.app.designsystem.components.BBTextArea
import io.buddybudget.app.designsystem.components.BBToastKind
import io.buddybudget.app.designsystem.components.LocalBBLocale
import io.buddybudget.app.designsystem.components.MerchantLogo
import io.buddybudget.app.designsystem.components.MerchantLogoSize
import io.buddybudget.app.designsystem.components.bbPressable
import io.buddybudget.app.designsystem.generated.BBIcon
import io.buddybudget.app.designsystem.generated.BBRadius
import io.buddybudget.app.designsystem.generated.BBSpacing
import io.buddybudget.app.designsystem.generated.BBTextStyle
import io.buddybudget.app.features.categories.CategoryAvatar
import io.buddybudget.app.features.categories.BBSwitchRow
import io.buddybudget.app.features.categories.CategorySheetContent
import io.buddybudget.app.features.help.showError
import io.buddybudget.app.generated.L10n
import io.buddybudget.app.generated.LocalStrings
import io.buddybudget.app.generated.l10n
import io.buddybudget.core.data.AiCategorizationState
import io.buddybudget.core.data.ApiError
import io.buddybudget.core.data.Movement
import io.buddybudget.core.data.MovementCategory
import io.buddybudget.core.data.MovementDetail
import io.buddybudget.core.data.RuleCreateBody
import io.buddybudget.core.data.RuleMatchType
import io.buddybudget.core.data.TransactionOrigin
import io.buddybudget.core.data.TransactionPatch
import io.buddybudget.core.designsystem.AmountTone
import io.buddybudget.core.domain.format.BBDateSkeleton
import io.buddybudget.core.domain.format.BBFormat
import io.buddybudget.core.domain.periods.CalendarDate
import io.buddybudget.core.domain.transactions.CategoryRules
import io.buddybudget.core.domain.transactions.MovementDetailText
import io.buddybudget.core.domain.transactions.MovementEdit
import io.buddybudget.core.domain.transactions.MovementKind
import kotlinx.coroutines.MainScope
import kotlinx.coroutines.async
import kotlinx.coroutines.launch

/** Which movement the detail sheet shows; `placeholder` is the row the list already has (TX-064). */
data class MovementDetailRequest(val id: String, val placeholder: Movement? = null)

/**
 * State of the movement detail (TX-064…073, web #455): the movement with origin, account, rule and merchant summary,
 * the categories it can take, the AI setting and every action on it. One instance per opened movement; another
 * movement of the same merchant replaces it in place. Same fields as `MovementDetailModel` on iOS.
 */
class MovementDetailModel(val env: AppEnvironment, request: MovementDetailRequest, private val openSettings: () -> Unit) {
    enum class Mode { Detail, Split, Edit }
    enum class LoadFailure { NotFound, Failed }
    enum class NoteStatus { Saving, Saved, Failed }

    var id by mutableStateOf(request.id)
        private set
    var detail by mutableStateOf(request.placeholder?.let { MovementDetail(it) })
        private set
    /** The row came from a list and origin, account and merchant are still arriving. */
    var partial by mutableStateOf(request.placeholder != null)
        private set
    var failure by mutableStateOf<LoadFailure?>(null)
        private set
    var categories by mutableStateOf<List<MovementCategory>>(emptyList())
        private set
    var usage by mutableStateOf<Map<String, Int>>(emptyMap())
        private set
    var ai by mutableStateOf<AiCategorizationState?>(null)
        private set
    var mode by mutableStateOf(Mode.Detail)
    var noteStatus by mutableStateOf<NoteStatus?>(null)
        private set
    var asking by mutableStateOf(false)
        private set
    var aiAnswer by mutableStateOf<MovementDetailText.AiAnswer?>(null)
    var deleting by mutableStateOf(false)
        private set
    /** Something changed: the lists behind reload when the sheet closes. */
    var dirty = false
        private set
    var remoteLogoShown by mutableStateOf(false)

    private val scope = MainScope()
    private var generation = 0

    val movement: Movement? get() = detail?.transaction
    val currency: String get() = env.session.currency
    fun category(id: String?): MovementCategory? = categories.firstOrNull { it.id == id }

    /** Categories the movement can take (fallback, transfers, same direction — TX-028). */
    val selectable: List<MovementCategory>
        get() = movement?.let { CategoryRules.pickerCategories(categories, it.amount) } ?: emptyList()

    fun launch(block: suspend () -> Unit) {
        scope.launch { block() }
    }

    suspend fun start() {
        val meta = scope.async { loadMeta() }
        load()
        meta.await()
    }

    private suspend fun loadMeta() {
        val c = scope.async { runCatching { env.categoriesApi.list() }.getOrNull() }
        val u = scope.async { runCatching { env.categoriesApi.usage() }.getOrNull() }
        val a = scope.async { runCatching { env.user.aiCategorization() }.getOrNull() }
        c.await()?.let { categories = it }
        u.await()?.let { usage = it }
        ai = a.await()
    }

    /** TX-064/072. */
    suspend fun load() {
        generation += 1
        val current = generation
        failure = null
        try {
            val loaded = env.transactions.detail(id)
            if (current != generation) return
            detail = loaded
            partial = false
        } catch (e: Exception) {
            if (current != generation) return
            failure = if ((e as? ApiError.Http)?.body?.status == 404) LoadFailure.NotFound else LoadFailure.Failed
        }
    }

    /** TX-071: another movement of the same merchant opens in the same sheet. */
    fun open(otherId: String) {
        id = otherId
        detail = null
        partial = false
        mode = Mode.Detail
        noteStatus = null
        aiAnswer = null
        scope.launch { load() }
    }

    private suspend fun patch(body: TransactionPatch): Movement? {
        val current = movement ?: return null
        return try {
            val updated = env.transactions.update(current.id, body).copy(logoPath = current.logoPath)
            detail = detail?.copy(transaction = updated)
            dirty = true
            updated
        } catch (e: Exception) {
            null
        }
    }

    /** TX-067 (same flow as the row, TX-030/031): toast with undo, optional merchant rule. */
    suspend fun changeCategory(category: MovementCategory, remember: Boolean) {
        val current = movement ?: return
        if (category.id == current.categoryId) return
        val strings = env.session.strings()
        val previous = current.categoryId
        aiAnswer = null
        if (patch(TransactionPatch(categoryId = category.id)) == null) {
            env.toasts.showError(strings.get(R.string.save_failed_try_again_17edad), io.buddybudget.core.domain.support.ReportErrorArea.Movimento)
            return
        }
        env.toasts.show(BBToastKind.Success, strings.get(R.string.moved_to_0_85405c, category.name), strings.get(R.string.cancel_6c3de5), onAction = {
            if (previous != null) scope.launch { patch(TransactionPatch(categoryId = previous)) }
        })
        if (!remember || category.isFallback) return
        try {
            val result = env.rulesApi.create(RuleCreateBody(RuleMatchType.merchant, current.description, category.id, replaceExisting = true))
            if (result.applied > 0) {
                val others = result.applied
                env.toasts.show(
                    BBToastKind.Success,
                    if (others == 1) strings.get(R.string.also_put_one_more_transaction_in_0_4321b6, category.name)
                    else strings.get(R.string.also_put_1_more_transactions_in_0_3ceb9e, category.name, others.toString()),
                )
            }
            RuleFeedback.offerPastMatches(result, env) { dirty = true }
        } catch (e: Exception) {
            // The category change succeeded; a failed rule is not blocking.
        }
    }

    suspend fun saveSplit(excluded: Double): Boolean = patch(TransactionPatch(excludedAmount = excluded)) != null

    suspend fun saveEdit(body: TransactionPatch): Boolean = patch(body) != null

    /** TX-070: saved when the field loses focus, only if changed. */
    suspend fun saveNote(text: String) {
        val current = movement ?: return
        val note = MovementEdit.notePatch(current, text) ?: return
        noteStatus = NoteStatus.Saving
        noteStatus = if (patch(TransactionPatch(note = note)) != null) NoteStatus.Saved else NoteStatus.Failed
    }

    /** TX-066 (after the confirmation). Returns true when the sheet can close. */
    suspend fun delete(): Boolean {
        val current = movement ?: return false
        deleting = true
        return try {
            env.transactions.delete(current.id)
            dirty = true
            true
        } catch (e: Exception) {
            env.toasts.show(BBToastKind.Error, (e as? ApiError.Http)?.body?.message ?: env.session.strings().get(L10n.genericError))
            false
        } finally {
            deleting = false
        }
    }

    /** TX-068: «Chiedi all'AI»; with the assistant switched off it explains where to turn it on, without calling. */
    suspend fun askAi() {
        val current = movement ?: return
        if (ai?.enabled != true) {
            aiAnswer = MovementDetailText.aiOff
            return
        }
        asking = true
        aiAnswer = try {
            val result = env.transactions.aiSuggestion(current.id)
            MovementDetailText.aiAnswer(result, current.categoryId, selectable.map { it.id }.toSet())
        } catch (e: Exception) {
            MovementDetailText.AiAnswer.Message(MovementDetailText.aiNoAnswerSource("failed")!!, false)
        } finally {
            asking = false
        }
    }

    /** «Usa questa»: the proposed category becomes the user's choice (no rule). */
    suspend fun useAi(categoryId: String) {
        val category = category(categoryId) ?: return
        changeCategory(category, remember = false)
    }

    fun goToAiSettings() = openSettings()
}

/** Hosts the movement detail sheet for the whole app (TX-064); [onClosed] reloads the lists when something changed. */
@Composable
fun MovementDetailHost(env: AppEnvironment, request: MovementDetailRequest?, onDismiss: () -> Unit, openSettings: () -> Unit, onChanged: () -> Unit) {
    var shown by remember { mutableStateOf(request) }
    if (request != null && request.id != shown?.id) shown = request
    val model = shown?.let { r -> remember(r) { MovementDetailModel(env, r, openSettings) } }
    if (model != null) LaunchedEffect(model) { model.start() }
    val close = {
        if (model?.dirty == true) onChanged()
        onDismiss()
    }
    val title = when (model?.mode) {
        MovementDetailModel.Mode.Split -> l10n(R.string.split_0_680cbf, model.movement?.description ?: "")
        MovementDetailModel.Mode.Edit -> l10n(R.string.edit_transaction_e51824)
        else -> null
    }
    BBSheet(request != null, close, title) {
        if (model != null) key(model.id) { MovementDetailContent(model, close) }
    }
}

@Composable
private fun MovementDetailContent(model: MovementDetailModel, onClose: () -> Unit) {
    val c = BuddyBudgetTheme.colors
    val failure = model.failure
    val detail = model.detail
    when {
        failure != null && detail?.transaction == null -> {
            val gone = failure == MovementDetailModel.LoadFailure.NotFound
            Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space4)) {
                BBText(
                    if (gone) l10n(R.string.this_transaction_is_gone_b6a6f1) else l10n(R.string.couldn_t_load_the_transaction_751da2),
                    Modifier.semantics { heading() }, BBStyles.screenTitle,
                )
                BBText(
                    if (gone) l10n(R.string.it_may_have_been_deleted_or_replaced_by_f97731) else l10n(R.string.check_your_connection_and_try_again_75841f),
                    BBTextStyle.Body, color = c.text2,
                )
                Row(horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
                    if (!gone) BBButton(l10n(L10n.retry), { model.launch { model.load() } }, size = BBButtonSize.Touch)
                    BBButton(l10n(L10n.close), onClose, variant = BBButtonVariant.Outline, size = BBButtonSize.Touch)
                }
            }
        }
        detail == null -> {
            val label = l10n(R.string.transaction_details_cf4891)
            Column(Modifier.semantics { contentDescription = label }, verticalArrangement = Arrangement.spacedBy(BBSpacing.space4)) {
                BBSkeleton(width = 56.dp, height = 56.dp, radius = 28.dp)
                BBSkeleton(width = 240.dp, height = 32.dp, radius = BBRadius.full)
                BBSkeleton(width = 160.dp, height = 36.dp, radius = BBRadius.full)
                BBSkeleton(Modifier.fillMaxWidth(), height = 64.dp, radius = BBRadius.radius2xl)
            }
        }
        model.mode == MovementDetailModel.Mode.Split -> MovementSplitPanel(detail.transaction, model.currency, { model.saveSplit(it) }) { model.mode = MovementDetailModel.Mode.Detail }
        model.mode == MovementDetailModel.Mode.Edit ->
            MovementEditPanel(detail.transaction, model.currency, LiquidityModel.today(), { model.saveEdit(it) }) { model.mode = MovementDetailModel.Mode.Detail }
        else -> MovementDetailView(model, detail, onClose)
    }
}

@OptIn(androidx.compose.foundation.layout.ExperimentalLayoutApi::class)
@Composable
private fun MovementDetailView(model: MovementDetailModel, detail: MovementDetail, onClose: () -> Unit) {
    val c = BuddyBudgetTheme.colors
    val locale = LocalBBLocale.current
    val strings = LocalStrings.current
    val tr: (String, Map<String, String>) -> String = { s, v -> strings.lookup(s, v) }
    val movement = detail.transaction
    val category = model.category(movement.categoryId)
    val kind = MovementKind.of(movement, category)
    val uncategorized = category?.isFallback ?: false
    var picking by remember { mutableStateOf(false) }
    var confirmDelete by remember { mutableStateOf(false) }
    val dateText = CalendarDate.parse(movement.date)?.let { BBFormat.formatDate(it, BBDateSkeleton.EEEE_D_MMMM_Y, locale) } ?: movement.date
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space6)) {
        // Header (TX-065)
        Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
            val logoPath = movement.logoPath
            if (logoPath != null) {
                MerchantLogo(movement.description, logoPath = logoPath, size = MerchantLogoSize.Lg, onRemoteLogo = { model.remoteLogoShown = true },
                    fallbackView = { CategoryAvatar(category, 56.dp) })
            } else {
                CategoryAvatar(category, 56.dp)
            }
            Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space1)) {
                BBText(movement.description, Modifier.semantics { heading() }, BBStyles.sectionHeading)
                BBText(listOfNotNull(dateText, detail.account?.name).joinToString(" · "), BBTextStyle.Body, color = c.text2)
            }
            Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space1)) {
                AmountText(
                    if (kind == MovementKind.Transfer) movement.amount else movement.effectiveAmount, model.currency,
                    tone = if (kind == MovementKind.Transfer) AmountTone.Neutral else AmountTone.Signed, signed = true,
                    style = BBTextStyle.Display.style,
                )
                if (kind == MovementKind.Split) {
                    BBText(
                        l10n(R.string.split_only_your_share_of_0_counts_d75eda, BBFormat.formatCurrency(kotlin.math.abs(movement.amount), model.currency, locale, masked = io.buddybudget.app.designsystem.components.LocalHideAmounts.current)),
                        BBTextStyle.Body, color = c.text2,
                    )
                }
                if (kind == MovementKind.Transfer) BBText(l10n(R.string.transfer_left_out_of_the_totals_7bc7d0), BBTextStyle.Body, color = c.text2)
            }
            // TX-066
            FlowRow(horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2), verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
                if (kind != MovementKind.Transfer) {
                    BBButton(l10n(R.string.split_d28d0e), { model.mode = MovementDetailModel.Mode.Split }, icon = BBIcon.Split,
                        variant = BBButtonVariant.Outline, size = BBButtonSize.Touch)
                }
                if (movement.isManual) {
                    BBButton(l10n(R.string.edit_8fc593), { model.mode = MovementDetailModel.Mode.Edit }, icon = BBIcon.Pencil,
                        variant = BBButtonVariant.Outline, size = BBButtonSize.Touch)
                    BBButton(l10n(R.string.delete_6b177b), { confirmDelete = true }, icon = BBIcon.Trash2,
                        variant = BBButtonVariant.Destructive, size = BBButtonSize.Touch)
                }
            }
        }

        // Category (TX-067) and «Chiedi all'AI» (TX-068)
        Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
            Row(
                Modifier.fillMaxWidth()
                    .background(if (uncategorized) c.alphaDestructive10 else c.alphaMuted50, RoundedCornerShape(BBRadius.radius2xl))
                    .padding(BBSpacing.space3_5),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(BBSpacing.space3),
            ) {
                CategoryAvatar(category, 40.dp)
                Column(Modifier.weight(1f)) {
                    BBText(category?.name ?: l10n(R.string.uncategorized_69f672), BBTextStyle.BodyStrong, color = if (uncategorized) c.neg else c.foreground)
                    MovementDetailText.categoryOriginText(movement.categorySource, movement.categoryConfidence, detail.rule, uncategorized, movement.bankCategory, tr)?.let {
                        BBText(it, BBTextStyle.Body, color = c.text2)
                    }
                }
                BBButton(l10n(R.string.change_68f742), { picking = true }, variant = BBButtonVariant.Outline, size = BBButtonSize.Touch)
            }
            if (kind != MovementKind.Transfer && model.ai?.available == true) MovementDetailAi(model)
        }

        // Facts (TX-069)
        Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space4)) {
            Fact(l10n(R.string.where_it_comes_from_e1aa51)) {
                if (model.partial) BBSkeleton(width = 192.dp, height = 20.dp, radius = BBRadius.full)
                else BBText(MovementDetailText.originText(detail.origin, tr), BBTextStyle.Body)
            }
            val raw = movement.rawDescription
            if (raw != null && raw != movement.description) Fact(l10n(R.string.bank_s_text_11c401)) { BBText(raw, BBTextStyle.Body) }
            movement.merchantCategoryCode?.takeIf { it.isNotEmpty() }?.let { mcc -> Fact(l10n(R.string.merchant_code_mcc_4921e7)) { BBText(mcc, BBTextStyle.Body) } }
            movement.createdAt?.take(10)?.let { day ->
                Fact(l10n(R.string.recorded_on_4c71d7)) { BBText(BBFormat.formatDateWithYear(day, locale), BBTextStyle.Body) }
            }
        }

        // Note (TX-070)
        key(movement.id) { MovementDetailNote(model, movement) }

        // Same merchant (TX-071)
        val merchant = detail.merchant
        if (merchant != null) {
            MovementDetailMerchant(model, merchant)
        } else if (model.partial) {
            BBSkeleton(Modifier.fillMaxWidth(), height = 96.dp, radius = BBRadius.radius2xl)
        }
    }

    var pickingShown by remember { mutableStateOf(false) }
    if (picking) pickingShown = true
    BBSheet(picking, { picking = false }, l10n(R.string.choose_category_bf34fc)) {
        if (pickingShown) {
            var rememberRule by remember { mutableStateOf(true) }
            val offersRemember = uncategorized || movement.source == TransactionOrigin.auto
            CategorySheetContent(
                model.selectable, model.usage,
                onPick = { picked ->
                    picking = false
                    model.launch { model.changeCategory(picked, offersRemember && rememberRule) }
                },
                selectedId = movement.categoryId, description = movement.description,
                searchPlaceholder = l10n(R.string.find_a_category_2cdfb3), mostUsedLabel = l10n(R.string.most_used_ed5f44), mostUsedLimit = 6,
            ) {
                if (offersRemember) BBSwitchRow(l10n(R.string.remember_it_for_future_0_6e7405, movement.description), rememberRule) { rememberRule = it }
            }
        }
    }
    BBAlertSheet(
        confirmDelete,
        l10n(R.string.delete_this_transaction_13a3c1),
        l10n(R.string.s_0_will_be_permanently_deleted_c71e7f, movement.description),
        if (model.deleting) l10n(R.string.deleting_b8f137) else l10n(R.string.delete_6b177b),
        onConfirm = { model.launch { if (model.delete()) { confirmDelete = false; onClose() } } },
        onDismiss = { confirmDelete = false },
        icon = BBIcon.Trash2,
    )
}

/** One fact: label above, value below (TX-069). */
@Composable
private fun Fact(label: String, value: @Composable () -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
        BBText(label, BBTextStyle.Body, color = BuddyBudgetTheme.colors.text2)
        value()
    }
}

/** «Chiedi all'AI» (TX-068). */
@Composable
private fun MovementDetailAi(model: MovementDetailModel) {
    val c = BuddyBudgetTheme.colors
    when (val answer = model.aiAnswer) {
        is MovementDetailText.AiAnswer.Agrees, is MovementDetailText.AiAnswer.Proposes -> {
            Column(
                Modifier.fillMaxWidth().background(c.alphaPrimary10, RoundedCornerShape(BBRadius.radius2xl)).padding(BBSpacing.space3_5),
                verticalArrangement = Arrangement.spacedBy(BBSpacing.space3),
            ) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space1_5)) {
                    BBIconView(BBIcon.Sparkles, size = 16.dp, color = c.primary)
                    BBText(
                        if (answer is MovementDetailText.AiAnswer.Agrees) l10n(R.string.the_ai_agrees_with_this_category_9eed9f) else l10n(R.string.the_ai_would_put_it_in_0eac8f),
                        BBTextStyle.Body, color = c.text2,
                    )
                }
                if (answer is MovementDetailText.AiAnswer.Proposes) {
                    val proposed = model.category(answer.categoryId)
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
                        CategoryAvatar(proposed, 40.dp)
                        Column(Modifier.weight(1f)) {
                            BBText(proposed?.name ?: "", BBTextStyle.BodyStrong)
                            BBText(l10n(R.string.s_0_sure_570b67, answer.percent.toString()), BBTextStyle.Body, color = c.text2)
                        }
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
                        BBButton(l10n(R.string.use_this_f217e7), { model.launch { model.useAi(answer.categoryId) } }, size = BBButtonSize.Touch)
                        BBButton(l10n(R.string.leave_it_1101e9), { model.aiAnswer = null }, variant = BBButtonVariant.Ghost, size = BBButtonSize.Touch)
                    }
                }
            }
        }
        else -> Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
            BBButton(
                if (model.asking) l10n(R.string.asking_the_ai_0fad19) else l10n(R.string.ask_the_ai_d371ca),
                { model.launch { model.askAi() } }, icon = BBIcon.Sparkles, variant = BBButtonVariant.Outline, size = BBButtonSize.Touch,
                enabled = !model.asking,
            )
            if (answer is MovementDetailText.AiAnswer.Message) {
                BBText(tr(answer.source), BBTextStyle.Body, color = c.text2)
                if (answer.offersSettings) {
                    BBButton(l10n(R.string.turn_it_on_in_settings_b8ef44), model::goToAiSettings, variant = BBButtonVariant.Link, size = BBButtonSize.Touch)
                }
            }
        }
    }
}

/** TX-070: the note, saved when the field loses focus. */
@Composable
private fun MovementDetailNote(model: MovementDetailModel, movement: Movement) {
    val c = BuddyBudgetTheme.colors
    var text by remember { mutableStateOf(movement.note ?: "") }
    val scope = rememberCoroutineScope()
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space1_5)) {
        BBTextArea(
            text, { text = it }, label = l10n(R.string.note_1a6b7b),
            placeholder = l10n(R.string.write_something_to_remember_about_this_t_81b741), maxLength = 500,
            onBlur = { scope.launch { model.saveNote(text) } },
        )
        when (model.noteStatus) {
            MovementDetailModel.NoteStatus.Saving -> BBText(l10n(R.string.saving_f71782), BBTextStyle.Caption, color = c.text2)
            MovementDetailModel.NoteStatus.Saved -> BBText(l10n(R.string.note_saved_2ac325), BBTextStyle.Caption, color = c.text2)
            MovementDetailModel.NoteStatus.Failed -> BBText(l10n(R.string.note_not_saved_try_again_1fd653), BBTextStyle.Caption, color = c.destructive)
            null -> Unit
        }
    }
}

/** TX-071: the same merchant over the last year; each movement opens in the same sheet. */
@Composable
private fun MovementDetailMerchant(model: MovementDetailModel, summary: io.buddybudget.core.data.MerchantSummary) {
    val c = BuddyBudgetTheme.colors
    val locale = LocalBBLocale.current
    val hidden = io.buddybudget.app.designsystem.components.LocalHideAmounts.current
    val (source, values) = MovementDetailText.merchantCountSource(summary.count)
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
        BBText(l10n(R.string.from_this_merchant_2a6599), Modifier.semantics { heading() }, BBStyles.viewTitleLong)
        BBText(
            "${tr(source, values)}, ${BBFormat.formatSignedCurrency(summary.total, model.currency, locale, hidden)} ${l10n(R.string.in_total_cd48a5)}",
            BBTextStyle.Body, color = c.text2,
        )
        Column {
            summary.recent.forEach { other ->
                Row(
                    Modifier.fillMaxWidth().heightIn(min = 44.dp)
                        .bbPressable({ model.open(other.id) }, RoundedCornerShape(BBRadius.xl), translate = false)
                        .padding(horizontal = BBSpacing.space2),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(BBSpacing.space3),
                ) {
                    BBText(BBFormat.formatDateWithYear(other.date, locale), BBTextStyle.Body, Modifier.weight(1f), color = c.text2)
                    AmountText(other.amount, model.currency, tone = if (other.amount > 0) AmountTone.Income else AmountTone.Neutral, signed = true, style = BBStyles.rowAmount)
                    BBIconView(BBIcon.ChevronRight, size = 16.dp, color = c.text3)
                }
            }
        }
    }
}

@Composable
private fun tr(source: String, values: Map<String, String> = emptyMap()): String = io.buddybudget.app.tr(source, values)
