import BuddyBudgetKit
import SwiftUI

/// Liquidità · Abbonamenti (06-subscriptions): hero, found / confirmed / stopped / price rises, archive, detail and add
/// dialogs. Twin of `SubscriptionsScreen` on Android.
struct SubscriptionsScreen: View {
    @Environment(AppEnvironment.self) private var env
    @Environment(ShellModel.self) private var shell
    @State private var model: SubscriptionsModel?

    var body: some View {
        Group {
            // TX-022: before the first account the tab says what it will show.
            if LiquidityNoAccounts.applies(shell.liquidity.accounts?.count) {
                BBScreen(title: nil) {
                    LiquiditySegmentBar()
                    LiquidityNoAccountsState(segment: .subscriptions)
                }
            } else if let model {
                SubscriptionsContent(model: model)
            } else {
                Color.clear
            }
        }
        .task {
            if shell.liquidity.accounts == nil { await shell.liquidity.loadMeta() }
            if model == nil { model = SubscriptionsModel(api: env.subscriptions, toasts: env.toasts) }
            await model?.start()
        }
    }
}

private struct SubscriptionsContent: View {
    @Bindable var model: SubscriptionsModel
    @Environment(\.bbLocale) private var locale

    var body: some View {
        let text = SubscriptionText(locale: locale, translate: { L10n.lookup(italian: $0) })
        BBScreen(title: nil, onRefresh: { await model.load() }) {
            LiquiditySegmentBar()
            switch model.state.phase {
            case .loading:
                BBSkeleton(height: 320, radius: BBRadius.xl)
            case .failed:
                LoadError(message: L10n.lookup(italian: "Impossibile caricare gli abbonamenti."),
                          onRetry: { Task { await model.retry() } })
            case .loaded:
                SubscriptionsList(model: model, text: text)
            }
        }
        .formDialog(isPresented: $model.detailOpen) {
            if let item = model.openedItem {
                SubscriptionDetailBody(model: model, item: item, text: text).id(item.key)
            }
        } footer: {
            if let item = model.openedItem {
                SubscriptionDetailActions(model: model, item: item)
            }
        }
        .formDialog(isPresented: $model.addOpen) {
            AddSubscriptionBody(model: model, text: text)
        }
        #if DEBUG
        .task { DebugSubscriptions.apply(to: model) }
        #endif
    }
}

private struct SubscriptionsList: View {
    @Bindable var model: SubscriptionsModel
    let text: SubscriptionText
    @Environment(\.bbHideAmounts) private var hideAmounts

    var body: some View {
        let state = model.state
        let sections = state.sections
        ScrollViewReader { proxy in
        VStack(alignment: .leading, spacing: BBSpacing.space8) {
            SubscriptionsHero(state: state, text: text)

            if state.isEmpty {
                VStack(alignment: .leading, spacing: BBSpacing.space3) {
                    SectionTitleRow(title: L10n.lookup(italian: "Ancora nessun abbonamento"), icon: .searchCheck, color: .bbSwatchTeal)
                    BBText(L10n.lookup(italian: "Cerchiamo nei tuoi movimenti gli addebiti che tornano con lo stesso importo, ogni settimana, mese, trimestre o anno. Servono almeno tre mesi di movimenti (due anni, per quelli annuali). Se ne hai uno che non compare, aggiungilo a mano."),
                           style: BBTypography.body, color: .bbText2)
                }
                .padding(BBSpacing.space5)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(RoundedRectangle.bb(BBRadius.radius2xl).fill(Color.bbForeground.opacity(0.04)))
            }

            if !sections.toConfirm.isEmpty {
                SubscriptionsSection(title: L10n.lookup(italian: "Trovati nei tuoi movimenti"), icon: .searchCheck, color: .bbSwatchTeal,
                                     intro: L10n.lookup(italian: "Addebiti che tornano con regolarità. Conferma solo i veri abbonamenti: non tutto ciò che ricorre lo è.")) {
                    ForEach(sections.toConfirm, id: \.key) { item in
                        row(item) {
                            BBButton(L10n.lookup(italian: "È un abbonamento"), icon: .check, size: .touch, isDisabled: state.isSaving) {
                                model.quick(item, .confermato)
                            }
                            BBButton(L10n.lookup(italian: "Non lo è"), icon: .x, variant: .outline, size: .touch, isDisabled: state.isSaving) {
                                model.quick(item, .escluso)
                            }
                        }
                    }
                }
            }

            SubscriptionsSection(title: L10n.lookup(italian: "I tuoi abbonamenti"), icon: .repeat, color: .bbSwatchPurple) {
                if sections.confirmed.isEmpty {
                    BBText(L10n.lookup(italian: "Nessun abbonamento confermato."), style: BBTypography.body, color: .bbText2)
                } else {
                    ForEach(sections.confirmed, id: \.key) { item in row(item) { EmptyView() } }
                }
                BBButton(L10n.lookup(italian: "Aggiungi a mano"), icon: .plus, variant: .outline, size: .touch) { model.startAdding() }
                    .padding(.top, BBSpacing.space1)
            }

            if !sections.stopped.isEmpty {
                SubscriptionsSection(title: L10n.lookup(italian: "Non addebitati da un po'"), icon: .moonStar, color: .bbSwatchAmber,
                                     intro: L10n.lookup(italian: "Dovevano tornare e non li vediamo più: sono terminati, o te ne sei dimenticato? Se non sono terminati, controlla che il conto sia sincronizzato.")) {
                    ForEach(sections.stopped, id: \.key) { item in
                        row(item) {
                            BBButton(L10n.lookup(italian: "È terminato"), variant: .outline, size: .touch, isDisabled: state.isSaving) {
                                model.quick(item, .terminato)
                            }
                        }
                    }
                }
            }

            if !sections.priceRises.isEmpty {
                SubscriptionsSection(title: L10n.lookup(italian: "Aumenti di prezzo"), icon: .trendingUp, color: .bbSwatchRed) {
                    ForEach(sections.priceRises, id: \.key) { item in
                        if let change = item.priceChange {
                            PriceRiseRow(name: item.name,
                                         hint: text.priceRiseHint(change, currency: state.currency, masked: hideAmounts),
                                         delta: text.priceRiseDelta(change, currency: state.currency, masked: hideAmounts))
                        }
                    }
                }
            }

            if !sections.ended.isEmpty || !sections.excluded.isEmpty || model.logosShown {
                VStack(alignment: .leading, spacing: BBSpacing.space1) {
                    ArchiveGroup(title: L10n.lookup(italian: "Terminati"), items: sections.ended, expanded: $model.endedExpanded) { row($0) { EmptyView() } }
                    ArchiveGroup(title: L10n.lookup(italian: "Non sono abbonamenti"), items: sections.excluded, expanded: $model.excludedExpanded) {
                        row($0) { EmptyView() }
                    }
                    if model.logosShown { LogoCredit().padding(.top, BBSpacing.space2) }
                }
            }
            Color.clear.frame(height: 0).id("subscriptions-bottom")
        }
        #if DEBUG
        .onChange(of: model.debugScrollToBottom) { _, scroll in
            if scroll { proxy.scrollTo("subscriptions-bottom", anchor: .bottom) }
        }
        #endif
        }
    }

    private func row<Actions: View>(_ item: SubscriptionItem, @ViewBuilder actions: @escaping () -> Actions) -> some View {
        SubscriptionRow(item: item, currency: model.state.currency, today: model.state.today, text: text,
                        onOpen: { model.open(item) }, onRemoteLogo: { if !model.logosShown { model.logosShown = true } },
                        actions: actions)
    }
}

// MARK: - Hero (SUB-002…005)

private struct SubscriptionsHero: View {
    let state: SubscriptionsUiState
    let text: SubscriptionText
    @Environment(\.bbHideAmounts) private var hideAmounts

    var body: some View {
        let totals = state.totals
        let summary = text.heroSummary(totals, currency: state.currency, masked: hideAmounts)
        let next = text.nextChargeLine(state.nextCharge, today: state.today, currency: state.currency, masked: hideAmounts)
        VStack(alignment: .leading, spacing: 0) {
            BBText(L10n.lookup(italian: "Gli abbonamenti ti costano ogni mese"), style: BBTypography.bodyLarge, color: .bbText2)
            MoneyHero(value: totals.monthly, currency: state.currency)
            SubscriptionRunsText(runs: summary, color: .bbText2)
                .padding(.top, BBSpacing.space3)
            if let next {
                HStack(alignment: .top, spacing: BBSpacing.space2) {
                    BBIconView(.bellRing, size: .md, color: .bbPrimary).padding(.top, 2)
                    SubscriptionRunsText(runs: next.main, color: .bbForeground, trailing: next.window)
                }
                .padding(.top, BBSpacing.space2)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(L10n.lookup(italian: "Totale degli abbonamenti"))
    }
}

/// Text-sm sentence with emphasized runs (name semibold, amounts mono semibold in `--foreground`).
struct SubscriptionRunsText: View {
    let runs: [SubscriptionTextRun]
    let color: Color
    var trailing: String?

    private static let amountStyle = BBTextStyle(role: .sans, size: 14, lineHeight: 20, weight: 600, letterSpacingEm: 0,
                                                 tabularNums: true, uppercase: false, anchor: .subheadline)

    var body: some View {
        var result = Text(verbatim: "")
        for run in runs {
            switch run.style {
            case .plain: result = result + Text(verbatim: run.text).foregroundColor(color)
            case .strong: result = result + Text(verbatim: run.text).font(BBTypography.body.with(weight: 600).font).foregroundColor(.bbForeground)
            case .amount: result = result + Text(verbatim: run.text).font(Self.amountStyle.font).foregroundColor(.bbForeground)
            }
        }
        if let trailing { result = result + Text(verbatim: " " + trailing).foregroundColor(.bbText2) }
        return result.bbTextStyle(BBTypography.body)
            .fixedSize(horizontal: false, vertical: true)
    }
}

// MARK: - Sections

/// Web `SectionTitle` (#427): the display-face title alone; `icon`/`color` are no longer drawn.
struct SectionTitleRow: View {
    let title: String
    let icon: BBIcon
    let color: Color

    var body: some View {
        BBText(title, style: .sectionHeading).accessibilityAddTraits(.isHeader)
    }
}

private struct SubscriptionsSection<Content: View>: View {
    let title: String
    let icon: BBIcon
    let color: Color
    var intro: String?
    @ViewBuilder let content: () -> Content

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            SectionTitleRow(title: title, icon: icon, color: color).padding(.bottom, BBSpacing.space3)
            if let intro {
                BBText(intro, style: BBTypography.body, color: .bbText2).padding(.bottom, BBSpacing.space3)
            }
            VStack(alignment: .leading, spacing: BBSpacing.space2) { content() }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

/// `Aumenti di prezzo` row (web `SoftRow`): not tappable.
private struct PriceRiseRow: View {
    let name: String
    let hint: String
    let delta: String

    var body: some View {
        HStack(spacing: BBSpacing.space3_5) {
            VStack(alignment: .leading, spacing: 0) {
                BBText(name, style: .rowTitle, lineLimit: 1)
                BBText(hint, style: BBTypography.body, color: .bbText2)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            BBText(delta, style: SubscriptionRunsText.deltaStyle, color: .bbNeg)
        }
        .padding(.horizontal, BBSpacing.space4)
        .padding(.vertical, BBSpacing.space3)
        .frame(minHeight: 56)
        .background(RoundedRectangle.bb(BBRadius.radius2xl).fill(Color.bbForeground.opacity(0.04)))
        .accessibilityElement(children: .combine)
    }
}

extension SubscriptionRunsText {
    static let deltaStyle = BBTextStyle(role: .sans, size: 14, lineHeight: 20, weight: 600, letterSpacingEm: 0,
                                        tabularNums: true, uppercase: false, anchor: .subheadline)
}

/// Archive group (SUB-012): native disclosure row with the count, collapsed by default, hidden when empty.
private struct ArchiveGroup<Row: View>: View {
    let title: String
    let items: [SubscriptionItem]
    @Binding var expanded: Bool
    @ViewBuilder let row: (SubscriptionItem) -> Row
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        if !items.isEmpty {
            VStack(alignment: .leading, spacing: BBSpacing.space2) {
                Button {
                    withAnimation(.bbMotion(.easeInOut(duration: BBMotion.durationBase), reduceMotion: reduceMotion)) { expanded.toggle() }
                } label: {
                    HStack(spacing: BBSpacing.space2) {
                        BBIconView(.chevronRight, size: .md, color: .bbText2)
                            .rotationEffect(.degrees(expanded ? 90 : 0))
                        BBText("\(title) (\(items.count))", style: BBTypography.body.with(weight: 600), color: .bbText2)
                        Spacer(minLength: 0)
                    }
                    .frame(minHeight: BBLayout.minTouchTarget)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityAddTraits(expanded ? .isSelected : [])
                if expanded {
                    ForEach(items, id: \.key) { row($0) }
                }
            }
        }
    }
}
