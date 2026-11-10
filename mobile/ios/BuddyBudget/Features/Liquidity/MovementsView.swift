import BuddyBudgetKit
import SwiftUI

/// Movimenti as a Liquidità segment screen (frame contract of stream a: `BBScreen` «Liquidità» with
/// `LiquiditySegmentBar()` first). Android: MovementsScreen in MovementsView.kt.
struct MovementsScreen: View {
    @Environment(ShellModel.self) private var shell
    @Environment(\.shellBack) private var back

    var body: some View {
        let model = shell.liquidity
        BBScreen(title: nil, onBack: back, onRefresh: { await model.refresh() }) {
            LiquiditySegmentBar()
            MovementsView(model: model)
        }
        .task { await model.start() }
        .onChange(of: shell.dataVersion) { _, _ in Task { await model.refresh() } }
    }
}

/// Liquidità · Movimenti (TX-007…027, TX-049…051, phone layout of the mobile notes): month sentence, total,
/// account chips, «Il mese» card with budgets, toolbar, the day-grouped feed. Android: MovementsView.kt.
struct MovementsView: View {
    let model: LiquidityModel

    @Environment(ShellModel.self) private var shell
    @Environment(\.liquiditySegment) private var segment
    @Environment(\.bbLocale) private var locale
    @Environment(\.bbHideAmounts) private var hideAmounts
    @State private var sheet: MovementSheet?
    @State private var deleting: Movement?

    var body: some View {
        VStack(alignment: .leading, spacing: BBSpacing.space8) {
            if LiquidityNoAccounts.applies(model.accounts?.count) {
                LiquidityNoAccountsState(segment: .movements)
            } else {
                content
            }
        }
        .movementSheets(model: model, sheet: $sheet, deleting: $deleting)
        #if DEBUG
        .onChange(of: model.feedState) { _, state in debugSheet(state) }
        #endif
    }

    /// Phone order of the web page (#400/#413): the overview (sentence, hero, account tiles), the import link, the
    /// toolbar and the day-grouped feed, then the month column («Il mese», «Da decidere», «Gruppi di spesa»).
    @ViewBuilder private var content: some View {
        VStack(alignment: .leading, spacing: BBSpacing.space6) {
            if debugShows(0) { MonthSentence(model: model) }
            if debugShows(1) { hero }
            if debugShows(2) { accountChips }
        }
        // 2d: «Importa da CSV o Excel →» (/importazioni).
        TextLinkButton(L10n.lookup(italian: "Importa da CSV o Excel →")) { shell.open(.imports) }
        VStack(alignment: .leading, spacing: BBSpacing.space2) {
            if debugShows(3) { toolbar }
            feed
        }
        MonthCard(model: model).padding(.top, BBSpacing.space2)
    }

    #if DEBUG
    private func debugSheet(_ state: FeedState) {
        // `-BBSheet actions|category|split|note|edit|add`: opens a sheet on the first movement (screenshots).
        guard state == .loaded, let kind = DebugLaunch.value("-BBSheet"), sheet == nil else { return }
        let first = model.feed.items.first { $0.isManual && MovementKind.of($0, category: model.category($0.categoryId)) != .transfer }
            ?? model.feed.items.first { MovementKind.of($0, category: model.category($0.categoryId)) == .plain }
        guard let m = first else { return }
        switch kind {
        case "actions": sheet = .actions(m)
        case "category": sheet = .category(m)
        case "split": sheet = .split(m)
        case "note": sheet = .note(m)
        case "edit": sheet = .edit(m)
        case "add": model.addRequested = true
        default: break
        }
    }
    #endif

    // MARK: Hero (TX-009…011)

    private var hero: some View {
        let points = model.heroPoints
        let value = model.selectedAccount?.balance ?? model.month.value?.accounts.total
        let delta = points.flatMap(LiquidityHero.delta)
        let label = model.selectedAccount?.name ?? L10n.totalCash
        let money = { (v: Double) in BBFormat.formatCurrency(v, currency: model.currency, locale: locale, maximumFractionDigits: 0, masked: hideAmounts) }
        return VStack(alignment: .leading, spacing: 0) {
            BBText(label, style: BBTypography.bodyLarge, color: .bbText2)
            if let value {
                MoneyHero(value: value, currency: model.currency)
            } else {
                BBSkeleton(width: 200, height: 48)
            }
            // Change over the period: «↗ +828 € negli ultimi 3 mesi».
            HStack(spacing: BBSpacing.space2) {
                if let delta {
                    let up = delta >= 0
                    HStack(spacing: BBSpacing.space1_5) {
                        BBIconView(up ? .trendingUp : .trendingDown, points: 16, color: up ? .bbPos : .bbNeg)
                        BBText((up ? "+" : BBFormat.minusSign) + money(abs(delta)), style: BBTypography.body.with(weight: 600),
                               color: up ? .bbPos : .bbNeg).monospacedDigit()
                    }
                    BBText(L10n.lookup(italian: LiquidityHero.phrase(model.heroPeriod)), style: BBTypography.body, color: .bbText2)
                }
            }
            .frame(minHeight: 20)
            .padding(.top, BBSpacing.space3)
            // TX-076: imported data on its way into the balances.
            if let refresh = shell.chartRefresh(dataUpdatedAt: model.monthUpdatedAt, isFetching: model.fetchingMonth) {
                ChartRefreshNote(state: refresh).padding(.top, BBSpacing.space2)
            }
            Group {
                if let points {
                    BBTrendChart(values: points.map(\.value),
                                 labels: points.map { CalendarDate(iso: $0.date).map { BBFormat.formatLongDate($0, locale: locale) } ?? $0.date },
                                 height: 260, formatValue: money,
                                 accessibilitySummary: heroSummary(label: label, points: points, value: value ?? 0, money: money))
                } else {
                    BBSkeleton(height: 260, radius: 0)
                }
            }
            .padding(.horizontal, -BBSpacing.space4)
            .padding(.top, BBSpacing.space2)
            PeriodSelector(options: LiquidityHero.periods.map { ($0, LiquidityHero.label($0)) },
                           selection: Binding(get: { model.heroPeriod }, set: { model.setHeroPeriod($0) }),
                           accessibilityLabel: L10n.lookup(italian: "Periodo del grafico"))
                .fixedSize(horizontal: true, vertical: false)
                .frame(maxWidth: .infinity)
                .padding(.top, BBSpacing.space3)
        }
        .onChange(of: model.monthUpdatedAt) { _, at in shell.settleChart(dataUpdatedAt: at, isFetching: model.fetchingMonth) }
        .onChange(of: model.fetchingMonth) { _, fetching in shell.settleChart(dataUpdatedAt: model.monthUpdatedAt, isFetching: fetching) }
    }

    /// Web chart description: «{label}: da {first} a {value} {phrase}.»
    private func heroSummary(label: String, points: [LiquidityHeroPoint], value: Double, money: (Double) -> String) -> String {
        guard let first = points.first else { return "\(label): \(money(value))." }
        return L10n.lookup(italian: "{0}: da {1} a {2} {3}.", ["0": label, "1": money(first.value), "2": money(value),
                                                               "3": L10n.lookup(italian: LiquidityHero.phrase(model.heroPeriod))])
    }

    // MARK: Account chips (TX-012/013)

    @ViewBuilder private var accountChips: some View {
        if let accounts = model.accounts {
            if !accounts.isEmpty {
                ScrollView(.horizontal) {
                    HStack(spacing: BBSpacing.space2_5) {
                        AccountTile(name: L10n.allAccounts, amount: model.month.value?.accounts.total ?? accounts.reduce(0) { $0 + $1.balance },
                                    currency: model.currency, isSelected: model.selectedAccount == nil) { model.selectAccount(nil) }
                        ForEach(accounts) { account in
                            AccountTile(name: account.name, amount: account.balance, currency: model.currency,
                                        needsAttention: account.health?.needsRenewal == true,
                                        isSelected: model.selectedAccount?.id == account.id) { model.selectAccount(account.id) }
                        }
                        // TX-012: dashed «+ Conto» tile opening the New-account dialog.
                        Button { shell.open(path: "/liquidita/conti?nuovo=1") } label: {
                            HStack(spacing: BBSpacing.space1_5) {
                                BBIconView(.plus, points: 16, color: .bbPrimary)
                                BBText(L10n.lookup(italian: "Conto"), style: BBTypography.bodyLarge.with(weight: 600), color: .bbPrimary)
                            }
                            .padding(.horizontal, BBSpacing.space4)
                            .frame(minHeight: 56)
                            .overlay(RoundedRectangle.bb(BBRadius.radius2xl).strokeBorder(Color.bbBorder, style: StrokeStyle(lineWidth: 1, dash: [4, 3])))
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(BBPressableStyle(translate: false))
                    }
                    .padding(.horizontal, BBSpacing.space4)
                }
                .scrollIndicators(.hidden)
                .padding(.horizontal, -BBSpacing.space4)
                .accessibilityElement(children: .contain)
                .accessibilityLabel(L10n.filterByAccount)
            }
        } else {
            BBSkeleton(height: 60, radius: BBRadius.radius2xl)
        }
    }

    // MARK: Toolbar (TX-014…017)

    private var toolbar: some View {
        @Bindable var model = model
        return VStack(alignment: .leading, spacing: BBSpacing.space3) {
            SearchField(text: $model.search, placeholder: L10n.searchTransactions)
                .onChange(of: model.search) { _, _ in model.searchChanged() }
            let toFix = model.uncategorizedCount
            ScrollView(.horizontal) {
                HStack(spacing: BBSpacing.space2_5) {
                    SegmentedControl(options: [(MovementType.tutte, L10n.all_148ba1), (MovementType.uscita, L10n.expenses_6db1a3),
                                               (MovementType.entrata, L10n.income_5a21be)],
                                     selection: Binding(get: { model.type }, set: { model.setType($0) }),
                                     accessibilityLabel: L10n.transactionType_2b7af3)
                    if toFix > 0 {
                        ToolbarChip(label: L10n.toReview0(String(toFix)), style: model.uncategorizedOnly ? .negActive : .plain) {
                            model.toggleUncategorized()
                        }
                    }
                }
                .padding(.horizontal, BBSpacing.space4)
            }
            .scrollIndicators(.hidden)
            .padding(.horizontal, -BBSpacing.space4)
            if toFix > 0 || model.categoryFilter != nil {
                HStack(spacing: BBSpacing.space2_5) {
                    if toFix > 0 {
                        ToolbarChip(label: L10n.categoriseWithAi, icon: .sparkles, style: .primary) { shell.push(.destination(.categorize)) }
                    }
                    if let category = model.categoryFilter {
                        ToolbarChip(label: category.name, icon: .x, style: .primarySoft) { model.setCategoryFilter(nil) }
                            .accessibilityHint(L10n.clearFilter)
                    }
                }
            }
        }
    }

    // MARK: Feed (TX-018…022)

    @ViewBuilder private var feed: some View {
        switch model.feedState {
        case .loading:
            BBSkeletonRows(rows: 5)
                .accessibilityLabel(L10n.loadingTransactions)
        case .failed:
            LoadError(message: L10n.unableToLoadTransactions) { Task { await model.reloadFeed() } }
        case .loaded:
            if model.feed.isEmpty {
                emptyFeed
            } else {
                let groups = model.feed.groups(today: model.today, locale: locale)
                LazyVStack(alignment: .leading, spacing: 0) {
                    ForEach(groups, id: \.date) { group in
                        VStack(alignment: .leading, spacing: 0) {
                            DayHeader(label: L10n.lookup(italian: group.label), total: group.total, currency: model.currency)
                            ForEach(group.items) { movement in
                                MovementRow(model: model, movement: movement,
                                            showAccount: model.selectedAccount == nil,
                                            onTap: { shell.openMovement(movement.id, placeholder: movement) },
                                            onCategory: { sheet = .category(movement) },
                                            onActions: { sheet = .actions(movement) })
                            }
                        }
                    }
                }
                if model.feed.hasMore {
                    BBButton(L10n.showMoreTransactions, variant: .outline, size: .touch, fullWidth: true, isLoading: model.loadingMore) {
                        Task { await model.loadMore() }
                    }
                }
                if model.remoteLogoShown { LogoCredit() }
            }
        }
    }

    @ViewBuilder private var emptyFeed: some View {
        if model.query.hasFilters {
            BBText(L10n.noTransactionsMatchTheFilters_d9a227, style: BBTypography.body, color: .bbMutedForeground)
                .padding(.vertical, BBSpacing.space4)
        } else if (model.accounts ?? []).isEmpty {
            EmptyState(icon: .landmark, title: L10n.firstAddAnAccount, description: L10n.transactionsBelongToAnAccountCreate,
                       primary: BBStateAction(label: L10n.createAnAccount) { segment?.wrappedValue = .accounts })
        } else {
            // TX-022: «Importa un file» (/importazioni) and «Aggiungi un movimento».
            EmptyState(icon: .receipt, title: L10n.noTransactionsYet, description: L10n.importYourBankSCsvOrStatementOrR,
                       primary: BBStateAction(label: L10n.lookup(italian: "Importa un file")) { shell.open(.imports) },
                       secondary: BBStateAction(label: L10n.addTransaction) { model.addRequested = true })
        }
    }
}

/// TX-008: «Hai X su N conti.» + the server pace line (strong parts in bold) + «N movimenti aspettano una categoria.».
/// The height is reserved while loading.
struct MonthSentence: View {
    let model: LiquidityModel
    @Environment(\.bbLocale) private var locale
    @Environment(\.bbHideAmounts) private var hideAmounts

    var body: some View {
        if let month = model.month.value {
            sentence(month)
                .font(Self.voice.font)
                .foregroundStyle(Color.bbText2)
                .lineSpacing(Self.voice.lineHeight - Self.voice.uiFont.lineHeight)
                .fixedSize(horizontal: false, vertical: true)
        } else {
            VStack(alignment: .leading, spacing: BBSpacing.space2) {
                BBSkeleton(height: 18)
                BBSkeleton(width: 220, height: 18)
            }
        }
    }

    /// text-lg leading-relaxed `--text-2`; strong parts font-heading medium `--foreground`.
    static let voice = BBTypography.bodyLarge.with(size: 18, lineHeight: 29)
    static let strong = BBTypography.bodyLarge.with(size: 18, lineHeight: 29, weight: 500)

    private func sentence(_ month: LiquidityMonth) -> Text {
        var text = Text("")
        if month.accounts.count >= 1 {
            let total = BBFormat.formatCurrency(month.accounts.total, currency: model.currency, locale: locale, maximumFractionDigits: 0,
                                                masked: hideAmounts)
            let accounts = month.accounts.count == 1 ? L10n.youHave0In1Account(total) : L10n.youHave0Across1Accounts(total, String(month.accounts.count))
            // Only the amount is strong, as on the web («Hai **23.915 €** su 6 conti.»).
            if let range = accounts.range(of: total) {
                text = text + Text(verbatim: String(accounts[..<range.lowerBound]))
                    + Text(verbatim: total).font(Self.strong.font).foregroundStyle(Color.bbForeground)
                    + Text(verbatim: String(accounts[range.upperBound...]) + " ")
            } else {
                text = text + Text(verbatim: accounts + " ")
            }
        }
        for line in month.voice {
            for segment in line.segments {
                let value = hideAmounts ? VoiceText.masked(segment.text) : segment.text
                text = text + Text(verbatim: value)
                    .font(segment.strong ? Self.strong.font : Self.voice.font)
                    .foregroundStyle(segment.strong ? Color.bbForeground : Color.bbText2)
            }
            text = text + Text(verbatim: " ")
        }
        if month.toFix > 0 {
            let waiting = month.toFix == 1 ? L10n.s1TransactionIsWaitingForACategory : L10n.s0TransactionsAreWaitingForACategor_6ea7ce(String(month.toFix))
            text = text + Text(verbatim: waiting).foregroundStyle(Color.bbText2)
        }
        return text
    }
}

/// «Il mese» (TX-049/050) as a compact card, plus the month budgets (`GET /api/liquidity/month` → `budgets`).
struct MonthCard: View {
    let model: LiquidityModel
    @Environment(ShellModel.self) private var shell
    @Environment(\.liquiditySegment) private var segment
    @Environment(\.bbLocale) private var locale
    @Environment(\.bbHideAmounts) private var hideAmounts

    var body: some View {
        VStack(alignment: .leading, spacing: BBSpacing.space8) {
            BBSection(title: L10n.theMonth, actionLabel: segment != nil ? L10n.analysis : nil,
                      onAction: { segment?.wrappedValue = .analysis }) {
                switch model.month {
                case .loading:
                    VStack(spacing: BBSpacing.space1_5) { ForEach(0..<3, id: \.self) { _ in BBSkeleton(height: 56, radius: BBRadius.radius2xl) } }
                case .failed:
                    LoadError(message: L10n.unableToLoadTransactions) { Task { await model.loadMonth() } }
                case .loaded(let month):
                    VStack(spacing: BBSpacing.space1_5) {
                        BBSoftRow(title: L10n.income_5a21be) { amount(month.income, tone: .pos) }
                        BBSoftRow(title: L10n.expenses_2f97bc) { amount(-month.spent, tone: .neg) }
                        BBSoftRow(title: L10n.surplusSoFar, hint: month.pace.typicalSoFar.map { typicalHint($0) }) {
                            amount(month.surplus, tone: .signed)
                        }
                    }
                }
            }
            if let month = model.month.value {
                if month.toFix > 0 {
                    BBSection(title: L10n.toReview_88b521) {
                        BBSoftRow(title: month.toFix == 1 ? L10n.s1Transaction : L10n.s0Transactions_57cb30(String(month.toFix)),
                                  hint: L10n.uncategorizedReviewGroupsUsingSugges) {
                            BBButton(L10n.categorise, size: .touch) { shell.push(.destination(.categorize)) }
                        }
                    }
                }
                SpendGroupsSection(groups: month.groups, currency: model.currency)
            }
        }
    }

    private func amount(_ value: Double, tone: AmountTone) -> some View {
        AmountText(value: value, currency: model.currency, tone: tone, signed: true, style: .rowAmount)
    }

    private func typicalHint(_ value: Double) -> String {
        L10n.typicallyByNow0Spent(BBFormat.formatCurrency(value, currency: model.currency, locale: locale, maximumFractionDigits: 0,
                                                           masked: hideAmounts))
    }
}

/// «Gruppi di spesa» of the month (web `MonthAside`): the four expense groups with a bar each, scaled to the largest.
private struct SpendGroupsSection: View {
    let groups: [LiquidityMonth.Group]
    let currency: String
    @Environment(\.bbLocale) private var locale
    @Environment(\.bbHideAmounts) private var hideAmounts

    private static let keys = ["dovuta", "voluta", "futuro", "saltuaria"]

    var body: some View {
        let shown = Self.keys.compactMap { key in groups.first { $0.key == key } }
        if !shown.isEmpty {
            let top = max(shown.map(\.amount).max() ?? 1, 1)
            BBSection(title: L10n.lookup(italian: "Gruppi di spesa")) {
                VStack(spacing: BBSpacing.space3_5) {
                    ForEach(shown) { group in
                        VStack(spacing: BBSpacing.space1_5) {
                            HStack {
                                BBText(L10n.lookup(italian: group.label), style: BBTypography.bodyLarge.with(weight: 600))
                                Spacer()
                                BBText(BBFormat.formatCurrency(group.amount, currency: currency, locale: locale, masked: hideAmounts),
                                       style: BBTypography.bodyLarge).monospacedDigit()
                            }
                            GeometryReader { proxy in
                                ZStack(alignment: .leading) {
                                    Capsule().fill(Color.bbMuted)
                                    Capsule().fill(Self.color(group.key)).frame(width: proxy.size.width * CGFloat(max(0, group.amount) / top))
                                }
                            }
                            .frame(height: 10)
                            .accessibilityHidden(true)
                        }
                        .accessibilityElement(children: .combine)
                    }
                }
            }
        }
    }

    static func color(_ key: String) -> Color {
        switch key {
        case "dovuta": .bbCategoryGroupDovuta
        case "voluta": .bbCategoryGroupVoluta
        case "futuro": .bbCategoryGroupFuturo
        case "saltuaria": .bbCategoryGroupSaltuaria
        default: .bbCategoryGroupUncategorized
        }
    }
}

/// Day header of the feed (TX-018): label and the day's net effective total.
struct DayHeader: View {
    let label: String
    let total: Double
    let currency: String

    var body: some View {
        HStack {
            BBText(label.capitalized, style: BBTypography.bodyStrong.with(weight: 600), color: .bbText2)
            Spacer()
            AmountText(value: total, currency: currency, tone: .signed, signed: true, style: BBTypography.bodyStrong.with(weight: 600))
        }
        .padding(.horizontal, BBSpacing.space1_5)
        .padding(.top, BBSpacing.space5)
        .padding(.bottom, BBSpacing.space1)
        .accessibilityAddTraits(.isHeader)
    }
}

/// DEBUG-only `-BBSkip <n>`: hides the first n blocks of a long screen so screenshots reach the lower content.
@MainActor func debugShows(_ index: Int) -> Bool {
    #if DEBUG
    return index >= (DebugLaunch.value("-BBSkip").flatMap(Int.init) ?? 0)
    #else
    return true
    #endif
}

/// Account filter tile (web `AccountChips`, TX-012/013): amount on top (font-heading medium), name below (text-sm
/// `--text-2`), radius 2xl; selected = `--primary` 1.5 border on `--primary @ 10%`, otherwise `--foreground @ 4%`.
struct AccountTile: View {
    let name: String
    let amount: Double
    let currency: String
    var needsAttention = false
    let isSelected: Bool
    let action: () -> Void

    @Environment(\.bbLocale) private var locale
    @Environment(\.bbHideAmounts) private var hideAmounts

    var body: some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 0) {
                BBText(BBFormat.formatCurrency(amount, currency: currency, locale: locale, maximumFractionDigits: 0, masked: hideAmounts),
                       style: BBTypography.bodyLarge.with(weight: 500), lineLimit: 1)
                    .monospacedDigit()
                HStack(spacing: BBSpacing.space1) {
                    BBText(name, style: BBTypography.body, color: .bbText2, lineLimit: 1)
                    if needsAttention { BBIconView(.triangleAlert, size: .sm, color: .bbNeg) }
                }
            }
            .padding(.horizontal, BBSpacing.space4)
            .padding(.vertical, BBSpacing.space1_5)
            .frame(minHeight: 56)
            .background(RoundedRectangle.bb(BBRadius.radius2xl).fill(isSelected ? Color.bbAlphaPrimary10 : Color.bbForeground.opacity(0.04)))
            .overlay(RoundedRectangle.bb(BBRadius.radius2xl).strokeBorder(isSelected ? Color.bbPrimary : .clear, lineWidth: 1.5))
            .contentShape(Rectangle())
        }
        .buttonStyle(BBPressableStyle(translate: false))
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }
}

/// Toolbar buttons of Movimenti (web `MovementsToolbar`): 44 high, radius xl, text-sm semibold.
struct ToolbarChip: View {
    enum Style { case plain, negActive, primary, primarySoft }
    let label: String
    var icon: BBIcon?
    let style: Style
    let action: () -> Void

    var body: some View {
        let (bg, fg, border): (Color, Color, Color) = switch style {
        case .plain: (.bbCard, .bbForeground, .bbBorder)
        case .negActive: (.bbNegSoft, .bbNeg, .bbNeg)
        case .primary: (.bbAlphaPrimary10, .bbPrimary, Color.bbPrimary.opacity(0.3))
        case .primarySoft: (.bbAlphaPrimary10, .bbPrimary, .clear)
        }
        Button(action: action) {
            HStack(spacing: BBSpacing.space1_5) {
                if let icon { BBIconView(icon, size: .md, color: fg) }
                BBText(label, style: BBTypography.bodyStrong.with(weight: 600), color: fg, lineLimit: 1)
            }
            .padding(.horizontal, BBSpacing.space3_5)
            .frame(minHeight: BBLayout.minTouchTarget)
            .background(RoundedRectangle.bb(BBRadius.xl).fill(bg))
            .overlay(RoundedRectangle.bb(BBRadius.xl).strokeBorder(border, lineWidth: 1.5))
            .contentShape(Rectangle())
        }
        .buttonStyle(BBPressableStyle(translate: false))
        .accessibilityAddTraits(style == .negActive ? .isSelected : [])
    }
}
