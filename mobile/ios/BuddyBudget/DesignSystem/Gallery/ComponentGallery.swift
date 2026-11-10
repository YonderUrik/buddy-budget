#if DEBUG
import BuddyBudgetKit
import SwiftUI
import UIKit

// DEBUG-only component gallery: every design-system component in its states, page by page, for the parity
// screenshots. Launch with `-BBGallery <page>` (simctl: `xcrun simctl launch booted io.buddybudget.app.debug
// -BBGallery 3`). Same pages, order and fixtures as ComponentGallery.kt on Android. Page titles are component
// family names (developer-facing identifiers, never shipped); every user-facing string comes from L10n.

enum GalleryPage: Int, CaseIterable {
    case surfaces, controls, lists, dataViz, sheet, confirm, toasts, icons, refresh

    var title: String {
        switch self {
        case .surfaces: "Surfaces · Text"
        case .controls: "Controls"
        case .lists: "Lists · States"
        case .dataViz: "Data viz"
        case .sheet: "BBSheet"
        case .confirm: "BBAlertSheet"
        case .toasts: "Toasts"
        case .icons: "Icons"
        case .refresh: "4R · Sections · Period"
        }
    }

    static func fromLaunchArguments() -> GalleryPage? {
        let args = ProcessInfo.processInfo.arguments
        guard let i = args.firstIndex(of: "-BBGallery") else { return nil }
        let raw = i + 1 < args.count ? Int(args[i + 1]) ?? 0 : 0
        return GalleryPage(rawValue: raw) ?? .surfaces
    }
}

enum GalleryFixtures {
    static let currency = "EUR"
    static let netWorth: [Double] = [
        30000, 30486.88, 30955.31, 30937.97, 31319.77, 31638.78, 31436.99, 31610.78, 31711.16, 31293.69,
        31268.17, 31197.99, 30649.34, 30540.17, 30439.06, 29914.13, 29881.84, 29906.01, 29546.96, 29710.85,
        29949.29, 29809.28, 30183.35, 30610.07, 30624.7, 31110.18, 31598.14, 31620.05, 32058.38, 32447.7,
    ]
    static let sparkline: [Double] = [1200, 1180, 1310, 1290, 1405, 1370, 1460]

    static func chartPoints(locale: BBLocale) -> [BBChartPoint] {
        netWorth.enumerated().map { i, v in
            BBChartPoint(id: i, label: BBFormat.formatLongDate(CalendarDate(year: 2026, month: 9, day: 19).addingDays(i), locale: locale), value: v)
        }
    }
}

private extension CalendarDate {
    func addingDays(_ n: Int) -> CalendarDate {
        var c = DateComponents()
        c.year = year
        c.month = month
        c.day = day + n
        let cal = Calendar(identifier: .gregorian)
        let d = cal.date(from: c)!
        let parts = cal.dateComponents([.year, .month, .day], from: d)
        return CalendarDate(year: parts.year!, month: parts.month!, day: parts.day!)
    }
}

/// Image fixture for the "logo loaded" state: any path containing "demo" returns a PNG, everything else 404.
private struct GalleryLogoTransport: HTTPTransport {
    func data(for request: URLRequest) async throws -> (Data, URLResponse) {
        let ok = request.url?.absoluteString.contains("demo") == true
        let png = ok ? GalleryLogoTransport.png() : Data()
        return (png, HTTPURLResponse(url: request.url!, statusCode: ok ? 200 : 404, httpVersion: nil, headerFields: nil)!)
    }

    static func png() -> Data {
        let renderer = UIGraphicsImageRenderer(size: CGSize(width: 96, height: 96), format: {
            let f = UIGraphicsImageRendererFormat()
            f.scale = 1
            return f
        }())
        return renderer.pngData { ctx in
            UIColor(red: 0.89, green: 0.04, blue: 0.08, alpha: 1).setFill()
            UIBezierPath(roundedRect: CGRect(x: 8, y: 8, width: 80, height: 80), cornerRadius: 18).fill()
            UIColor.white.setFill()
            UIBezierPath(ovalIn: CGRect(x: 30, y: 30, width: 36, height: 36)).fill()
        }
    }
}

struct ComponentGallery: View {
    @State var page: GalleryPage
    @State private var privacy = PrivacyStore()
    @State private var toasts = ToastCenter()
    @Environment(\.bbLocale) private var locale

    private let logoLoader = LogoLoader(baseURL: URL(string: "http://gallery.test/")!, transport: GalleryLogoTransport()) { "gallery" }

    var body: some View {
        BBScreen(title: page.title, eyebrow: "BuddyBudget DS v1") {
            BBIconButton(icon: privacy.hideAmounts ? .eyeOff : .eye,
                         accessibilityLabel: privacy.hideAmounts ? L10n.showAmounts : L10n.hideAmounts) {
                privacy.hideAmounts.toggle()
            }
            BBIconButton(icon: .chevronLeft, accessibilityLabel: L10n.back) { step(-1) }
            BBIconButton(icon: .chevronRight, accessibilityLabel: L10n.showAll_d72ef3) { step(1) }
        } content: {
            Group {
                switch page {
                case .surfaces: SurfacesPage()
                case .controls: ControlsPage()
                case .lists: ListsPage(toasts: toasts)
                case .dataViz: DataVizPage()
                case .sheet: SheetPage()
                case .confirm: ConfirmPage()
                case .toasts: ToastsPage(toasts: toasts)
                case .icons: IconsPage()
                case .refresh: RefreshPage()
                }
            }
            .id(page)
        }
        .environment(\.bbHideAmounts, privacy.hideAmounts)
        .environment(\.bbLogoLoader, logoLoader)
        .bbToastHost(toasts)
    }

    private func step(_ delta: Int) {
        let all = GalleryPage.allCases
        page = all[(page.rawValue + delta + all.count) % all.count]
    }
}

private struct GalleryLabel: View {
    let text: String
    init(_ text: String) { self.text = text }
    var body: some View {
        BBText(text, style: BBTypography.overline, color: .bbText3).padding(.top, BBSpacing.space2)
    }
}

// MARK: - Pages

/// Phase 4R components: section views heading, sections without icons, soft rows, the period selector with the
/// calendar sheet, `SimulationResult` and the flags.
private struct RefreshPage: View {
    @State private var view = 0
    @State private var period = OverviewPeriod.threeMonths
    @State private var investments = InvestmentsPeriod.threeMonths
    @State private var range = DateKeyRange(from: "2026-09-01", to: "2026-10-12")

    var body: some View {
        VStack(alignment: .leading, spacing: BBSpacing.space6) {
            GalleryLabel("SectionViewsHeading · BBSunIconButton")
            SectionViewsHeading(sectionTitle: L10n.cash_84f6d5, items: LiquiditySegment.allCases.enumerated().map { i, v in
                SectionViewItem(id: v.rawValue, label: L10n.lookup(italian: v.title), description: L10n.lookup(italian: v.viewDescription),
                                icon: BBIcon.forKey(v.iconKey), isActive: i == view) { view = i }
            }) { BBSunIconButton(accessibilityLabel: L10n.add) {} }
            GalleryLabel("BBSection · BBSoftRow")
            BBSection(title: L10n.theMonth, actionLabel: L10n.analysis, onAction: {}) {
                VStack(spacing: BBSpacing.space1_5) {
                    BBSoftRow(title: L10n.income_5a21be) { AmountText(value: 1820, currency: "EUR", tone: .pos, signed: true) }
                    BBSoftRow(title: L10n.surplusSoFar, hint: L10n.incomeMinusSpendingMonthByMonthOve) {
                        AmountText(value: -343.83, currency: "EUR", tone: .signed, signed: true)
                    }
                }
            }
            GalleryLabel("PeriodSelector")
            PeriodSelector(options: OverviewPeriod.allCases.map { ($0, L10n.lookup(italian: $0.label)) }, selection: $period,
                           accessibilityLabel: L10n.lookup(italian: "Periodo del grafico"))
            PeriodSelector(options: InvestmentsPeriod.allCases.filter { $0 != .custom }.map { ($0, L10n.lookup(italian: $0.label)) },
                           selection: $investments, accessibilityLabel: L10n.lookup(italian: "Periodo del grafico"),
                           custom: PeriodCustom(value: .custom, range: range, max: "2026-10-20", onApply: { range = $0 }))
            GalleryLabel("SimulationResult")
            SimulationResult(label: L10n.lookup(italian: "Finisci prima di"), value: BBFormat.formatDuration(28, language: .it), tone: .pos,
                             caption: L10n.lookup(italian: "Periodo del grafico"))
            SimulationResult(label: L10n.amount_da6661, value: BBFormat.formatCurrency(-1240, currency: "EUR", locale: .itIT, maximumFractionDigits: 0), tone: .neg)
            GalleryLabel("BBFlag")
            HStack(spacing: BBSpacing.space3) {
                ForEach([BBFlag.Code.it, .gb, .de], id: \.rawValue) { code in
                    BBFlag(code: code, size: .sm)
                    BBFlag(code: code, size: .md)
                    BBFlag(code: code, size: .lg)
                }
            }
        }
    }
}

private struct SurfacesPage: View {
    @State private var period = 1
    @State private var type = 0
    @State private var chip = true

    var body: some View {
        VStack(alignment: .leading, spacing: BBSpacing.space4) {
            BBCard {
                BBCardHeader(title: L10n.netWorth, description: L10n.composition)
                MoneyHero(value: 30673.12, currency: GalleryFixtures.currency)
            }
            BBSection(title: L10n.accounts_80c9ff, icon: .wallet, color: .bbSwatchTeal, actionLabel: L10n.showAll_d72ef3, onAction: {}) {
                VStack(alignment: .leading, spacing: BBSpacing.space2) {
                    HStack {
                        BBText(L10n.income_5a21be, color: .bbText2)
                        Spacer()
                        AmountText(value: 2480, currency: GalleryFixtures.currency, tone: .signed, signed: true)
                    }
                    BBSeparator()
                    HStack {
                        BBText(L10n.expenses_6db1a3, color: .bbText2)
                        Spacer()
                        AmountText(value: -1234.5, currency: GalleryFixtures.currency, tone: .signed, signed: true)
                    }
                    BBSeparator()
                    HStack {
                        BBText(L10n.balance, color: .bbText2)
                        Spacer()
                        AmountText(value: 1245.5, currency: GalleryFixtures.currency)
                    }
                    BBSeparator()
                    HStack {
                        BBText(L10n.hideAmounts, color: .bbText2)
                        Spacer()
                        AmountText(value: -1234.5, currency: GalleryFixtures.currency, tone: .signed, signed: true)
                            .environment(\.bbHideAmounts, true)
                    }
                }
            }
            GalleryLabel("BBBadge · AutoOriginBadge")
            HStack(spacing: BBSpacing.space2) {
                BBBadge(L10n.total)
                BBBadge(L10n.total, variant: .secondary)
                BBBadge(L10n.delete_6b177b, variant: .destructive)
                ManualBadge()
                BBBadge(L10n.ai, variant: .ghost, icon: .sparkles)
            }
            HStack(spacing: BBSpacing.space4) {
                AutoOriginBadge(source: .regola)
                AutoOriginBadge(source: .storico)
                AutoOriginBadge(source: .assistente)
                AutoOriginBadge(source: .regola, compact: true)
            }
            GalleryLabel("BBChip · SegmentedControl")
            HStack(spacing: BBSpacing.space2) {
                BBChip(label: L10n.all_f89ce8, isSelected: chip) { chip.toggle() }
                BBChip(label: L10n.income_5a21be, icon: .trendingUp, isSelected: !chip) { chip.toggle() }
            }
            SegmentedControl(options: [(0, L10n.week_7195e9), (1, L10n.month_b333e2), (2, L10n.s3Months), (3, L10n.year_191852)],
                             selection: $period)
            SegmentedControl(options: [(0, L10n.all_f89ce8), (1, L10n.expenses_6db1a3), (2, L10n.income_5a21be)],
                             selection: $type, stretch: true)
        }
    }
}

private struct ControlsPage: View {
    @State private var name = ""
    @State private var filled = "Esselunga"
    @State private var amount = "12,50"
    @State private var on = true
    @State private var off = false
    @State private var slider = 0.4

    var body: some View {
        VStack(alignment: .leading, spacing: BBSpacing.space3) {
            GalleryLabel("BBButton")
            HStack(spacing: BBSpacing.space2) {
                BBButton(L10n.add, icon: .plus, variant: .sun, action: {})
                BBSunIconButton(accessibilityLabel: L10n.add) {}
            }
            HStack(spacing: BBSpacing.space2) {
                BBButton(L10n.save, action: {})
                BBButton(L10n.cancel, variant: .outline, action: {})
                BBButton(L10n.back, variant: .secondary, action: {})
            }
            HStack(spacing: BBSpacing.space2) {
                BBButton(L10n.close, variant: .ghost, action: {})
                BBButton(L10n.delete_6b177b, icon: .trash2, variant: .destructive, action: {})
                BBButton(L10n.showAll_d72ef3, variant: .link, action: {})
            }
            HStack(spacing: BBSpacing.space2) {
                BBButton(L10n.save, size: .xs, action: {})
                BBButton(L10n.save, size: .sm, action: {})
                BBButton(L10n.save, size: .lg, action: {})
                BBButton(L10n.save, icon: .plus, variant: .outline, size: .icon, action: {})
            }
            HStack(spacing: BBSpacing.space2) {
                BBButton(L10n.save, size: .touch, isLoading: true, action: {})
                BBButton(L10n.save, size: .touch, isDisabled: true, action: {})
            }
            BBButton(L10n.addAnAccount, icon: .plus, size: .touch, fullWidth: true, action: {})
            GalleryLabel("BBTextField")
            BBTextField(label: L10n.name_13030d, text: $name, placeholder: L10n.name_13030d)
            BBTextField(label: L10n.name_13030d, text: $filled, error: L10n.genericError)
            BBTextField(label: L10n.amount_da6661, text: $amount, keyboard: .amount, prefix: "€")
            BBTextField(label: L10n.name_13030d, text: $filled, isDisabled: true)
            GalleryLabel("BBSwitch · BBSlider")
            HStack(spacing: BBSpacing.space4) {
                BBSwitch(isOn: $on)
                BBSwitch(isOn: $off)
                BBSwitch(isOn: $on, size: .sm)
                BBSwitch(isOn: $off, size: .sm)
            }
            BBSlider(value: $slider, range: 0...1)
        }
    }
}

private struct GalleryRow: Identifiable {
    let id: Int
    let name: String
    let amount: Double
}

private struct ListsPage: View {
    let toasts: ToastCenter
    @State private var rows = [GalleryRow(id: 0, name: "Netflix", amount: -15.99), GalleryRow(id: 1, name: "Stipendio", amount: 2480)]

    var body: some View {
        VStack(alignment: .leading, spacing: BBSpacing.space3) {
            GalleryLabel("BBListRow · MerchantLogo")
            VStack(spacing: 0) {
                BBListRow(title: "Esselunga", subtitle: "\(L10n.expenses_6db1a3) · Fineco", onClick: {}) {
                    MerchantLogo(name: "Esselunga", logoPath: "/api/merchant-logos/esselunga.it?s=x")
                } trailing: {
                    AmountText(value: -82.4, currency: GalleryFixtures.currency, tone: .income, signed: true)
                }
                BBListRow(title: "Netflix", subtitle: L10n.subscriptions, onClick: {}) {
                    MerchantLogo(name: "Netflix", logoPath: "/api/merchant-logos/demo.netflix.com?s=x")
                } trailing: {
                    AmountText(value: -15.99, currency: GalleryFixtures.currency, tone: .income, signed: true)
                }
                BBListRow(title: L10n.cash_84f6d5, subtitle: L10n.balance, showsChevron: true, onClick: {}) {
                    BBAvatar(icon: BBIcon.account("piggy-bank"), color: .bbSwatch("teal"))
                } trailing: {
                    AmountText(value: 1245.5, currency: GalleryFixtures.currency)
                }
                BBListRow(title: L10n.settings, showsChevron: true, onClick: {}, leading: {
                    BBAvatar(icon: .settings, color: .bbSwatch("slate"))
                })
            }
            LogoCredit()
            GalleryLabel("BBSwipeToDelete · Undo")
            BBSwipeToDelete(onDelete: {}, previewFraction: 0.3) {
                BBListRow(title: "Amazon", subtitle: L10n.expenses_6db1a3) {
                    MerchantLogo(name: "Amazon")
                } trailing: {
                    AmountText(value: -39.9, currency: GalleryFixtures.currency, tone: .income, signed: true)
                }
            }
            ForEach(rows) { row in
                BBSwipeToDelete(onDelete: { delete(row) }) {
                    BBListRow(title: row.name, subtitle: L10n.transactions_2a6eec) {
                        MerchantLogo(name: row.name)
                    } trailing: {
                        AmountText(value: row.amount, currency: GalleryFixtures.currency, tone: .income, signed: true)
                    }
                }
            }
            GalleryLabel("EmptyState · LoadError")
            EmptyState(icon: .landmark, title: L10n.connectYourBank, description: L10n.offlineMessage,
                       primary: BBStateAction(label: L10n.addAnAccount, action: {}),
                       secondary: BBStateAction(label: L10n.close, action: {}))
            EmptyState(icon: .inbox, title: L10n.youReOffline, description: L10n.offlineMessage, color: .bbSwatchBlue, align: .center)
            LoadError(message: L10n.couldNotLoadAccounts, onRetry: {})
            GalleryLabel("BBSkeleton")
            BBSkeletonRows(rows: 2)
        }
    }

    private func delete(_ row: GalleryRow) {
        guard let index = rows.firstIndex(where: { $0.id == row.id }) else { return }
        withAnimation(.bb(BBMotion.springSnappy)) { _ = rows.remove(at: index) }
        toasts.showUndo(L10n.itemDeleted, onUndo: {
            withAnimation(.bb(BBMotion.springSnappy)) { rows.insert(row, at: min(index, rows.count)) }
        }, onCommit: {})
    }
}

private struct DataVizPage: View {
    @State private var selection: Int? = 12
    @State private var donutA: Int?
    @State private var donutB: Int? = 1
    @Environment(\.bbLocale) private var locale

    var body: some View {
        let slices = [
            BBDonutSlice(id: 0, label: L10n.cash_84f6d5, value: 12400, color: .bbSwatchTeal),
            BBDonutSlice(id: 1, label: L10n.netWorth, value: 18273, color: .bbPrimary),
            BBDonutSlice(id: 2, label: L10n.subscriptions, value: 4200, color: .bbSwatchSlate),
        ]
        VStack(alignment: .leading, spacing: BBSpacing.space3) {
            HStack(alignment: .top, spacing: BBSpacing.space3) {
                StatCard(label: L10n.income_5a21be, value: 2480, currency: GalleryFixtures.currency)
                StatCard(label: L10n.expenses_6db1a3, value: -1890, currency: GalleryFixtures.currency, subtitle: L10n.month_b333e2)
            }
            GalleryLabel("ProgressBar · Sparkline")
            ProgressBar(state: .determinate(value: 60, max: 100))
            ProgressBar(state: .indeterminate)
            HStack {
                BBText(L10n.cash_84f6d5, style: .rowTitle)
                Spacer()
                Sparkline(values: GalleryFixtures.sparkline)
            }
            GalleryLabel("BBLineChart")
            BBLineChart(points: GalleryFixtures.chartPoints(locale: locale), accessibilitySummary: L10n.netWorth,
                        formatValue: { BBFormat.formatCurrency($0, currency: GalleryFixtures.currency, locale: locale) },
                        selection: $selection)
                .padding(.horizontal, -BBSpacing.space4)
            GalleryLabel("BBDonut")
            HStack(spacing: BBSpacing.space4) {
                BBDonut(slices: slices, currency: GalleryFixtures.currency, size: 160, centerLabel: L10n.total, selection: $donutA)
                BBDonut(slices: slices, currency: GalleryFixtures.currency, size: 160, centerLabel: L10n.total, selection: $donutB)
            }
        }
    }
}

private struct SheetPage: View {
    @State private var open = true
    @State private var amount = ""

    var body: some View {
        VStack(alignment: .leading, spacing: BBSpacing.space3) {
            BBButton(L10n.addAnAccount, size: .touch, action: { open = true })
            BBSkeletonRows(rows: 3)
        }
        .bbSheet(isPresented: $open, title: L10n.addAnAccount) {
            BBTextField(label: L10n.amount_da6661, text: $amount, placeholder: "0,00", keyboard: .amount, prefix: "€")
            BBListRow(title: L10n.cash_84f6d5, subtitle: L10n.balance, showsChevron: true, onClick: {}, leading: {
                BBAvatar(icon: .wallet, color: .bbSwatchTeal)
            })
            BBButton(L10n.save, size: .touch, fullWidth: true, action: { open = false })
        }
    }
}

private struct ConfirmPage: View {
    @State private var open = true

    var body: some View {
        VStack(alignment: .leading, spacing: BBSpacing.space3) {
            BBButton(L10n.delete_6b177b, icon: .trash2, variant: .destructive, size: .touch, action: { open = true })
            BBSkeletonRows(rows: 3)
        }
        .bbAlertSheet(isPresented: $open, title: L10n.deleteThisTransaction_13a3c1, description: L10n.offlineMessage,
                      confirmLabel: L10n.delete_6b177b, icon: .trash2, onConfirm: {})
    }
}

private struct ToastsPage: View {
    let toasts: ToastCenter

    var body: some View {
        VStack(alignment: .leading, spacing: BBSpacing.space3) {
            BBToastView(toast: BBToast(kind: .success, message: L10n.save))
            BBToastView(toast: BBToast(kind: .error, message: L10n.genericError))
            BBToastView(toast: BBToast(kind: .loading, message: L10n.loading))
            BBToastView(toast: BBToast(kind: .plain, message: L10n.itemDeleted, actionLabel: L10n.undo))
            BBButton(L10n.save, size: .touch, action: { toasts.show(.success, L10n.save) })
        }
    }
}

private struct IconsPage: View {
    var body: some View {
        LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 0), count: 10), spacing: 0) {
            ForEach(BBIcon.allCases, id: \.self) { icon in
                BBIconView(icon, size: .lg, color: .bbForeground).frame(height: 34)
            }
        }
    }
}
#endif
