import BuddyBudgetKit
import SwiftUI

/// «Il tuo quadro» in «Altro» (SHELL-018, SHELL-020, SHELL-028…038): a collapsible row that, once opened, shows the
/// enabled modules Oggi, Prossime scadenze, Obiettivo FIRE, Portafoglio and Watchlist. Twin of `InsightsSection` on Android.
struct InsightsSection: View {
    @Environment(ShellModel.self) private var shell

    /// DEBUG `-BBQuadro top`: the section opened at the top of «Altro» for screenshots; always false in release.
    @MainActor static var debugOnTop: Bool {
        #if DEBUG
        DebugLaunch.value("-BBQuadro") == "top"
        #else
        false
        #endif
    }

    var body: some View {
        let model = shell.insights
        VStack(alignment: .leading, spacing: 0) {
            MoreSectionTitle(L10n.lookup(italian: "Il tuo quadro"))
            Button { model.toggleOpen() } label: {
                HStack(spacing: BBSpacing.space3) {
                    VStack(alignment: .leading, spacing: 0) {
                        BBText(L10n.lookup(italian: "Patrimonio, scadenze e obiettivo"), style: BBTypography.bodyLarge.with(size: 15, lineHeight: 19, weight: 600))
                        BBText(L10n.lookup(italian: model.isOpen ? "Tocca per chiudere" : "Tocca per aprire il riepilogo"), style: BBTypography.caption,
                               color: .bbText2)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    BBIconView(.chevronDown, size: .md, color: .bbText3)
                        .rotationEffect(.degrees(model.isOpen ? 180 : 0))
                }
                .padding(.horizontal, BBSpacing.space3)
                .padding(.vertical, BBSpacing.space2)
                .frame(minHeight: 56)
                .contentShape(Rectangle())
            }
            .buttonStyle(BBPressableStyle(pressedBackground: .bbMuted, shape: AnyShape(RoundedRectangle.bb(BBRadius.xl)), translate: false))
            .accessibilityValue(model.isOpen ? L10n.lookup(italian: "Tocca per chiudere") : L10n.lookup(italian: "Tocca per aprire il riepilogo"))
            if model.isOpen {
                InsightModules(model: model)
                    .padding(.horizontal, BBSpacing.space1)
                    .padding(.top, BBSpacing.space2)
            }
        }
    }
}

private struct InsightModules: View {
    let model: InsightsModel
    @Environment(AppEnvironment.self) private var env
    @Environment(ShellModel.self) private var shell
    @Environment(\.bbLocale) private var locale
    @Environment(\.bbHideAmounts) private var hide

    var body: some View {
        let modules = model.modules
        let visible = modules.filter(hasContent)
        VStack(alignment: .leading, spacing: BBSpacing.space1) {
            ForEach(modules, id: \.self) { module in
                moduleView(module, eye: module == visible.first && module != .scadenze && module != .fire)
            }
        }
    }

    /// SHELL-038: nothing when the module has no content (or failed, SHELL-037).
    private func hasContent(_ module: SidebarModuleId) -> Bool {
        switch module {
        case .oggi: model.summary.value?.netWorth != nil
        case .portafoglio: model.summary.value?.portfolio != nil
        case .watchlist: !(model.summary.value?.watchlist.isEmpty ?? true)
        case .scadenze: !(model.deadlines.value?.items.isEmpty ?? true)
        case .fire: model.fire.value != nil
        }
    }

    @ViewBuilder private func moduleView(_ module: SidebarModuleId, eye: Bool) -> some View {
        switch module {
        case .oggi, .portafoglio, .watchlist:
            if model.summary.isLoading {
                if module == model.modules.first(where: { [.oggi, .portafoglio, .watchlist].contains($0) }) {
                    VStack(alignment: .leading, spacing: BBSpacing.space2) {
                        BBSkeleton(width: 96, height: 16, radius: BBRadius.sm)
                        BBSkeleton(height: 64, radius: BBRadius.lg)
                    }
                    .padding(.top, BBSpacing.space3)
                }
            } else if let summary = model.summary.value {
                summaryModule(module, summary, eye: eye)
            }
        case .scadenze:
            if model.deadlines.isLoading {
                BBSkeleton(height: 56, radius: BBRadius.lg)
            } else if let data = model.deadlines.value, !data.items.isEmpty {
                deadlinesModule(data)
            }
        case .fire:
            if model.fire.isLoading {
                BBSkeleton(height: 64, radius: BBRadius.lg)
            } else if let fire = model.fire.value, SidebarInsights.fireState(fire) != .hidden {
                fireModule(fire)
            }
        }
    }

    // MARK: Summary modules

    @ViewBuilder private func summaryModule(_ module: SidebarModuleId, _ summary: SidebarSummary, eye: Bool) -> some View {
        let currency = summary.currency
        switch module {
        case .oggi:
            if let netWorth = summary.netWorth {
                let today = SidebarInsights.today(netWorth, pensionIncluded: model.includePension)
                InsightCollapsible(model: model, module: module, summary: amount(today.total, currency), eye: eye) {
                    VStack(alignment: .leading, spacing: 0) {
                        BBText(amount(today.total, currency), style: BBTextStyle.figure.with(weight: 600))
                        (Text(verbatim: L10n.lookup(italian: "Patrimonio netto")).foregroundColor(.bbMutedForeground)
                            + (today.change.map { change in
                                Text(verbatim: " · ").foregroundColor(.bbMutedForeground)
                                    + Text(verbatim: signed(change, currency)).fontWeight(.medium).foregroundColor(toneColor(change))
                                    + Text(verbatim: " " + L10n.lookup(italian: "in 30 giorni")).foregroundColor(.bbMutedForeground)
                            } ?? Text(verbatim: "")))
                            .font(BBTypography.micro.with(weight: 400).font)
                    }
                    .padding(.horizontal, BBSpacing.space1_5)
                    .padding(.bottom, BBSpacing.space1)
                }
            }
        case .portafoglio:
            if let portfolio = summary.portfolio {
                InsightCollapsible(model: model, module: module, summary: amount(portfolio.totalValue, currency), eye: eye,
                                   badge: AnyView(changeChip(portfolio.dayChangePct))) {
                    VStack(alignment: .leading, spacing: BBSpacing.space1) {
                        VStack(alignment: .leading, spacing: 0) {
                            BBText(amount(portfolio.totalValue, currency), style: BBTextStyle.figure.with(weight: 600))
                            (Text(verbatim: signed(portfolio.totalGain, currency)).fontWeight(.medium).foregroundColor(toneColor(portfolio.totalGain))
                                + Text(verbatim: portfolio.totalGainPct.map {
                                    L10n.lookup(italian: " · {0} in totale", ["0": BBFormat.formatSignedPct($0, locale: locale)])
                                } ?? "").foregroundColor(.bbMutedForeground))
                                .font(BBTypography.micro.with(weight: 400).font)
                        }
                        .padding(.horizontal, BBSpacing.space1_5)
                        ForEach(portfolio.holdings.prefix(SidebarInsights.maxHoldings), id: \.instrumentId) { h in
                            InsightRow(label: L10n.lookup(italian: h.label), name: h.name,
                                       value: h.value.map { amount($0, currency) } ?? "—", change: h.dayChangePct, spark: h.spark,
                                       alert: h.triggeredAlerts > 0) { shell.open(path: InAppLinks.securityPath(h.instrumentId)) }
                        }
                        if portfolio.holdings.count > SidebarInsights.maxHoldings {
                            showAll(portfolio.holdings.count)
                        }
                    }
                }
            }
        case .watchlist:
            let list = summary.watchlist
            if !list.isEmpty {
                let alerts = list.reduce(0) { $0 + $1.triggeredAlerts }
                InsightCollapsible(model: model, module: module,
                                   summary: "\(list.count) \(L10n.lookup(italian: SidebarInsights.watchlistSummary(list.count)))", eye: eye,
                                   badge: alerts > 0 ? AnyView(softBadge("\(alerts) \(L10n.lookup(italian: SidebarInsights.alertsWord(alerts)))")) : nil) {
                    VStack(alignment: .leading, spacing: BBSpacing.space1) {
                        ForEach(list.prefix(SidebarInsights.maxWatchlist), id: \.instrumentId) { w in
                            InsightRow(label: L10n.lookup(italian: w.label), name: w.name,
                                       value: w.lastClose.map { BBFormat.formatCurrency($0, currency: w.currency, locale: locale, masked: hide) } ?? "—",
                                       change: w.dayChangePct, spark: w.spark, alert: w.triggeredAlerts > 0) {
                                shell.open(path: InAppLinks.securityPath(w.instrumentId))
                            }
                        }
                        if list.count > SidebarInsights.maxWatchlist { showAll(list.count) }
                    }
                }
            }
        default:
            EmptyView()
        }
    }

    // MARK: Deadlines (SHELL-034, SHELL-035)

    private func deadlinesModule(_ data: SidebarDeadlines) -> some View {
        let overdue = SidebarInsights.overdueCount(data.items)
        let first = data.items.first.map { SidebarInsights.deadlineDay($0.date, locale: locale) }
        return InsightCollapsible(model: model, module: .scadenze, summary: first.map { "\($0.day) \($0.month)" } ?? "", eye: false,
                                  badge: SidebarInsights.overdueBadge(overdue).map { AnyView(softBadge("\(overdue) \(L10n.lookup(italian: $0))")) }) {
            VStack(alignment: .leading, spacing: 0) {
                ForEach(data.items, id: \.id) { item in
                    let day = SidebarInsights.deadlineDay(item.date, locale: locale)
                    Button { shell.open(path: InAppLinks.deadlinePath(item)) } label: {
                        HStack(spacing: BBSpacing.space2_5) {
                            VStack(spacing: 0) {
                                BBText(day.month.uppercased(), style: BBTextStyle(role: .sans, size: 9, lineHeight: 11, weight: 600, letterSpacingEm: 0.025,
                                                                                  tabularNums: false, uppercase: true, anchor: .caption2),
                                       color: (item.overdue ? Color.bbNeg : .bbForeground).opacity(0.7))
                                BBText(day.day, style: BBTextStyle(role: .sans, size: 14, lineHeight: 18, weight: 600, letterSpacingEm: 0, tabularNums: true,
                                                                   uppercase: false, anchor: .subheadline),
                                       color: item.overdue ? .bbNeg : .bbForeground)
                            }
                            .frame(width: 36)
                            .padding(.vertical, 2)
                            .background(RoundedRectangle.bb(BBRadius.md).fill(item.overdue ? Color.bbNegSoft : Color.bbMuted))
                            BBText(L10n.lookup(italian: item.label), style: BBTypography.body.with(size: 13, lineHeight: 18, weight: 600), lineLimit: 1)
                                .frame(maxWidth: .infinity, alignment: .leading)
                            if let value = item.amount {
                                BBText(amount(value, data.currency), style: BBTextStyle(role: .sans, size: 13, lineHeight: 18, weight: 600,
                                                                                        letterSpacingEm: 0, tabularNums: true, uppercase: false, anchor: .footnote))
                            }
                        }
                        .padding(.horizontal, BBSpacing.space1_5)
                        .frame(minHeight: BBLayout.minTouchTarget)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(BBPressableStyle(pressedBackground: .bbMuted, shape: AnyShape(RoundedRectangle.bb(BBRadius.lg)), translate: false))
                }
            }
        }
    }

    // MARK: FIRE (SHELL-036)

    private func fireModule(_ fire: SidebarFire) -> some View {
        let state = SidebarInsights.fireState(fire)
        let summary: String = switch state {
        case .invite, .hidden: ""
        case .reached(let p), .progress(let p, _, _): SidebarInsights.fireProgressText(p)
        }
        return InsightCollapsible(model: model, module: .fire, summary: summary, eye: false) {
            Button { shell.open(.analytics) } label: {
                VStack(alignment: .leading, spacing: BBSpacing.space1_5) {
                    switch state {
                    case .invite, .hidden:
                        BBText(L10n.lookup(italian: "Indica la spesa annua in pensione in Analitiche per stimare il tuo numero FIRE."),
                               style: BBTypography.micro.with(weight: 400), color: .bbMutedForeground)
                    case .reached(let progress), .progress(let progress, _, _):
                        GeometryReader { geo in
                            ZStack(alignment: .leading) {
                                Capsule().fill(Color.bbMuted)
                                Capsule().fill(Color.bbPrimary).frame(width: geo.size.width * SidebarInsights.fireFraction(progress))
                            }
                        }
                        .frame(height: 6)
                        .accessibilityElement()
                        .accessibilityLabel(L10n.lookup(italian: "Avanzamento verso il numero FIRE"))
                        .accessibilityValue(SidebarInsights.fireProgressText(progress))
                        (Text(verbatim: SidebarInsights.fireProgressText(progress)).font(BBTextStyle(role: .sans, size: 14, lineHeight: 20, weight: 600,
                                                                                                    letterSpacingEm: 0, tabularNums: true, uppercase: false,
                                                                                                    anchor: .subheadline).font)
                            + Text(verbatim: " " + L10n.lookup(italian: "del numero FIRE")).font(BBTypography.caption.font).foregroundColor(.bbMutedForeground))
                        BBText(fireLine(state, currency: fire.currency), style: BBTypography.micro.with(weight: 400), color: .bbMutedForeground)
                    }
                }
                .padding(.horizontal, BBSpacing.space1_5)
                .padding(.vertical, BBSpacing.space1)
                .frame(maxWidth: .infinity, alignment: .leading)
                .contentShape(Rectangle())
            }
            .buttonStyle(BBPressableStyle(pressedBackground: .bbMuted, shape: AnyShape(RoundedRectangle.bb(BBRadius.lg)), translate: false))
        }
    }

    private func fireLine(_ state: SidebarInsights.FireState, currency: String) -> String {
        switch state {
        case .reached: return L10n.lookup(italian: "Obiettivo raggiunto")
        case .progress(_, let remaining, let years):
            let suffix = years.map { " · " + L10n.lookup(italian: $0.source, $0.values) } ?? ""
            return L10n.lookup(italian: "Mancano {0}{1}", ["0": amount(remaining, currency), "1": suffix])
        case .invite, .hidden: return ""
        }
    }

    // MARK: Bits

    private func showAll(_ count: Int) -> some View {
        Button { shell.open(.investments) } label: {
            BBText(L10n.lookup(italian: "Mostra tutti (") + "\(count)) →", style: BBTypography.caption.with(weight: 600), color: .bbPrimary)
                .padding(.horizontal, BBSpacing.space1_5)
                .frame(minHeight: BBLayout.minTouchTarget)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    private func amount(_ value: Double, _ currency: String) -> String {
        BBFormat.formatCurrency(value, currency: currency, locale: locale, maximumFractionDigits: 0, masked: hide)
    }

    private func signed(_ value: Double, _ currency: String) -> String {
        hide ? SidebarInsights.mask : (value < 0 ? "−" : "+") + amount(abs(value), currency)
    }

    private func toneColor(_ value: Double?) -> Color {
        switch SidebarInsights.tone(value) {
        case .neg: .bbNeg
        case .pos: .bbPos
        default: .bbMutedForeground
        }
    }

    private func changeChip(_ value: Double?) -> some View {
        Group {
            if let value {
                BBText(BBFormat.formatSignedPct(value, locale: locale), style: BBTextStyle(role: .sans, size: 11, lineHeight: 14, weight: 600,
                                                                                          letterSpacingEm: 0, tabularNums: true, uppercase: false,
                                                                                          anchor: .caption2),
                       color: toneColor(value))
                    .padding(.horizontal, BBSpacing.space1_5)
                    .padding(.vertical, 2)
                    .background(Capsule().fill(value < 0 ? Color.bbNegSoft : .bbPosSoft))
            }
        }
    }

    private func softBadge(_ text: String) -> some View {
        BBText(text, style: BBTextStyle(role: .sans, size: 10, lineHeight: 12, weight: 600, letterSpacingEm: 0, tabularNums: false, uppercase: false,
                                        anchor: .caption2), color: .bbNeg)
            .padding(.horizontal, BBSpacing.space1_5)
            .padding(.vertical, 2)
            .background(Capsule().fill(Color.bbNegSoft))
    }
}

/// `CollapsibleSection`: top border, header (chevron rotating 90°, uppercase 11 title, badge, one-line summary when
/// closed) and an optional eye toggle; open state remembered per device (SHELL-029).
private struct InsightCollapsible<Content: View>: View {
    let model: InsightsModel
    let module: SidebarModuleId
    let summary: String
    let eye: Bool
    var badge: AnyView?
    @ViewBuilder let content: () -> Content
    @Environment(AppEnvironment.self) private var env

    init(model: InsightsModel, module: SidebarModuleId, summary: String, eye: Bool, badge: AnyView? = nil,
         @ViewBuilder content: @escaping () -> Content) {
        self.model = model
        self.module = module
        self.summary = summary
        self.eye = eye
        self.badge = badge
        self.content = content
    }

    var body: some View {
        let open = model.isSectionOpen(module)
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: BBSpacing.space1) {
                Button { model.toggleSection(module) } label: {
                    HStack(spacing: BBSpacing.space1_5) {
                        BBIconView(.chevronRight, points: 12, color: .bbMutedForeground)
                            .rotationEffect(.degrees(open ? 90 : 0))
                        BBText(L10n.lookup(italian: module.title), style: BBTextStyle(role: .sans, size: 11, lineHeight: 14, weight: 600, letterSpacingEm: 0.025,
                                                                                    tabularNums: false, uppercase: true, anchor: .caption2),
                               color: .bbMutedForeground, lineLimit: 1)
                        if let badge { badge }
                        Spacer(minLength: BBSpacing.space2)
                        if !open && !summary.isEmpty {
                            BBText(summary, style: BBTypography.caption.with(weight: 500), lineLimit: 1)
                        }
                    }
                    .padding(.horizontal, BBSpacing.space1_5)
                    .frame(minHeight: BBLayout.minTouchTarget)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityAddTraits(.isHeader)
                .accessibilityValue(open ? "" : summary)
                if eye {
                    let hidden = env.privacy.hideAmounts
                    Button { Task { await env.session.setHideAmounts(!hidden) } } label: {
                        BBIconView(hidden ? .eyeOff : .eye, points: 14, color: .bbMutedForeground)
                            .frame(width: BBLayout.minTouchTarget, height: BBLayout.minTouchTarget)
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(L10n.lookup(italian: hidden ? "Mostra gli importi" : "Nascondi gli importi"))
                }
            }
            if open {
                content().padding(.bottom, BBSpacing.space1)
            }
        }
        .padding(.top, BBSpacing.space1)
        .overlay(alignment: .top) { BBSeparator() }
    }
}

/// Compact security row (`InsightRow`): label (+ alert dot), name, 36-wide mini line, value and day change.
private struct InsightRow: View {
    let label: String
    let name: String
    let value: String
    let change: Double?
    let spark: [Double]
    let alert: Bool
    let action: () -> Void
    @Environment(\.bbLocale) private var locale

    var body: some View {
        Button(action: action) {
            HStack(spacing: BBSpacing.space2) {
                VStack(alignment: .leading, spacing: 0) {
                    HStack(spacing: BBSpacing.space1) {
                        BBText(label, style: BBTypography.body.with(size: 13, lineHeight: 16, weight: 600), lineLimit: 1)
                        if alert {
                            Circle().fill(Color.bbPrimary).frame(width: 6, height: 6)
                                .accessibilityLabel(L10n.lookup(italian: "Avviso di prezzo scattato"))
                        }
                    }
                    BBText(name, style: BBTypography.micro.with(lineHeight: 14, weight: 400), color: .bbMutedForeground, lineLimit: 1)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                TitleSparkline(values: spark)
                VStack(alignment: .trailing, spacing: 0) {
                    BBText(value, style: BBTextStyle(role: .sans, size: 13, lineHeight: 16, weight: 600, letterSpacingEm: 0, tabularNums: true,
                                                     uppercase: false, anchor: .footnote), lineLimit: 1)
                    BBText(change.map { BBFormat.formatSignedPct($0, locale: locale) } ?? "—",
                           style: BBTypography.micro.with(lineHeight: 14, weight: 400),
                           color: change.map { SidebarInsights.tone($0) == .neg ? Color.bbNeg : SidebarInsights.tone($0) == .pos ? .bbPos : .bbMutedForeground }
                               ?? .bbMutedForeground)
                }
                .frame(width: 76, alignment: .trailing)
            }
            .padding(.horizontal, BBSpacing.space1_5)
            .frame(minHeight: BBLayout.minTouchTarget)
            .contentShape(Rectangle())
        }
        .buttonStyle(BBPressableStyle(pressedBackground: .bbMuted, shape: AnyShape(RoundedRectangle.bb(BBRadius.lg)), translate: false))
    }
}

/// `TitleSparkline` (charts.md §3): polyline 1.5 round, `--pos` when up else `--neg`; < 2 values → empty space.
private struct TitleSparkline: View {
    let values: [Double]

    var body: some View {
        let up = (values.last ?? 0) >= (values.first ?? 0)
        Path(ChartPaths.line(SparklineGeometry.points(values, width: 36, height: 24), curve: .linear))
            .stroke(up ? Color.bbPos : .bbNeg, style: StrokeStyle(lineWidth: 1.5, lineCap: .round, lineJoin: .round))
            .frame(width: 36, height: 24)
            .opacity(values.count < 2 ? 0 : 1)
            .accessibilityHidden(true)
    }
}

// MARK: - Settings (SET-020, SET-021)

/// Per-device module switches, in Impostazioni › Aspetto e uso (the web's «Barra laterale» section adapted to «Il tuo quadro»).
struct InsightsModulesSettingsSection: View {
    @Environment(ShellModel.self) private var shell

    var body: some View {
        let model = shell.insights
        SettingsSection(title: L10n.lookup(italian: "Il tuo quadro"),
                        description: L10n.lookup(italian: "Scegli cosa vedere in «Il tuo quadro», nel menu Altro. Vale per questo dispositivo."),
                        icon: .layoutDashboard) {
            let modules = SidebarModuleId.settingsOrder(retirement: model.retirement)
            ForEach(Array(modules.enumerated()), id: \.element) { index, module in
                SettingsSwitchRow(label: L10n.lookup(italian: module.settingsLabel), hint: L10n.lookup(italian: module.settingsHint), first: index == 0,
                                  isOn: Binding(get: { model.isEnabled(module) }, set: { model.setEnabled(module, $0) }))
            }
        }
    }
}
