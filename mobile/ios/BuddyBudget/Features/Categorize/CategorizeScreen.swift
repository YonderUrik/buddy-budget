import BuddyBudgetKit
import SwiftUI
import UIKit

/// /categorizza (CAT-036…089), phone layout: compact `AI` button and `⋯` (Ricategorizza) in the top bar, tabs
/// «Da decidere · n» / «Messe dall'app · n», the swipe deck or the auto-categorized list. Android: CategorizeScreen.kt.
struct CategorizeScreen: View {
    @Environment(AppEnvironment.self) private var env
    @Environment(ShellModel.self) private var shell
    @Environment(\.shellBack) private var back
    @Environment(\.scenePhase) private var scenePhase
    @State private var model: CategorizeModel?
    @State private var menu = false
    @State private var recategorize = false
    @State private var consent = false

    var body: some View {
        BBScreen(title: L10n.categorise, onBack: back, onRefresh: { await model?.load() }) {
            if let model, model.showsAI {
                BBButton(model.generating ? L10n.inProgress_4b6912 : L10n.ai, icon: .sparkles, variant: .outline, size: .sm,
                         isLoading: model.generating) {
                    if model.aiConsented { Task { await model.generate() } } else { consent = true }
                }
            }
            BBIconButton(icon: .ellipsis, accessibilityLabel: L10n.moreActions) { menu = true }
                .bbDisabled(model?.categories.isEmpty ?? true)
        } content: {
            if let model {
                CategorizeContent(model: model)
            } else {
                BBSkeleton(height: 420, radius: BBRadius.xl)
            }
        }
        .task {
            if model == nil {
                let m = CategorizeModel(env: env)
                m.onChanged = { [weak shell] in
                    guard let shell else { return }
                    await shell.liquidity.refresh()
                }
                m.openMovement = { [weak shell] id in shell?.openMovement(id) }
                model = m
                await m.load()
                #if DEBUG
                if DebugLaunch.value("-BBTab") == "auto" { m.select(.auto) }
                #endif
            }
        }
        .onDisappear { Task { await model?.flush() } }
        .onChange(of: shell.dataVersion) { _, _ in Task { await model?.load() } }
        .onChange(of: scenePhase) { _, phase in if phase != .active { Task { await model?.flush() } } }
        .bbSheet(isPresented: $menu, title: L10n.moreActions) {
            VStack(alignment: .leading, spacing: 0) {
                SheetActionRow(icon: .refreshCw, label: L10n.recategorize) {
                    menu = false
                    DispatchQueue.main.asyncAfter(deadline: .now() + BBMotion.durationSheetExit + 0.05) { recategorize = true }
                }
                BBText(L10n.reassignsAppCategorizedTransactionsU_5a4e07, style: BBTypography.caption, color: .bbText3)
                    .padding(.leading, 36)
            }
        }
        .bbSheet(isPresented: $recategorize, title: L10n.recategorize) {
            if let model { RecategorizeSheet(model: model) { recategorize = false } }
        }
        .bbAlertSheet(isPresented: $consent, title: L10n.enableTheCategoryAssistant, description: consentText,
                      confirmLabel: L10n.enableAndCategoriseWithAi, confirmVariant: .default, icon: .sparkles) {
            Task { await model?.consentAndGenerate() }
        }
    }

    private var consentText: String {
        let option = (model?.autoApplyEnabled ?? true) ? L10n.whenConfidenceIsHighTheAppAssigns_66d3c5 : L10n.suggestionsStillNeedYourConfirmation
        return "\(L10n.weSendAnAiServiceOnlyTheCleanedM_be3863) \(option) \(L10n.youCanTurnItOffAnytimeInSettings)"
    }
}

private struct CategorizeContent: View {
    let model: CategorizeModel

    var body: some View {
        VStack(alignment: .leading, spacing: BBSpacing.space4) {
            SegmentedControl(options: [(CategorizeTab.toReview, model.suggestionsState == .loaded ? L10n.toReview0(String(model.deck.movementCount)) : L10n.toReview_88b521),
                                       // CAT-037: no count on «Messe dall'app» (a history, not work to do).
                                       (CategorizeTab.auto, L10n.assignedByTheApp)],
                             selection: Binding(get: { model.tab }, set: { model.select($0) }), stretch: true)
            if model.generating {
                VStack(alignment: .leading, spacing: BBSpacing.space2) {
                    BBText(L10n.readingYourMerchants0Of1Suggestion(String(model.generationDone), String(model.generationTotal)),
                           style: BBTypography.body, color: .bbText2)
                    ProgressBar(state: .determinate(value: Double(model.generationDone), max: Double(max(1, model.generationTotal))),
                                label: L10n.readingYourMerchants)
                }
            }
            if model.tab == .toReview {
                if !model.autoApplyEnabled {
                    HStack(spacing: BBSpacing.space3) {
                        VStack(alignment: .leading, spacing: 2) {
                            BBText(L10n.lessToDo, style: BBTypography.bodyStrong)
                            BBText(L10n.whenConfidenceIsHighTheAppAssigns_379731, style: BBTypography.caption, color: .bbText2)
                        }
                        Spacer(minLength: 0)
                        BBButton(L10n.enable, size: .sm) { Task { await model.enableAutoApply() } }
                    }
                    .padding(BBSpacing.space3)
                    .background(RoundedRectangle.bb(BBRadius.xl).fill(Color.bbAlphaPrimary5))
                }
                DeckView(model: model)
            } else {
                AutoCategorizedList(model: model)
            }
        }
    }
}

// MARK: - Deck

private struct DeckView: View {
    let model: CategorizeModel
    @State private var picking = false

    var body: some View {
        switch model.suggestionsState {
        case .loading:
            BBSkeleton(height: 420, radius: BBRadius.xl)
        case .failed:
            LoadError(message: L10n.unableToLoadCategorizationSuggestion) { Task { await model.loadSuggestions() } }
        case .loaded:
            if let current = model.deck.current {
                VStack(alignment: .leading, spacing: BBSpacing.space3) {
                    BBText(model.deck.remaining == 1 ? L10n.lastCard : L10n.s0MerchantsToCategorise(String(model.deck.remaining)),
                           style: BBTypography.bodyStrong, color: .bbText2)
                    ZStack(alignment: .bottom) {
                        // CAT-057: the next card(s) peek out under the active one.
                        if model.deck.remaining > 2 { DeckEdge(inset: 24, offset: 20) }
                        if model.deck.next != nil { DeckEdge(inset: 12, offset: 10) }
                        SwipeCard(model: model, group: current, interactive: true, onPick: { picking = true })
                            .id(current.groupKey)
                            .transition(.asymmetric(insertion: .opacity, removal: .opacity))
                    }
                    .padding(.bottom, BBSpacing.space6)
                    HStack(spacing: BBSpacing.space2) {
                        BBIconButton(icon: .undo2, accessibilityLabel: L10n.undoTheLastChoice, color: .bbForeground) { model.undo() }
                            .bbDisabled(!model.deck.canUndo)
                            .disabled(!model.deck.canUndo)
                        BBButton(L10n.change, variant: .outline, size: .touch, fullWidth: true) { picking = true }
                        if current.suggestion != nil {
                            BBButton(L10n.confirm, icon: .check, size: .touch, fullWidth: true) { withAnimation { model.confirm() } }
                        }
                        BBIconButton(icon: .arrowDown, accessibilityLabel: L10n.skipForNow, color: .bbForeground) { withAnimation { model.skip() } }
                    }
                }
                .bbSheet(isPresented: $picking, title: L10n.chooseCategory_bf34fc) {
                    @Bindable var model = model
                    CategorySheetContent(categories: CategoryRules.categorizeCategories(model.categories, isIncome: current.isIncome,
                                                                                         excluding: current.suggestion?.suggestedCategoryId),
                                         usage: model.usage, description: current.label, onPick: { picked in
                                             picking = false
                                             withAnimation { model.choose(picked) }
                                         }) {
                        BBSwitchRow(label: L10n.alwaysUseThisCategoryFor0(current.label), isOn: $model.remember)
                    }
                }
            } else {
                VStack(alignment: .leading, spacing: BBSpacing.space3) {
                    EmptyState(icon: .circleCheck, title: L10n.allDoneNothingElseToCategorise, description: "")
                    if model.deck.canUndo {
                        BBButton(L10n.undoTheLastChoice, icon: .undo2, variant: .outline, size: .touch) { model.undo() }
                    }
                }
            }
        }
    }
}

/// Edge of a waiting card under the active one.
private struct DeckEdge: View {
    let inset: CGFloat
    let offset: CGFloat

    var body: some View {
        RoundedRectangle.bb(BBRadius.radius2xl)
            .fill(Color.bbCard)
            .overlay(RoundedRectangle.bb(BBRadius.radius2xl).strokeBorder(Color.bbAlphaForeground10, lineWidth: 1))
            .frame(height: 60)
            .padding(.horizontal, inset)
            .offset(y: offset)
            .accessibilityHidden(true)
    }
}

/// One merchant card (CAT-055…063): logo, label, total, count and dates, recent movements, proposal and origin,
/// «Usa sempre…». Drag right confirms, left changes, up skips (110 pt, stamps, light haptic once past the threshold).
private struct SwipeCard: View {
    let model: CategorizeModel
    let group: SuggestionGroup
    let interactive: Bool
    let onPick: () -> Void

    @State private var drag: CGSize = .zero
    @State private var zone: Zone?
    @Environment(\.bbLocale) private var locale
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private enum Zone { case confirm, change, skip }
    private let threshold: CGFloat = 110

    var body: some View {
        let category = model.category(group.suggestion?.suggestedCategoryId)
        VStack(alignment: .leading, spacing: BBSpacing.space4) {
            // Web phone card: the merchant centred (logo, name, amount, count and dates), no rules inside (#427).
            VStack(spacing: BBSpacing.space1) {
                MerchantLogo(name: group.label, logoPath: group.logoPath, size: .md, onRemoteLogo: { model.remoteLogoShown = true })
                    .padding(.bottom, BBSpacing.space1)
                BBText(group.label, style: BBTextStyle.figure, lineLimit: 2).multilineTextAlignment(.center)
                AmountText(value: group.totalAmount, currency: model.env.session.currency, tone: .income,
                           style: BBTypography.bodyLarge.with(size: 18, lineHeight: 28, weight: 500))
                BBText(countLine, style: BBTypography.caption, color: .bbMutedForeground, lineLimit: 1)
            }
            .frame(maxWidth: .infinity)
            .padding(.top, BBSpacing.space6)
            if group.transactionIds.count > 1 { preview }
            if let suggestion = group.suggestion {
                VStack(alignment: .leading, spacing: BBSpacing.space2) {
                    BBText(L10n.suggestedCategory, style: BBTypography.body, color: .bbMutedForeground)
                    HStack(spacing: BBSpacing.space3) {
                        CategoryAvatar(category: category)
                        BBText(category?.name ?? "", style: .rowTitle, lineLimit: 1)
                    }
                    let origin = CategorizationText.suggestionOrigin(suggestion)
                    HStack(spacing: BBSpacing.space1_5) {
                        if let auto = AutoOrigin(rawValue: suggestion.source.rawValue) { BBIconView(auto.icon, size: .sm, color: .bbText2) }
                        BBText(L10n.lookup(italian: origin.key, Dictionary(uniqueKeysWithValues: origin.values.enumerated().map { (String($0.offset), $0.element) })),
                               style: BBTypography.caption, color: .bbText2)
                    }
                    .accessibilityElement(children: .combine)
                    .accessibilityHint(L10n.s0ConfidenceTheAppAssignsAutomatical(String(CategorizationText.confidencePercent(suggestion.confidence)), "90"))
                }
            } else {
                VStack(alignment: .leading, spacing: BBSpacing.space2) {
                    BBText(L10n.noSuggestionChooseACategory_238f5d, style: BBTypography.body, color: .bbText2)
                    BBButton(L10n.chooseCategory_bf34fc, variant: .outline, size: .touch, fullWidth: true, action: onPick)
                }
            }
            if interactive {
                @Bindable var model = model
                HStack(spacing: BBSpacing.space2) {
                    BBCheckbox(isOn: $model.remember, accessibilityLabel: L10n.alwaysUseThisCategoryFor0(group.label))
                    BBText(L10n.alwaysUseThisCategoryFor0(group.label), style: BBTypography.caption, color: .bbText2, lineLimit: 2)
                        .onTapGesture { model.remember.toggle() }
                }
            }
        }
        .padding(BBSpacing.space5)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle.bb(BBRadius.radius2xl).fill(Color.bbCard))
        .overlay(RoundedRectangle.bb(BBRadius.radius2xl).strokeBorder(borderColor, lineWidth: 2))
        .overlay(alignment: .top) { stamp }
        .offset(x: drag.width, y: min(0, drag.height))
        .rotationEffect(.degrees(reduceMotion ? 0 : Double(max(-8, min(8, drag.width / 20)))))
        .gesture(interactive ? dragGesture : nil)
    }

    private var countLine: String {
        let count = group.transactionIds.count
        let movements = count == 1 ? L10n.s1Transaction : L10n.s0Transactions_57cb30(String(count))
        return "\(movements) · \(CategorizationText.dateRangeLabel(group.transactionDates, today: model.today, locale: locale))"
    }

    private var preview: some View {
        let indices = CategorizationText.recentIndices(group.transactionDates, limit: 2)
        let rest = group.transactionIds.count - indices.count
        return VStack(alignment: .leading, spacing: BBSpacing.space1_5) {
            ForEach(indices, id: \.self) { i in
                let date = BBFormat.formatShortDate(group.transactionDates[i], locale: locale)
                // CAT-097: each movement of the card opens its detail.
                Button { if let id = group.transactionIds[safe: i] { model.openMovement(id) } } label: {
                    HStack(spacing: BBSpacing.space2) {
                        BBText(date, style: BBTypography.caption, color: .bbText3)
                            .frame(width: 52, alignment: .leading)
                        let text = group.transactionDescriptions.indices.contains(i) ? group.transactionDescriptions[i] : ""
                        BBText(text == group.label ? "" : text, style: BBTypography.caption, color: .bbText2, lineLimit: 1)
                            .frame(maxWidth: .infinity, alignment: .leading)
                        if group.transactionAmounts.indices.contains(i) {
                            AmountText(value: group.transactionAmounts[i], currency: model.env.session.currency, tone: .income,
                                       style: BBTypography.caption)
                        }
                    }
                    .frame(minHeight: 32)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel(L10n.openTheTransactionOf0(date))
            }
            if rest > 0 {
                BBText(rest == 1 ? L10n.andOneMore : L10n.and0More_ab4561(String(rest)), style: BBTypography.caption, color: .bbText3)
            }
        }
        .padding(.horizontal, BBSpacing.space3)
        .padding(.vertical, BBSpacing.space2)
        .background(RoundedRectangle.bb(BBRadius.xl).fill(Color.bbAlphaMuted50))
    }

    private var borderColor: Color {
        switch zone {
        case .confirm: .bbPos
        case .change: .bbPrimary
        case .skip: .bbText3
        case nil: Color.bbBorder
        }
    }

    @ViewBuilder private var stamp: some View {
        let label: String? = {
            if drag.width > 24 && group.suggestion != nil { return zone == .confirm ? L10n.releaseConfirm : L10n.thisOne }
            if drag.width < -24 { return zone == .change ? L10n.releaseChange : L10n.another_025f13 }
            if drag.height < -24 { return zone == .skip ? L10n.releaseSkip : L10n.skip_42805b }
            return nil
        }()
        if let label {
            BBText(label, style: BBTypography.bodyStrong, color: .bbPrimaryForeground)
                .padding(.horizontal, BBSpacing.space3)
                .padding(.vertical, BBSpacing.space1_5)
                .background(Capsule().fill(borderColor == Color.bbAlphaForeground10 ? Color.bbText2 : borderColor))
                .padding(.top, BBSpacing.space3)
                .opacity(min(1, max(abs(drag.width), abs(drag.height)) / threshold))
        }
    }

    private var dragGesture: some Gesture {
        DragGesture(minimumDistance: 8)
            .onChanged { g in
                drag = g.translation
                let next: Zone?
                if g.translation.width > threshold && group.suggestion != nil { next = .confirm }
                else if g.translation.width < -threshold { next = .change }
                else if g.translation.height < -threshold && abs(g.translation.width) < threshold { next = .skip }
                else { next = nil }
                if next != zone {
                    if next != nil { UIImpactFeedbackGenerator(style: .light).impactOccurred() }
                    zone = next
                }
            }
            .onEnded { _ in
                let decided = zone
                zone = nil
                switch decided {
                case .confirm:
                    withAnimation(.easeIn(duration: 0.28)) { drag.width = 600 }
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.28) { model.confirm(); drag = .zero }
                case .skip:
                    withAnimation(.easeIn(duration: 0.2)) { drag = .zero }
                    model.skip()
                case .change:
                    withAnimation(.bb(BBMotion.springSheetSnapBack)) { drag = .zero }
                    onPick()
                case nil:
                    withAnimation(.bb(BBMotion.springSheetSnapBack)) { drag = .zero }
                }
            }
    }
}

// MARK: - «Messe dall'app»

private struct AutoCategorizedList: View {
    let model: CategorizeModel
    @State private var changing: AutoCategorizedGroup?
    @State private var remember = true
    @State private var expanded: Set<String> = []
    @Environment(\.bbLocale) private var locale

    var body: some View {
        switch model.auto {
        case .loading:
            BBSkeletonRows(rows: 3)
        case .failed:
            LoadError(message: L10n.unableToLoadCategorizationSuggestion) { Task { await model.loadAuto() } }
        case .loaded(let response):
            if response.groups.isEmpty {
                EmptyState(icon: .circleCheck, title: L10n.nothingHereYet,
                           description: model.autoApplyEnabled ? L10n.transactionsAutomaticallyCategorizedB : L10n.transactionsCategorizedUsingYourRule)
            } else {
                VStack(alignment: .leading, spacing: BBSpacing.space3) {
                    BBText(AutoReviewText.summary(total: response.total, fromBank: response.groups.contains { $0.source == .banca },
                                                  autoApplyEnabled: model.autoApplyEnabled, tr: { L10n.lookup(italian: $0, $1) }),
                           style: BBTypography.body, color: .bbText2)
                    ForEach(response.groups) { group in row(group) }
                    if model.remoteLogoShown { LogoCredit() }
                }
                .bbSheet(isPresented: Binding(get: { changing != nil }, set: { if !$0 { changing = nil } }), title: L10n.changeCategory) {
                    if let group = changing {
                        CategorySheetContent(categories: model.categories.filter {
                            !$0.isFallback && $0.id != group.categoryId
                                && CategoryRules.isDirectionCompatible($0.type, isIncome: group.totalAmount > 0, isFallback: false)
                        }, usage: model.usage, description: group.label, onPick: { picked in
                            changing = nil
                            Task { await model.changeAuto(group, to: picked, remember: remember) }
                        }) {
                            BBSwitchRow(label: L10n.alwaysUseThisCategoryFor0(group.label), isOn: $remember)
                        }
                    }
                }
            }
        }
    }

    private func row(_ group: AutoCategorizedGroup) -> some View {
        let category = model.category(group.categoryId)
        let open = expanded.contains(group.groupKey)
        let count = group.transactionIds.count
        return VStack(alignment: .leading, spacing: BBSpacing.space3) {
            Button {
                if open { expanded.remove(group.groupKey) } else { expanded.insert(group.groupKey) }
            } label: {
                HStack(spacing: BBSpacing.space3) {
                    MerchantLogo(name: group.label, logoPath: group.logoPath, onRemoteLogo: { model.remoteLogoShown = true })
                    VStack(alignment: .leading, spacing: 2) {
                        BBText(group.label, style: .rowTitle, lineLimit: 1)
                        BBText("\(count == 1 ? L10n.s1Transaction : L10n.s0Transactions_57cb30(String(count))) · \(CategorizationText.dateRangeLabel(group.transactionDates, today: model.today, locale: locale))",
                               style: BBTypography.caption, color: .bbText2, lineLimit: 1)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    AmountText(value: group.totalAmount, currency: model.env.session.currency, tone: .income, style: .rowAmount)
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            HStack(spacing: BBSpacing.space2) {
                BBChip(label: category?.name ?? "", icon: BBIcon.category(category?.icon)) {
                    remember = true
                    changing = group
                }
                Spacer(minLength: 0)
                if let origin = AutoOrigin.of(group.source) {
                    AutoOriginBadge(source: origin)
                        .accessibilityLabel(originDescription(group))
                }
            }
            if open {
                VStack(spacing: BBSpacing.space1_5) {
                    ForEach(group.transactionIds.indices, id: \.self) { i in
                        let date = BBFormat.formatShortDate(group.transactionDates[safe: i] ?? "", locale: locale)
                        // CAT-097: each movement opens its detail.
                        Button { model.openMovement(group.transactionIds[i]) } label: {
                            HStack(spacing: BBSpacing.space2) {
                                BBText(date, style: BBTypography.caption, color: .bbText3)
                                    .frame(width: 52, alignment: .leading)
                                BBText(group.transactionDescriptions[safe: i] ?? "", style: BBTypography.caption, color: .bbText2, lineLimit: 1)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                                AmountText(value: group.transactionAmounts[safe: i] ?? 0, currency: model.env.session.currency, tone: .income,
                                           style: BBTypography.caption)
                            }
                            .frame(minHeight: 32)
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(BBPressableStyle(pressedBackground: .bbAlphaMuted50, shape: AnyShape(RoundedRectangle.bb(BBRadius.md)), translate: false))
                        .accessibilityLabel(L10n.openTheTransactionOf0(date))
                    }
                }
            }
        }
        .padding(BBSpacing.space4)
        .background(RoundedRectangle.bb(BBRadius.xl).fill(Color.bbCard))
        .bbDisabled(model.changingAuto.contains(group.groupKey))
    }

    private func originDescription(_ group: AutoCategorizedGroup) -> String {
        CategorizationText.autoOriginDescription(group.source, confidence: group.confidence, bankCategory: group.bankCategory,
                                                 tr: { L10n.lookup(italian: $0, $1) }) ?? ""
    }
}

extension Array {
    subscript(safe index: Int) -> Element? { indices.contains(index) ? self[index] : nil }
}

// MARK: - Ricategorizza (CAT-083…089)

private struct RecategorizeSheet: View {
    let model: CategorizeModel
    let onClose: () -> Void

    @State private var preview: Loadable<RecategorizePreview> = .loading
    @State private var checked: Set<String> = []
    @State private var applying = false
    @Environment(\.bbLocale) private var locale

    var body: some View {
        VStack(alignment: .leading, spacing: BBSpacing.space4) {
            BBText(L10n.reassignsCategoriesSetAutomaticallyB, style: BBTypography.body, color: .bbMutedForeground)
            switch preview {
            case .loading:
                BBSkeletonRows(rows: 3)
            case .failed:
                LoadError(message: L10n.unableToCalculateTheChanges) { Task { await load() } }
            case .loaded(let data):
                if let run = data.lastRun {
                    HStack {
                        BBText(L10n.lastTimeOn01Transactions(BBFormat.formatShortDate(String(run.createdAt.prefix(10)), locale: locale), String(run.changed)),
                               style: BBTypography.body, color: .bbText2)
                        Spacer()
                        BBButton(L10n.cancel_6c3de5, variant: .outline, size: .sm) {
                            Task {
                                await RuleFeedback.undo(runId: run.id, env: model.env)
                                await model.onChanged?()
                                await load()
                            }
                        }
                    }
                }
                if data.groups.isEmpty {
                    BBText(L10n.nothingToChange, style: BBTypography.cardTitle)
                    BBText(L10n.theAppAssignedCategoriesAlreadyMatc, style: BBTypography.body, color: .bbText2)
                    BBButton(L10n.close_a3be8a, variant: .outline, size: .touch, fullWidth: true, action: onClose)
                } else {
                    let total = data.groups.filter { checked.contains($0.key) }.reduce(0) { $0 + $1.count }
                    BBText(L10n.s0TransactionsWouldChangeCategoryOnl(String(data.changes)) + (data.legacyChanges > 0 ? L10n.thoseYouMayHaveChosenYourselfStart : "."),
                           style: BBTypography.body, color: .bbText2)
                    ForEach(data.groups) { group in groupRow(group) }
                    BBButton(total == 0 ? L10n.selectWhatToChange : (total == 1 ? L10n.change1Transaction : L10n.change0Transactions(String(total))),
                             size: .touch, fullWidth: true, isLoading: applying, isDisabled: total == 0) { apply(data) }
                }
            }
        }
        .task { await load() }
    }

    private func groupRow(_ group: RecategorizeGroup) -> some View {
        let isOn = checked.contains(group.key)
        let from = model.category(group.fromCategoryId)
        let to = model.category(group.toCategoryId)
        var line = "\(group.count == 1 ? L10n.s1Transaction : L10n.s0Transactions_57cb30(String(group.count))) · \(CategorizationText.dateRangeLabel([group.firstDate, group.lastDate], today: model.today, locale: locale))"
        if group.legacyCount > 0 {
            line += group.legacyCount == group.count ? " · \(L10n.possiblyChosenByYou_27a968)" : " · \(L10n.s0PossiblyChosenByYou(String(group.legacyCount)))"
        }
        return HStack(alignment: .top, spacing: BBSpacing.space3) {
            BBCheckbox(isOn: Binding(get: { isOn }, set: { if $0 { checked.insert(group.key) } else { checked.remove(group.key) } }),
                       accessibilityLabel: group.label)
                .padding(.top, 4)
            VStack(alignment: .leading, spacing: 2) {
                HStack {
                    BBText(group.label, style: BBTypography.bodyStrong, lineLimit: 1)
                    Spacer()
                    AmountText(value: group.totalAmount, currency: model.env.session.currency, tone: .income, style: BBTypography.bodyStrong)
                }
                BBText(line, style: BBTypography.caption, color: .bbText2, lineLimit: 2)
                HStack(spacing: BBSpacing.space1) {
                    Text(verbatim: from?.name ?? "").strikethrough().bbTextStyle(BBTypography.caption).foregroundStyle(Color.bbText3)
                    BBIconView(.arrowRight, size: .xs, color: .bbText3)
                    BBText(to?.name ?? "", style: BBTypography.caption)
                    if let origin = AutoOrigin(rawValue: group.source.rawValue) { AutoOriginBadge(source: origin, compact: true) }
                }
            }
        }
    }

    private func load() async {
        do {
            let data = try await model.env.transactions.recategorizePreview()
            checked = Set(data.groups.filter { $0.legacyCount == 0 }.map(\.key))
            preview = .loaded(data)
        } catch {
            preview = .failed
        }
    }

    private func apply(_ data: RecategorizePreview) {
        applying = true
        Task {
            do {
                let run = try await model.env.transactions.recategorize(RecategorizeBody(scope: "tutto", includeLegacy: true, groupKeys: Array(checked)))
                RuleFeedback.showRecategorized(run, env: model.env) { await model.onChanged?() }
                await model.loadAuto()
                await model.onChanged?()
                applying = false
                onClose()
            } catch {
                applying = false
                model.env.toasts.show(.error, (error as? APIError)?.body?.message ?? L10n.genericError)
            }
        }
    }
}
