import BuddyBudgetKit
import SwiftUI

/// Loan detail (10-debts §3): loan chips (DEBT-019), facts with the progress ring (DEBT-018), pending banner
/// (DEBT-020), «E se…» (DEBT-030/031), «Cosa hai registrato» (DEBT-027) and «Piano delle rate» (DEBT-021/022).
/// `Estinzione anticipata` is the visible action; `Cambio tasso`, `Correggi residuo` and `Elimina` live in the «⋯»
/// sheet (mobile adaptation). Twin of `DebtDetailScreen` on Android.
struct DebtDetailScreen: View {
    let debtId: String
    @Environment(ShellModel.self) private var shell
    @Environment(\.shellBack) private var back
    @Environment(\.bbLocale) private var locale
    @State private var menu = false

    var body: some View {
        let model = shell.debts
        let text = DebtsText(locale: locale, translate: { L10n.lookup(italian: $0) })
        let debt = model.state.selected
        // Web phone layout: the loan chips come first, then the loan name as the page title (drawn by the content).
        BBScreen(title: nil, onBack: back, onRefresh: { await model.load() }) {
            if debt != nil {
                BBIconButton(icon: .ellipsis, accessibilityLabel: L10n.moreActions) { menu = true }
            }
        } content: {
            DebtsGateView(model: model) {
                if let debt, let data = model.state.data {
                    DebtDetailContent(model: model, data: data, debt: debt, text: text)
                }
            }
        }
        .task { await model.start() }
        .onChange(of: shell.dataVersion) { _, _ in Task { await model.load() } }
        .debtsDialogs(model)
        .formDialog(isPresented: Binding(get: { model.eventKind != nil }, set: { if !$0 { model.eventKind = nil } })) {
            if let kind = model.eventKind, let debt { DebtEventFormView(model: model, debtId: debt.id, kind: kind) }
        }
        .formDialog(isPresented: Binding(get: { model.earlyOpen }, set: { model.earlyOpen = $0 })) {
            if let debt { EarlyRepaymentView(model: model, debt: debt) }
        }
        .bbSheet(isPresented: $menu, title: L10n.moreActions) {
            VStack(alignment: .leading, spacing: 0) {
                SheetActionRow(icon: .percent, label: L10n.lookup(italian: "Cambio tasso")) { openAfterMenu { model.eventKind = .rateChange } }
                SheetActionRow(icon: .slidersHorizontal, label: L10n.lookup(italian: "Correggi residuo")) { openAfterMenu { model.eventKind = .balanceCorrection } }
                SheetActionRow(icon: .trash2, label: L10n.lookup(italian: "Elimina"), destructive: true) { openAfterMenu { model.confirmDelete = true } }
            }
        }
        .bbAlertSheet(isPresented: Binding(get: { model.confirmDelete }, set: { model.confirmDelete = $0 }),
                      title: L10n.lookup(italian: "Eliminare «{0}»?", ["0": debt?.name ?? ""]),
                      description: L10n.lookup(italian: "Spariscono il piano e tutto ciò che hai registrato su questo debito. Le transazioni collegate restano dove sono."),
                      confirmLabel: L10n.lookup(italian: "Elimina")) {
            guard let debt else { return }
            Task { await model.delete(debt) { back?() } }
        }
    }

    private func openAfterMenu(_ action: @escaping () -> Void) {
        menu = false
        DispatchQueue.main.asyncAfter(deadline: .now() + BBMotion.durationSheetExit + 0.05, execute: action)
    }
}

private struct DebtDetailContent: View {
    let model: DebtsModel
    let data: DebtsViewData
    let debt: DebtView
    let text: DebtsText

    var body: some View {
        VStack(alignment: .leading, spacing: BBSpacing.space8) {
            if debugShows(1) { VStack(alignment: .leading, spacing: BBSpacing.space3) {
                if data.debts.count > 1 { DebtChips(model: model, debts: data.debts, selected: debt.id) }
                VStack(alignment: .leading, spacing: BBSpacing.space1) {
                    BBText(debt.name, style: .screenTitle).accessibilityAddTraits(.isHeader)
                    BBText(text.startMode(debt.startMode), style: BBTypography.caption, color: .bbMutedForeground)
                }
                BBButton(L10n.lookup(italian: "Estinzione anticipata"), icon: .piggyBank, variant: .sun, size: .sm, isDisabled: debt.finished) {
                    model.earlyOpen = true
                }
            }
            .padding(.top, BBSpacing.space4) }
            if debugShows(2) { DebtFacts(debt: debt, share: DebtsRules.repaidShare(debt, insights: data.insights), currency: model.currency, text: text) }
            if debugShows(3), let pending = text.pending(debt) {
                DebtPendingBanner(text: pending, busy: model.bulkBusy) { Task { await model.markAllPaid(debt) } }
            }
            if debugShows(4), !debt.finished {
                DebtSimulationPanel(model: model, debt: debt, text: text)
            }
            if debugShows(5) { PanelSection(title: L10n.lookup(italian: "Cosa hai registrato"), icon: .history, color: .bbSwatchSlate) {
                DebtEventsList(model: model, debt: debt, text: text)
            } }
            PanelSection(title: L10n.lookup(italian: "Piano delle rate"), icon: .calendarRange, color: .bbSwatchTeal) {
                DebtPlanList(model: model, debt: debt, text: text)
            }
        }
    }
}

/// DEBT-019: one chip per loan, horizontally scrollable.
private struct DebtChips: View {
    let model: DebtsModel
    let debts: [DebtView]
    let selected: String

    var body: some View {
        ScrollView(.horizontal) {
            HStack(spacing: BBSpacing.space2) {
                ForEach(debts) { debt in
                    let active = debt.id == selected
                    Button { model.select(debt.id) } label: {
                        BBText(debt.name, style: active ? BBTypography.bodyStrong : BBTypography.body,
                               color: active ? .bbPrimary : .bbMutedForeground, lineLimit: 1)
                            .padding(.horizontal, BBSpacing.space3)
                            .frame(height: 30)
                            .background(Capsule().fill(active ? Color.bbAlphaPrimary10 : .clear))
                            .overlay(Capsule().strokeBorder(active ? Color.bbPrimary : Color.bbBorder, lineWidth: 1))
                            .bbHitArea(height: 30)
                    }
                    .buttonStyle(.plain)
                    .accessibilityAddTraits(active ? .isSelected : [])
                }
            }
            .padding(.horizontal, BBSpacing.space4)
        }
        .scrollIndicators(.hidden)
        .padding(.horizontal, -BBSpacing.space4)
    }
}

/// DEBT-018: ring + residual + 2×2 facts.
private struct DebtFacts: View {
    let debt: DebtView
    let share: Double
    let currency: String
    let text: DebtsText
    @Environment(\.bbHideAmounts) private var hidden

    var body: some View {
        let t = debt.totals
        VStack(alignment: .leading, spacing: BBSpacing.space4) {
            HStack(spacing: BBSpacing.space4) {
                DebtRing(fraction: share, label: "\(Int((share * 100).rounded()))%", caption: L10n.lookup(italian: "restituito"))
                VStack(alignment: .leading, spacing: BBSpacing.space1) {
                    AmountText(value: t.residual, currency: currency, style: BBTextStyle.hero.with(size: 36, lineHeight: 40), hero: true)
                        .minimumScaleFactor(0.6)
                    BBText(text.residualCaption(debt), style: BBTypography.body, color: .bbMutedForeground)
                }
            }
            Grid(alignment: .leading, horizontalSpacing: BBSpacing.space4, verticalSpacing: BBSpacing.space4) {
                GridRow {
                    fact(L10n.lookup(italian: "Rata"), t.finished ? "—" : text.money(t.currentInstallment, currency, masked: hidden))
                    fact(L10n.lookup(italian: "Rate rimaste"), String(t.remainingInstallments))
                }
                GridRow {
                    fact(L10n.lookup(italian: "Tasso (TAN) · TAEG"), text.rates(debt))
                    fact(L10n.lookup(italian: "Interessi che restano"), text.money(t.interestRemaining, currency, digits: 0, masked: hidden), color: .bbNeg)
                }
            }
        }
    }

    private func fact(_ label: String, _ value: String, color: Color = .bbForeground) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            BBText(label, style: BBTypography.caption, color: .bbMutedForeground)
            BBText(value, style: .rowAmount.with(weight: 500), color: color, lineLimit: 1).minimumScaleFactor(0.7)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

/// Progress ring with a label in the middle (112 pt, stroke 12).
struct DebtRing: View {
    let fraction: Double
    let label: String
    let caption: String
    var size: CGFloat = 112

    var body: some View {
        ZStack {
            Circle().stroke(Color.bbMuted, lineWidth: 12)
            Circle().trim(from: 0, to: min(1, max(0, fraction)))
                .stroke(Color.bbPrimary, style: StrokeStyle(lineWidth: 12, lineCap: .round))
                .rotationEffect(.degrees(-90))
            VStack(spacing: 0) {
                BBText(label, style: BBTextStyle.figure.with(size: size * 0.2, lineHeight: size * 0.24))
                BBText(caption, style: BBTypography.caption.with(size: size * 0.105, lineHeight: size * 0.14), color: .bbMutedForeground)
            }
        }
        .padding(6)
        .frame(width: size, height: size)
        .accessibilityElement()
        .accessibilityLabel("\(label) \(caption)")
    }
}

/// DEBT-020.
private struct DebtPendingBanner: View {
    let text: String
    let busy: Bool
    let onMarkAll: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: BBSpacing.space2) {
            HStack(spacing: BBSpacing.space2_5) {
                BBIconBadge(icon: .triangleAlert, color: .bbSwatchAmber, diameter: 32, iconSize: 16)
                BBText(text, style: BBTypography.body)
            }
            BBButton(L10n.lookup(italian: "Segna tutte come pagate"), variant: .outline, size: .sm, isLoading: busy, isDisabled: busy, action: onMarkAll)
        }
        .padding(.vertical, BBSpacing.space3)
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

/// «E se…» (DEBT-030/031; the one-off opens the early-repayment dialog).
private struct DebtSimulationPanel: View {
    let model: DebtsModel
    let debt: DebtView
    let text: DebtsText
    @State private var kind: DebtSimulationKind = .extra

    var body: some View {
        PanelSection(title: L10n.lookup(italian: "E se…"), icon: .lightbulb, color: .bbSwatchViolet) {
            VStack(alignment: .leading, spacing: BBSpacing.space4) {
                SegmentedControl(options: DebtSimulationKind.allCases.map { ($0, L10n.lookup(italian: $0.label)) }, selection: $kind,
                                 accessibilityLabel: L10n.lookup(italian: "Ipotesi da simulare"), stretch: true)
                switch kind {
                case .extra: DebtExtraSim(model: model, debt: debt, text: text)
                case .estinzione:
                    VStack(alignment: .leading, spacing: BBSpacing.space3) {
                        BBText(L10n.lookup(italian: "E se versassi una somma in più, una volta? Vedi quanto risparmi di interessi e se ti conviene ridurre la rata o la durata. Se l'hai già fatto, da qui puoi anche registrarla."),
                               style: BBTypography.body)
                        BBButton(L10n.lookup(italian: "Simula l'estinzione"), icon: .piggyBank, isDisabled: debt.finished) { model.earlyOpen = true }
                    }
                case .surroga: DebtRefinanceSim(model: model, debt: debt, text: text)
                }
            }
        }
    }
}

/// DEBT-030.
private struct DebtExtraSim: View {
    let model: DebtsModel
    let debt: DebtView
    let text: DebtsText
    @State private var extra = DebtsRules.extraDefault
    @Environment(\.bbHideAmounts) private var hidden

    var body: some View {
        let sim = DebtsRules.extraSimulation(debt, extra: extra, today: model.state.today)
        VStack(alignment: .leading, spacing: BBSpacing.space3) {
            ExtraSlider(value: $extra, currency: model.currency)
            if let sim, let answer = text.extraResult(sim, extra: extra, currency: model.currency, masked: hidden) {
                SimulationResult(label: answer.label, value: answer.value, caption: answer.caption)
            } else {
                BBText(L10n.lookup(italian: "Muovi lo slider per vedere quanto anticipi la fine e quanto risparmi."), style: BBTypography.body, color: .bbMutedForeground)
            }
            BBText(L10n.lookup(italian: "Stima semplificata: rata e tasso costanti, nessuna penale."), style: BBTypography.caption, color: .bbMutedForeground)
        }
    }
}

/// DEBT-031.
private struct DebtRefinanceSim: View {
    let model: DebtsModel
    let debt: DebtView
    let text: DebtsText
    @State private var rate = ""
    @State private var installments = ""
    @State private var costs = ""
    @State private var penalty = ""
    @Environment(\.bbHideAmounts) private var hidden

    var body: some View {
        let result = DebtsRules.refinance(debt, rate: rate, installments: installments, costs: costs, penalty: penalty, today: model.state.today)
        VStack(alignment: .leading, spacing: BBSpacing.space4) {
            BBText(L10n.lookup(italian: "Un'altra banca offre un tasso migliore? Inserisci l'offerta e vedi se, spese incluse, conviene."), style: BBTypography.body)
            Grid(alignment: .topLeading, horizontalSpacing: BBSpacing.space3, verticalSpacing: BBSpacing.space3) {
                GridRow {
                    DebtField(label: L10n.lookup(italian: "Nuovo TAN (%)"), text: $rate, placeholder: L10n.lookup(italian: "es. 3,5"), keyboard: .amount)
                    DebtField(label: L10n.lookup(italian: "Numero di rate"), text: $installments, placeholder: String(debt.totals.remainingInstallments), keyboard: .number)
                }
                GridRow {
                    DebtField(label: L10n.lookup(italian: "Spese della nuova offerta"), text: $costs, placeholder: "0", keyboard: .amount,
                              hint: L10n.lookup(italian: "Istruttoria, perizia, imposte"))
                    DebtField(label: L10n.lookup(italian: "Penale di estinzione"), text: $penalty, placeholder: "0", keyboard: .amount,
                              hint: L10n.lookup(italian: "Quella sul finanziamento attuale"))
                }
            }
            if let result {
                VStack(alignment: .leading, spacing: BBSpacing.space3) {
                    side(L10n.lookup(italian: "Resti dove sei"), [
                        (L10n.lookup(italian: "Rata"), text.money(result.currentInstallment, model.currency, masked: hidden)),
                        (L10n.lookup(italian: "Finisci"), BBFormat.formatMonthYear(result.currentEndDate, locale: text.locale)),
                        (L10n.lookup(italian: "Interessi che restano"), text.money(result.currentInterestRemaining, model.currency, masked: hidden)),
                    ])
                    side(L10n.lookup(italian: "Cambi con la nuova offerta"), [
                        (L10n.lookup(italian: "Rata"), text.money(result.newInstallment, model.currency, masked: hidden)),
                        (L10n.lookup(italian: "Finisci"), BBFormat.formatMonthYear(result.newEndDate, locale: text.locale)),
                        (L10n.lookup(italian: "Interessi"), text.money(result.newInterest, model.currency, masked: hidden)),
                        (L10n.lookup(italian: "Spese e penale"), text.money(result.switchCosts, model.currency, masked: hidden)),
                    ])
                    let answer = text.refinanceResult(result, currency: model.currency, masked: hidden)
                    SimulationResult(label: answer.label, value: answer.value, tone: answer.positive ? .pos : .neg, caption: answer.caption)
                        .padding(.top, BBSpacing.space1)
                }
            } else {
                BBText(L10n.lookup(italian: "Inserisci almeno il nuovo tasso e il numero di rate per vedere il confronto."),
                       style: BBTypography.caption, color: .bbMutedForeground)
            }
        }
    }

    private func side(_ title: String, _ rows: [(String, String)]) -> some View {
        VStack(alignment: .leading, spacing: BBSpacing.space2) {
            BBText(title, style: BBTypography.bodyStrong)
            ForEach(Array(rows.enumerated()), id: \.offset) { _, row in
                HStack(alignment: .firstTextBaseline) {
                    BBText(row.0, style: BBTypography.body, color: .bbMutedForeground)
                    Spacer(minLength: BBSpacing.space2)
                    BBText(row.1, style: BBTypography.body).monospacedDigit()
                }
            }
        }
    }
}

/// Field of the Debiti forms (web `DebtFormField`): caption label above, input, hint below.
struct DebtField: View {
    let label: String
    @Binding var text: String
    var placeholder = ""
    var keyboard: BBKeyboard = .amount
    var hint: String?

    var body: some View {
        VStack(alignment: .leading, spacing: BBSpacing.space1) {
            BBText(label, style: BBTypography.caption, color: .bbMutedForeground)
            BBTextField(text: $text, placeholder: placeholder, keyboard: keyboard)
            if let hint { BBText(hint, style: BBTypography.caption, color: .bbMutedForeground) }
        }
        .frame(maxWidth: .infinity, alignment: .topLeading)
    }
}

/// DEBT-027: newest first; swipe (or the bin) removes with Undo (decision 0003).
private struct DebtEventsList: View {
    let model: DebtsModel
    let debt: DebtView
    let text: DebtsText
    @Environment(\.bbHideAmounts) private var hidden

    var body: some View {
        let events = DebtsRules.orderedEvents(debt).filter { !model.pendingEventRemovals.contains($0.id) }
        if events.isEmpty {
            BBText(L10n.lookup(italian: "Ancora nessun evento: segna una rata pagata o registra un cambio."), style: BBTypography.body, color: .bbMutedForeground)
        } else {
            VStack(spacing: 0) {
                ForEach(Array(events.enumerated()), id: \.element.id) { index, event in
                    BBSwipeToDelete(onDelete: { model.removeEvent(debtId: debt.id, event) }) {
                        HStack(spacing: BBSpacing.space3) {
                            VStack(alignment: .leading, spacing: 0) {
                                BBText(text.event(event, currency: model.currency, masked: hidden), style: BBTypography.body, lineLimit: 1)
                                BBText(BBFormat.formatDateWithYear(event.date, locale: text.locale), style: BBTypography.caption, color: .bbMutedForeground)
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                            BBIconButton(icon: .trash2, accessibilityLabel: L10n.lookup(italian: "Elimina evento"), color: .bbMutedForeground) {
                                model.removeEvent(debtId: debt.id, event)
                            }
                        }
                        .padding(.vertical, BBSpacing.space1)
                    }
                }
            }
        }
    }
}

/// DEBT-021/022: one card per installment, last 2 past + next 8 by default.
private struct DebtPlanList: View {
    let model: DebtsModel
    let debt: DebtView
    let text: DebtsText
    @State private var showAll = false
    @Environment(\.bbHideAmounts) private var hidden

    var body: some View {
        let rows = debt.plan.rows
        let range = DebtsRules.visibleRange(rows, today: model.state.today)
        let visible = showAll ? rows : Array(rows[range])
        VStack(alignment: .leading, spacing: BBSpacing.space2) {
            VStack(spacing: 0) {
                ForEach(Array(visible.enumerated()), id: \.element.number) { index, row in
                    planRow(row)
                }
            }
            if rows.count > visible.count || showAll {
                BBButton(text.planToggle(showAll: showAll, total: rows.count, hidden: rows.count - visible.count), variant: .ghost, size: .sm) {
                    showAll.toggle()
                }
            }
        }
    }

    private func planRow(_ row: DebtPlanRow) -> some View {
        let paid = row.status == .pagata
        let tone: Color = paid ? .bbMutedForeground : .bbForeground
        return VStack(alignment: .leading, spacing: BBSpacing.space1_5) {
            HStack(alignment: .firstTextBaseline) {
                BBText("\(L10n.lookup(italian: "Rata")) \(row.number) · \(BBFormat.formatDateWithYear(row.dueDate, locale: text.locale))",
                       style: BBTypography.bodyStrong, color: tone)
                    .monospacedDigit()
                Spacer(minLength: BBSpacing.space3)
                BBText(text.money(row.payment?.amount ?? row.installment, model.currency, masked: hidden), style: .rowAmount.with(weight: 500), color: tone)
            }
            BBText(text.rowBreakdown(row, currency: model.currency, masked: hidden), style: BBTypography.caption, color: .bbMutedForeground)
            HStack(spacing: BBSpacing.space2) {
                if paid {
                    StatusPill(status: row.status, text: text)
                } else {
                    BBButton(L10n.lookup(italian: "Segna pagata"), variant: .outline, size: .sm) { model.paying = (debt.id, row) }
                }
                if row.status != .pagata && row.status != .daPagare { StatusPill(status: row.status, text: text) }
            }
        }
        .padding(.vertical, BBSpacing.space3)
    }
}

/// Installment status badge (`INSTALLMENT_STATUS_CLASS`).
struct StatusPill: View {
    let status: DebtInstallmentStatus
    let text: DebtsText

    var body: some View {
        let (bg, fg, ring): (Color, Color, Bool) = switch status {
        case .pagata: (.bbPosSoft, .bbPos, false)
        case .daPagare: (.bbMuted, .bbMutedForeground, false)
        case .scaduta: (.bbNegSoft, .bbNeg, false)
        case .daConfermare: (.bbMuted, .bbForeground, true)
        }
        BBText(text.status(status), style: BBTypography.caption, color: fg)
            .padding(.horizontal, BBSpacing.space2)
            .padding(.vertical, BBSpacing.space0_5)
            .background(Capsule().fill(bg))
            .overlay(Capsule().strokeBorder(ring ? Color.bbBorder : .clear, lineWidth: 1))
    }
}
