import BuddyBudgetKit
import SwiftUI

/// Investimenti › Operazioni (INV-056…061): year filter, totals, month groups (3 then all), rows with edit / delete.
/// Android: OperationsTab.kt.
struct OperationsTab: View {
    let model: InvestmentsModel
    @State private var year: Int?
    @State private var showAll = false
    @State private var deleting: String?
    @Environment(\.bbLocale) private var locale
    @Environment(\.bbHideAmounts) private var hide

    var body: some View {
        let query = model.state.baseQuery
        InvestmentsGateView(gate: model.gate(query, countsCash: false), model: model, onRetry: { Task { await model.loadView(query) } }) {
            if let view = model.views[query] {
                content(view)
            }
        }
    }

    @ViewBuilder private func content(_ view: InvestmentsView) -> some View {
        let text = InvestmentsText(locale: locale, masked: hide, translate: { L10n.lookup(italian: $0) })
        let options = InvestmentsRules.yearOptions(view.operationYears)
        let selected = year.flatMap { y in view.operationYears.contains(y) ? y : nil }
        let filtered = selected.map { y in view.operationMonths.filter { $0.year == y } } ?? view.operationMonths
        let months = InvestmentsRules.visibleMonths(view.operationMonths, year: selected, showAll: showAll)
        let totals = InvestmentsRules.totals(view.operationMonths, year: selected, all: view.operationTotals)
        let years = options.map { ($0 ?? 0, $0.map(String.init) ?? L10n.lookup(italian: "Tutti")) }
        let yearBinding = Binding(get: { selected ?? 0 }, set: { year = $0 == 0 ? nil : $0 })
        PanelSection(title: L10n.lookup(italian: "Operazioni"), icon: .arrowLeftRight) {
            if !years.isEmpty, years.count <= TitleSegments.maxInline {
                SegmentedControl(options: years, selection: yearBinding, accessibilityLabel: L10n.lookup(italian: "Anno delle operazioni"))
            }
        } content: {
            if years.count > TitleSegments.maxInline {
                ScrollableSegmentedControl(options: years, selection: yearBinding, accessibilityLabel: L10n.lookup(italian: "Anno delle operazioni"))
            }
            if view.operationMonths.isEmpty {
                BBText(L10n.lookup(italian: "Nessuna operazione registrata."), style: BBTypography.body, color: .bbMutedForeground)
            } else {
                totalsView(totals, currency: view.currency, text: text)
                VStack(spacing: 0) {
                    ForEach(months) { month in
                        monthGroup(month, view: view, text: text)
                    }
                }
                .padding(.horizontal, -BBSpacing.space4)
                if filtered.count > InvestmentsRules.recentMonths {
                    BBButton(showAll ? L10n.lookup(italian: "Mostra solo i mesi più recenti")
                                     : L10n.lookup(italian: "Mostra tutti i mesi ({0})", ["0": String(filtered.count)]),
                             variant: .outline, size: .sm) { showAll.toggle() }
                        .frame(maxWidth: .infinity)
                }
            }
        }
    }

    private func totalsView(_ totals: OperationTotals, currency: String, text: InvestmentsText) -> some View {
        let money = { (v: Double) in text.money(v, currency, digits: 0, masked: hide) }
        return VStack(alignment: .leading, spacing: BBSpacing.space2) {
            Grid(alignment: .leading, horizontalSpacing: BBSpacing.space4, verticalSpacing: BBSpacing.space3) {
                GridRow {
                    stat(L10n.lookup(italian: "Acquistato"), money(totals.bought))
                    stat(L10n.lookup(italian: "Venduto"), money(totals.sold))
                }
                GridRow {
                    stat(L10n.lookup(italian: "Dividendi e cedole"), money(totals.income))
                    VStack(alignment: .leading, spacing: 2) {
                        HStack(spacing: 2) {
                            BBText(L10n.lookup(italian: "Guadagno"), style: BBTypography.caption, color: .bbMutedForeground)
                            InfoHintButton(title: L10n.lookup(italian: "Come si calcola il guadagno"),
                                           text: L10n.lookup(italian: "Per un acquisto è quanto valgono oggi le quote ancora possedute rispetto a quanto le hai pagate; per una vendita è il guadagno realizzato."))
                        }
                        BBText(BBFormat.formatSignedCurrency(totals.gain, currency: currency, locale: locale, masked: hide),
                               style: BBTypography.cardTitle.with(size: 18, lineHeight: 26), color: .bbSigned(totals.gain), lineLimit: 1)
                            .monospacedDigit().minimumScaleFactor(0.7)
                        if let pct = totals.gainPct {
                            BBText("\(text.pct(pct)) \(L10n.lookup(italian: "sul costo"))", style: BBTypography.caption, color: .bbMutedForeground)
                        }
                    }
                }
            }
            if totals.unpricedCount > 0 {
                BBText(totals.unpricedCount == 1 ? L10n.lookup(italian: "1 acquisto senza prezzo di oggi è escluso dal guadagno.")
                       : L10n.lookup(italian: "{0} acquisti senza prezzo di oggi sono esclusi dal guadagno.", ["0": String(totals.unpricedCount)]),
                       style: BBTypography.caption, color: .bbMutedForeground)
            }
        }
    }

    private func stat(_ label: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            BBText(label, style: BBTypography.caption, color: .bbMutedForeground)
            BBText(value, style: BBTypography.cardTitle.with(size: 18, lineHeight: 26), lineLimit: 1).monospacedDigit().minimumScaleFactor(0.7)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func monthGroup(_ month: OperationMonth, view: InvestmentsView, text: InvestmentsText) -> some View {
        let totals = month.totals
        let parts = text.monthParts(totals, currency: view.currency, masked: hide)
        return VStack(spacing: 0) {
            VStack(alignment: .leading, spacing: 2) {
                HStack(alignment: .firstTextBaseline, spacing: BBSpacing.space2) {
                    BBText(BBFormat.capitalize(BBFormat.formatMonthLabel(month.key, locale: locale)), style: BBTypography.bodyStrong.with(weight: 600))
                    BBText(totals.count == 1 ? L10n.lookup(italian: "1 operazione") : L10n.lookup(italian: "{0} operazioni", ["0": String(totals.count)]),
                           style: BBTypography.caption, color: .bbMutedForeground)
                }
                (Text(verbatim: parts.isEmpty ? "" : parts + " · ").foregroundColor(.bbMutedForeground)
                    + Text(verbatim: text.gainText(totals.gain, pct: totals.gainPct, currency: view.currency, masked: hide)).foregroundColor(.bbSigned(totals.gain)))
                    .bbTextStyle(BBTypography.caption)
                    .monospacedDigit()
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, BBSpacing.space4)
            .padding(.vertical, BBSpacing.space2)
            .background(Color.bbMuted.opacity(0.5))
            ForEach(month.operations) { op in
                OperationRowView(op: op, instrument: view.instrument(op.transaction.instrumentId), currency: view.currency, text: text,
                                 deleting: deleting == op.id,
                                 onEdit: { model.openEdit(op) },
                                 onDelete: {
                                     deleting = op.id
                                     Task {
                                         await model.delete(op)
                                         deleting = nil
                                     }
                                 })
            }
        }
    }
}

private struct OperationRowView: View {
    let op: OperationResult
    let instrument: Instrument?
    let currency: String
    let text: InvestmentsText
    let deleting: Bool
    let onEdit: () -> Void
    let onDelete: () -> Void
    @Environment(\.bbHideAmounts) private var hide

    var body: some View {
        let t = op.transaction
        let editable = InvestmentsRules.canEdit(t)
        let amount = t.type == "acquisto" ? op.paid : op.received
        HStack(spacing: BBSpacing.space2) {
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: BBSpacing.space2) {
                    BBBadge(L10n.lookup(italian: operationTypeLabel(t.type)), variant: t.type == "vendita" || t.type == "rimborso" ? .outline : .secondary)
                    BBText(instrument?.name ?? L10n.lookup(italian: "Strumento"), style: BBTypography.bodyStrong, lineLimit: 1)
                }
                BBText(text.operationDetails(op, instrument: instrument), style: BBTypography.caption, color: .bbMutedForeground)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            VStack(alignment: .trailing, spacing: 2) {
                if t.type != "split" && t.type != "rettifica" {
                    BBText(text.money(amount, currency, masked: hide), style: BBTypography.bodyStrong).monospacedDigit()
                }
                if let gain = op.gain {
                    BBText(text.gainText(gain, pct: op.gainPct, currency: currency, masked: hide), style: BBTypography.caption, color: .bbSigned(gain))
                        .monospacedDigit()
                } else if t.type == "acquisto" {
                    BBText(L10n.lookup(italian: (op.remainingQuantity ?? 0) <= 1e-9 ? "Quote vendute" : "Senza prezzo di oggi"),
                           style: BBTypography.caption, color: .bbMutedForeground)
                }
            }
            if editable {
                BBIconButton(icon: .pencil, accessibilityLabel: L10n.lookup(italian: "Modifica operazione"), color: .bbMutedForeground, action: onEdit)
                    .frame(width: 36)
            }
            BBIconButton(icon: .trash2, accessibilityLabel: L10n.lookup(italian: "Elimina operazione"), color: .bbMutedForeground, action: onDelete)
                .frame(width: 36)
                .bbDisabled(deleting || !editable)
                .disabled(deleting || !editable)
        }
        .padding(.leading, BBSpacing.space4)
        .padding(.trailing, BBSpacing.space2)
        .padding(.vertical, BBSpacing.space3)
    }
}
