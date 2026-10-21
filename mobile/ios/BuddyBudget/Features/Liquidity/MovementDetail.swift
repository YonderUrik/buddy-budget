import BuddyBudgetKit
import SwiftUI

/// Which movement the detail sheet shows; `placeholder` is the row the list already has (TX-064).
struct MovementDetailRequest: Equatable {
    let id: String
    var placeholder: Movement?
}

/// State of the movement detail (TX-064…073, web #455): the movement with origin, account, rule and merchant summary,
/// the categories it can take, the AI setting and every action on it. One instance per opened movement; another
/// movement of the same merchant replaces it in place. Same fields as `MovementDetailModel` on Android.
@MainActor @Observable
final class MovementDetailModel {
    enum Mode { case detail, split, edit }
    enum LoadFailure { case notFound, failed }
    enum NoteStatus { case saving, saved, failed }

    private(set) var id: String
    private(set) var detail: MovementDetail?
    /// The row came from a list and origin, account and merchant are still arriving.
    private(set) var partial: Bool
    private(set) var failure: LoadFailure?
    private(set) var categories: [MovementCategory] = []
    private(set) var usage: [String: Int] = [:]
    private(set) var ai: AiCategorizationState?
    var mode: Mode = .detail
    private(set) var noteStatus: NoteStatus?
    private(set) var asking = false
    var aiAnswer: MovementDetailText.AiAnswer?
    private(set) var deleting = false
    /// Something changed: the lists behind reload when the sheet closes.
    @ObservationIgnored private(set) var dirty = false
    var remoteLogoShown = false

    @ObservationIgnored let env: AppEnvironment
    @ObservationIgnored private let openSettings: () -> Void
    @ObservationIgnored private var generation = 0

    init(env: AppEnvironment, request: MovementDetailRequest, openSettings: @escaping () -> Void) {
        self.env = env
        self.openSettings = openSettings
        id = request.id
        detail = request.placeholder.map { MovementDetail(placeholder: $0) }
        partial = request.placeholder != nil
    }

    var movement: Movement? { detail?.transaction }
    var currency: String { env.session.currency }
    func category(_ id: String?) -> MovementCategory? { categories.first { $0.id == id } }

    /// Categories the movement can take (fallback, transfers, same direction — TX-028).
    var selectable: [MovementCategory] {
        guard let movement else { return [] }
        return CategoryRules.pickerCategories(categories, amount: movement.amount)
    }

    func start() async {
        async let meta: Void = loadMeta()
        await load()
        await meta
    }

    private func loadMeta() async {
        async let c = try? env.categoriesAPI.list()
        async let u = try? env.categoriesAPI.usage()
        async let a = try? env.user.aiCategorization()
        if let list = await c { categories = list }
        if let counts = await u { usage = counts }
        ai = await a
    }

    /// TX-064/072.
    func load() async {
        generation += 1
        let current = generation
        failure = nil
        do {
            let loaded = try await env.transactions.detail(id: id)
            guard current == generation else { return }
            detail = loaded
            partial = false
        } catch {
            guard current == generation else { return }
            failure = (error as? APIError)?.status == 404 ? .notFound : .failed
        }
    }

    /// TX-071: another movement of the same merchant opens in the same sheet.
    func open(_ otherId: String) {
        id = otherId
        detail = nil
        partial = false
        mode = .detail
        noteStatus = nil
        aiAnswer = nil
        Task { await load() }
    }

    private func patch(_ body: TransactionPatch) async -> Movement? {
        guard let current = movement else { return nil }
        do {
            let updated = try await env.transactions.update(id: current.id, body).with(logoPath: current.logoPath)
            detail?.transaction = updated
            dirty = true
            return updated
        } catch {
            return nil
        }
    }

    /// TX-067 (same flow as the row, TX-030/031): toast with undo, optional merchant rule.
    func changeCategory(_ category: MovementCategory, remember: Bool) async {
        guard let current = movement, category.id != current.categoryId else { return }
        let previous = current.categoryId
        aiAnswer = nil
        guard await patch(TransactionPatch(categoryId: category.id)) != nil else {
            env.toasts.showError(L10n.saveFailedTryAgain, area: .movimento)
            return
        }
        env.toasts.show(.success, L10n.movedTo0(category.name), actionLabel: L10n.cancel_6c3de5) { [weak self] in
            guard let self, let previous else { return }
            Task { await self.patch(TransactionPatch(categoryId: previous)) }
        }
        guard remember, !category.isFallback else { return }
        do {
            let result = try await env.rulesAPI.create(RuleCreateBody(matchType: .merchant, pattern: current.description,
                                                                      categoryId: category.id, replaceExisting: true))
            if result.applied > 0 {
                let others = result.applied
                env.toasts.show(.success, others == 1 ? L10n.alsoPutOneMoreTransactionIn0(category.name)
                    : L10n.alsoPut1MoreTransactionsIn0(category.name, String(others)))
            }
            RuleFeedback.offerPastMatches(result, env: env) { [weak self] in self?.dirty = true }
        } catch {
            // The category change succeeded; a failed rule is not blocking.
        }
    }

    func saveSplit(_ excluded: Double) async -> Bool { await patch(TransactionPatch(excludedAmount: excluded)) != nil }

    func saveEdit(_ body: TransactionPatch) async -> Bool { await patch(body) != nil }

    /// TX-070: saved when the field loses focus, only if changed.
    func saveNote(_ text: String) async {
        guard let current = movement, let note = MovementEdit.notePatch(current, text: text) else { return }
        noteStatus = .saving
        noteStatus = await patch(TransactionPatch(note: note)) != nil ? .saved : .failed
    }

    /// TX-066 (after the confirmation). Returns true when the sheet can close.
    func delete() async -> Bool {
        guard let current = movement else { return false }
        deleting = true
        defer { deleting = false }
        do {
            try await env.transactions.delete(id: current.id)
            dirty = true
            return true
        } catch {
            env.toasts.show(.error, (error as? APIError)?.body?.message ?? L10n.genericError)
            return false
        }
    }

    /// TX-068: «Chiedi all'AI»; with the assistant switched off it explains where to turn it on, without calling.
    func askAi() async {
        guard let current = movement else { return }
        guard ai?.enabled == true else {
            aiAnswer = MovementDetailText.aiOff
            return
        }
        asking = true
        defer { asking = false }
        do {
            let result = try await env.transactions.aiSuggestion(id: current.id)
            aiAnswer = MovementDetailText.aiAnswer(result, currentCategoryId: current.categoryId, selectableIds: Set(selectable.map(\.id)))
        } catch {
            aiAnswer = .message(source: MovementDetailText.aiNoAnswerSource("failed") ?? "", offersSettings: false)
        }
    }

    /// «Usa questa»: the proposed category becomes the user's choice (no rule).
    func useAi(_ categoryId: String) async {
        guard let category = category(categoryId) else { return }
        await changeCategory(category, remember: false)
    }

    func goToAiSettings() { openSettings() }
}

extension View {
    /// Hosts the movement detail sheet for the whole app (TX-064); `onChanged` reloads the lists when something changed.
    func movementDetailHost(request: Binding<MovementDetailRequest?>, openSettings: @escaping () -> Void,
                            onChanged: @escaping () -> Void) -> some View {
        modifier(MovementDetailHost(request: request, openSettings: openSettings, onChanged: onChanged))
    }
}

private struct MovementDetailHost: ViewModifier {
    @Binding var request: MovementDetailRequest?
    let openSettings: () -> Void
    let onChanged: () -> Void
    @Environment(AppEnvironment.self) private var env
    @State private var model: MovementDetailModel?

    func body(content: Content) -> some View {
        content
            .bbSheet(isPresented: Binding(get: { request != nil }, set: { if !$0 { close() } }), title: title) {
                if let model {
                    MovementDetailContent(model: model, onClose: close)
                        .id(model.id)
                        .task(id: ObjectIdentifier(model)) { await model.start() }
                }
            }
            .onChange(of: request, initial: true) { _, next in
                guard let next, next.id != model?.id else { return }
                model = MovementDetailModel(env: env, request: next, openSettings: openSettings)
            }
    }

    private var title: String? {
        switch model?.mode {
        case .split: L10n.split0(model?.movement?.description ?? "")
        case .edit: L10n.editTransaction_e51824
        default: nil
        }
    }

    private func close() {
        if model?.dirty == true { onChanged() }
        request = nil
        model = nil
    }
}

private struct MovementDetailContent: View {
    let model: MovementDetailModel
    let onClose: () -> Void

    var body: some View {
        if let failure = model.failure, model.detail == nil {
            let gone = failure == .notFound
            VStack(alignment: .leading, spacing: BBSpacing.space4) {
                BBText(gone ? L10n.thisTransactionIsGone : L10n.couldnTLoadTheTransaction, style: .screenTitle)
                    .accessibilityAddTraits(.isHeader)
                BBText(gone ? L10n.itMayHaveBeenDeletedOrReplacedBy : L10n.checkYourConnectionAndTryAgain, style: BBTypography.body,
                       color: .bbText2)
                HStack(spacing: BBSpacing.space2) {
                    if !gone { BBButton(L10n.retry, size: .touch) { Task { await model.load() } } }
                    BBButton(L10n.close, variant: .outline, size: .touch, action: onClose)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        } else if let detail = model.detail {
            switch model.mode {
            case .split:
                MovementSplitPanel(movement: detail.transaction, currency: model.currency, onSave: { await model.saveSplit($0) }) {
                    model.mode = .detail
                }
            case .edit:
                MovementEditPanel(movement: detail.transaction, currency: model.currency, today: LiquidityModel.today,
                                  onSave: { await model.saveEdit($0) }) { model.mode = .detail }
            case .detail:
                MovementDetailView(model: model, detail: detail, onClose: onClose)
            }
        } else {
            VStack(alignment: .leading, spacing: BBSpacing.space4) {
                BBSkeleton(width: 56, height: 56, radius: 28)
                BBSkeleton(width: 240, height: 32, radius: BBRadius.full)
                BBSkeleton(width: 160, height: 36, radius: BBRadius.full)
                BBSkeleton(height: 64, radius: BBRadius.radius2xl)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(L10n.transactionDetails)
        }
    }
}

private struct MovementDetailView: View {
    let model: MovementDetailModel
    let detail: MovementDetail
    let onClose: () -> Void

    @State private var picking = false
    @State private var confirmDelete = false
    @State private var rememberRule = true
    @Environment(\.bbLocale) private var locale
    @Environment(\.bbHideAmounts) private var hideAmounts

    private var tr: CategorizationText.Translate { { L10n.lookup(italian: $0, $1) } }

    var body: some View {
        let movement = detail.transaction
        let category = model.category(movement.categoryId)
        let kind = MovementKind.of(movement, category: category)
        let uncategorized = category?.isFallback ?? false
        VStack(alignment: .leading, spacing: BBSpacing.space6) {
            header(movement, category: category, kind: kind)
            // Category (TX-067) and «Chiedi all'AI» (TX-068)
            VStack(alignment: .leading, spacing: BBSpacing.space3) {
                HStack(spacing: BBSpacing.space3) {
                    CategoryAvatar(category: category, diameter: 40)
                    VStack(alignment: .leading, spacing: 0) {
                        BBText(category?.name ?? L10n.uncategorized, style: BBTypography.bodyStrong, color: uncategorized ? .bbNeg : .bbForeground)
                        if let origin = MovementDetailText.categoryOriginText(movement.categorySource, confidence: movement.categoryConfidence,
                                                                              rule: detail.rule, uncategorized: uncategorized,
                                                                              bankCategory: movement.bankCategory, tr: tr) {
                            BBText(origin, style: BBTypography.body, color: .bbText2)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    BBButton(L10n.change, variant: .outline, size: .touch) { picking = true }
                }
                .padding(BBSpacing.space3_5)
                .background(RoundedRectangle.bb(BBRadius.radius2xl).fill(uncategorized ? Color.bbAlphaDestructive10 : Color.bbAlphaMuted50))
                if kind != .transfer, model.ai?.available == true { MovementDetailAi(model: model) }
            }
            facts(movement)
            // Note (TX-070)
            MovementDetailNote(model: model, movement: movement).id(movement.id)
            // Same merchant (TX-071)
            if let merchant = detail.merchant {
                MovementDetailMerchant(model: model, summary: merchant)
            } else if model.partial {
                BBSkeleton(height: 96, radius: BBRadius.radius2xl)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .bbSheet(isPresented: $picking, title: L10n.chooseCategory_bf34fc) {
            let offersRemember = uncategorized || movement.source == .auto
            CategorySheetContent(categories: model.selectable, usage: model.usage, selectedId: movement.categoryId,
                                 description: movement.description, searchPlaceholder: L10n.findACategory,
                                 mostUsedLabel: L10n.mostUsed, mostUsedLimit: 6,
                                 onPick: { picked in
                                     picking = false
                                     Task { await model.changeCategory(picked, remember: offersRemember && rememberRule) }
                                 }) {
                if offersRemember {
                    BBSwitchRow(label: L10n.rememberItForFuture0(movement.description), isOn: $rememberRule)
                }
            }
        }
        .bbAlertSheet(isPresented: $confirmDelete, title: L10n.deleteThisTransaction_13a3c1,
                      description: L10n.s0WillBePermanentlyDeleted(movement.description),
                      confirmLabel: model.deleting ? L10n.deleting_b8f137 : L10n.delete_6b177b, icon: .trash2) {
            Task { if await model.delete() { onClose() } }
        }
    }

    // MARK: Header (TX-065) and actions (TX-066)

    private func header(_ movement: Movement, category: MovementCategory?, kind: MovementKind) -> some View {
        let date = CalendarDate(iso: movement.date).map { BBFormat.formatDate($0, .EEEEdMMMMy, locale: locale) } ?? movement.date
        return VStack(alignment: .leading, spacing: BBSpacing.space3) {
            if let logoPath = movement.logoPath {
                MerchantLogo(name: movement.description, logoPath: logoPath, size: .lg, onRemoteLogo: { model.remoteLogoShown = true },
                             fallbackView: AnyView(CategoryAvatar(category: category, diameter: 56)))
            } else {
                CategoryAvatar(category: category, diameter: 56)
            }
            VStack(alignment: .leading, spacing: BBSpacing.space1) {
                BBText(movement.description, style: .sectionHeading).accessibilityAddTraits(.isHeader)
                BBText([date, detail.account?.name].compactMap { $0 }.joined(separator: " · "), style: BBTypography.body, color: .bbText2)
            }
            VStack(alignment: .leading, spacing: BBSpacing.space1) {
                AmountText(value: kind == .transfer ? movement.amount : movement.effectiveAmount, currency: model.currency,
                           tone: kind == .transfer ? .neutral : .signed, signed: true, style: BBTypography.display)
                if kind == .split {
                    BBText(L10n.splitOnlyYourShareOf0Counts(BBFormat.formatCurrency(abs(movement.amount), currency: model.currency,
                                                                                    locale: locale, masked: hideAmounts)),
                           style: BBTypography.body, color: .bbText2)
                }
                if kind == .transfer { BBText(L10n.transferLeftOutOfTheTotals, style: BBTypography.body, color: .bbText2) }
            }
            FlowRow(spacing: BBSpacing.space2, lineSpacing: BBSpacing.space2) {
                if kind != .transfer {
                    BBButton(L10n.split_d28d0e, icon: .split, variant: .outline, size: .touch) { model.mode = .split }
                }
                if movement.isManual {
                    BBButton(L10n.edit, icon: .pencil, variant: .outline, size: .touch) { model.mode = .edit }
                    BBButton(L10n.delete_6b177b, icon: .trash2, variant: .destructive, size: .touch) { confirmDelete = true }
                }
            }
        }
    }

    // MARK: Facts (TX-069)

    private func facts(_ movement: Movement) -> some View {
        VStack(alignment: .leading, spacing: BBSpacing.space4) {
            fact(L10n.whereItComesFrom_e1aa51) {
                if model.partial {
                    BBSkeleton(width: 192, height: 20, radius: BBRadius.full)
                } else {
                    BBText(MovementDetailText.originText(detail.origin, tr: tr), style: BBTypography.body)
                }
            }
            if let raw = movement.rawDescription, raw != movement.description {
                fact(L10n.bankSText) { BBText(raw, style: BBTypography.body) }
            }
            if let mcc = movement.merchantCategoryCode, !mcc.isEmpty {
                fact(L10n.merchantCodeMcc) { BBText(mcc, style: BBTypography.body) }
            }
            if let created = movement.createdAt {
                fact(L10n.recordedOn) { BBText(BBFormat.formatDateWithYear(String(created.prefix(10)), locale: locale), style: BBTypography.body) }
            }
        }
    }

    private func fact<Value: View>(_ label: String, @ViewBuilder value: () -> Value) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            BBText(label, style: BBTypography.body, color: .bbText2)
            value()
        }
    }
}

/// «Chiedi all'AI» (TX-068).
private struct MovementDetailAi: View {
    let model: MovementDetailModel

    var body: some View {
        switch model.aiAnswer {
        case .agrees, .proposes:
            VStack(alignment: .leading, spacing: BBSpacing.space3) {
                HStack(spacing: BBSpacing.space1_5) {
                    BBIconView(.sparkles, size: .md, color: .bbPrimary)
                    BBText(model.aiAnswer == .agrees ? L10n.theAiAgreesWithThisCategory : L10n.theAiWouldPutItIn,
                           style: BBTypography.body, color: .bbText2)
                }
                if case .proposes(let categoryId, let percent) = model.aiAnswer {
                    let proposed = model.category(categoryId)
                    HStack(spacing: BBSpacing.space3) {
                        CategoryAvatar(category: proposed, diameter: 40)
                        VStack(alignment: .leading, spacing: 0) {
                            BBText(proposed?.name ?? "", style: BBTypography.bodyStrong)
                            BBText(L10n.s0Sure(String(percent)), style: BBTypography.body, color: .bbText2)
                        }
                    }
                    HStack(spacing: BBSpacing.space2) {
                        BBButton(L10n.useThis, size: .touch) { Task { await model.useAi(categoryId) } }
                        BBButton(L10n.leaveIt, variant: .ghost, size: .touch) { model.aiAnswer = nil }
                    }
                }
            }
            .padding(BBSpacing.space3_5)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(RoundedRectangle.bb(BBRadius.radius2xl).fill(Color.bbAlphaPrimary10))
        default:
            VStack(alignment: .leading, spacing: BBSpacing.space2) {
                BBButton(model.asking ? L10n.askingTheAi : L10n.askTheAi, icon: .sparkles, variant: .outline, size: .touch,
                         isDisabled: model.asking) { Task { await model.askAi() } }
                if case .message(let source, let offersSettings) = model.aiAnswer {
                    BBText(L10n.lookup(italian: source), style: BBTypography.body, color: .bbText2)
                    if offersSettings {
                        BBButton(L10n.turnItOnInSettings, variant: .link, size: .touch) { model.goToAiSettings() }
                    }
                }
            }
        }
    }
}

/// TX-070: the note, saved when the field loses focus.
private struct MovementDetailNote: View {
    let model: MovementDetailModel
    let movement: Movement
    @State private var text: String

    init(model: MovementDetailModel, movement: Movement) {
        self.model = model
        self.movement = movement
        _text = State(initialValue: movement.note ?? "")
    }

    var body: some View {
        VStack(alignment: .leading, spacing: BBSpacing.space1_5) {
            BBTextArea(label: L10n.note, text: $text, placeholder: L10n.writeSomethingToRememberAboutThisT, maxLength: 500,
                       onBlur: { Task { await model.saveNote(text) } })
            switch model.noteStatus {
            case .saving: BBText(L10n.saving_f71782, style: BBTypography.caption, color: .bbText2)
            case .saved: BBText(L10n.noteSaved, style: BBTypography.caption, color: .bbText2)
            case .failed: BBText(L10n.noteNotSavedTryAgain, style: BBTypography.caption, color: .bbDestructive)
            case nil: EmptyView()
            }
        }
        // Closing the sheet while typing still saves the note.
        .onDisappear { Task { await model.saveNote(text) } }
    }
}

/// TX-071: the same merchant over the last year; each movement opens in the same sheet.
private struct MovementDetailMerchant: View {
    let model: MovementDetailModel
    let summary: MerchantSummary
    @Environment(\.bbLocale) private var locale
    @Environment(\.bbHideAmounts) private var hideAmounts

    var body: some View {
        let (source, values) = MovementDetailText.merchantCountSource(summary.count)
        VStack(alignment: .leading, spacing: BBSpacing.space2) {
            BBText(L10n.fromThisMerchant, style: .viewTitleLong).accessibilityAddTraits(.isHeader)
            BBText("\(L10n.lookup(italian: source, values)), \(BBFormat.formatSignedCurrency(summary.total, currency: model.currency, locale: locale, masked: hideAmounts)) \(L10n.inTotal)",
                   style: BBTypography.body, color: .bbText2)
            VStack(spacing: 0) {
                ForEach(summary.recent) { other in
                    Button { model.open(other.id) } label: {
                        HStack(spacing: BBSpacing.space3) {
                            BBText(BBFormat.formatDateWithYear(other.date, locale: locale), style: BBTypography.body, color: .bbText2)
                                .frame(maxWidth: .infinity, alignment: .leading)
                            AmountText(value: other.amount, currency: model.currency, tone: other.amount > 0 ? .income : .neutral, signed: true,
                                       style: .rowAmount)
                            BBIconView(.chevronRight, size: .md, color: .bbText3)
                        }
                        .padding(.horizontal, BBSpacing.space2)
                        .frame(minHeight: 44)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(BBPressableStyle(pressedBackground: .bbMuted, shape: AnyShape(RoundedRectangle.bb(BBRadius.xl)), translate: false))
                }
            }
        }
    }
}
