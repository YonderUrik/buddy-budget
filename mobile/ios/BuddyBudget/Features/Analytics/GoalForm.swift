import BuddyBudgetKit
import SwiftUI

// «Nuovo obiettivo» / «Modifica obiettivo» (GOAL-014…026): five steps in a full-screen form, `Indietro` and the primary
// button pinned at the bottom, enabled only when the step is valid (`GoalWizard.canAdvance`). Android: GoalForm.kt.

struct GoalFormPresenter: ViewModifier {
    let model: AnalyticsModel

    func body(content: Content) -> some View {
        content.formDialog(isPresented: Binding(get: { model.goalForm != nil }, set: { if !$0 { model.goalForm = nil } })) {
            if let request = model.goalForm, let view = model.goals.view {
                GoalFormView(model: model, view: view, request: request)
            }
        }
    }
}

private struct GoalFormView: View {
    let model: AnalyticsModel
    let view: GoalsView
    let request: GoalFormRequest

    @State private var draft: GoalDraft?
    @State private var index: Int?
    @State private var remind = true
    @Environment(\.bbLocale) private var locale
    @Environment(\.bbHideAmounts) private var hidden

    var body: some View {
        let goal = request.goalId.flatMap(view.goal)
        let steps = GoalFormStep.allCases
        let initialIndex: Int = {
            if goal != nil { return steps.firstIndex(of: request.startStep) ?? 0 }
            #if DEBUG
            if let debug = model.debugStartStep { return steps.firstIndex(of: debug) ?? 0 }
            #endif
            return 0
        }()
        let i = index ?? initialIndex
        let step = steps[i]
        let d = draft ?? debugDraft(GoalsRules.initialDraft(view, goal: goal, presetKind: request.presetKind))
        let text = GoalsText(locale: locale, currency: view.currency, masked: hidden, translate: { L10n.lookup(italian: $0) })
        let ok = GoalWizard.canAdvance(step, d, todayKey: view.todayKey)
        let last = i == steps.count - 1
        VStack(alignment: .leading, spacing: BBSpacing.space5) {
            FormDialogHeader(icon: .target, title: text.tr(goal == nil ? "Nuovo obiettivo" : "Modifica obiettivo"),
                             description: goal?.name ?? text.tr("Una cosa per cui mettere da parte: il risparmio del mese la raggiunge nell'ordine che scegli."),
                             color: .bbSwatchAmber)
            StepProgressBar(index: i, count: steps.count, label: text.tr("Passi del nuovo obiettivo"))
            VStack(alignment: .leading, spacing: BBSpacing.space4) {
                switch step {
                case .tipo: KindStep(draft: d, essential: view.essentialMonthly, set: { draft = $0 })
                case .quanto: AmountStep(draft: d, view: view, goal: goal, text: text, set: { draft = $0 })
                case .fonti: SourcesStep(draft: d, view: view, goal: goal, text: text, set: { draft = $0 })
                case .ritmo: PaceStep(draft: d, view: view, goal: goal, text: text, set: { draft = $0 })
                case .riepilogo: SummaryStep(draft: d, view: view, goal: goal, text: text, offer: model.offerReminders && goal == nil, remind: $remind)
                }
            }
            if let error = model.goalFormError { BBErrorBox(message: error, reportArea: .obiettivo) }
            HStack(spacing: BBSpacing.space2) {
                if i > 0 {
                    BBButton(text.tr("Indietro"), variant: .outline, size: .touch, isDisabled: model.goalSaving) { index = i - 1 }
                }
                BBButton(last ? (model.goalSaving ? text.tr("Salvataggio…") : text.tr(goal == nil ? "Crea obiettivo" : "Salva")) : text.tr("Avanti"),
                         size: .touch, fullWidth: true, isLoading: model.goalSaving, isDisabled: !ok) {
                    guard ok else { return }
                    if last {
                        Task { _ = await model.submitGoal(d, remind: remind) }
                    } else {
                        index = i + 1
                    }
                }
            }
        }
    }

    /// DEBUG: a filled draft for screenshots of later steps.
    private func debugDraft(_ draft: GoalDraft) -> GoalDraft {
        #if DEBUG
        if request.goalId == nil, model.debugStartStep != nil, model.debugStartStep != .tipo {
            var d = GoalWizard.withKind(draft, .viaggio, essentialMonthly: view.essentialMonthly)
            d.name = "Viaggio in Giappone"
            d.target = 4500
            d.targetMonth = Periods.addMonthsKey(view.todayKey, 10)
            d.monthly = 200
            if let first = view.sources.first(where: { $0.kind == "account" }) { d.sources = [GoalDraftSource(key: "account:\(first.id)", amount: 1000)] }
            return d
        }
        #endif
        return draft
    }
}

/// Pill choice (`GoalChoice`): rounded-full, h 44 on phone, primary tint when selected.
private struct GoalChoice: View {
    let label: String
    let selected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            BBText(label, style: BBTypography.bodyStrong, color: selected ? .bbPrimary : .bbForeground, lineLimit: 1)
                .padding(.horizontal, BBSpacing.space4)
                .frame(minHeight: 44)
                .background(Capsule().fill(selected ? Color.bbAlphaPrimary10 : Color.clear))
                .overlay(Capsule().strokeBorder(selected ? Color.bbPrimary : Color.bbBorder, lineWidth: 1))
                .contentShape(Capsule())
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(selected ? .isSelected : [])
    }
}

/// Currency field holding its own text (decimal keypad, locale separator); reports nil when empty.
private struct GoalAmountField: View {
    var label: String?
    let value: Double?
    let currency: String
    var width: CGFloat?
    let onChange: (Double?) -> Void
    @State private var text: String?
    @Environment(\.bbLocale) private var locale

    var body: some View {
        BBTextField(label: label, text: Binding(get: { text ?? value.map { AmountInputText.input($0, locale: locale) } ?? "" }, set: { new in
            text = new
            let parsed = Double(new.replacingOccurrences(of: ",", with: "."))
            onChange(new.isEmpty ? nil : parsed)
        }), keyboard: .amount, prefix: LocaleRules.currencySymbol(currency), height: 44)
        .frame(width: width)
    }
}

// MARK: Steps

private struct KindStep: View {
    let draft: GoalDraft
    let essential: Double?
    let set: (GoalDraft) -> Void

    var body: some View {
        StepTitle(title: L10n.lookup(italian: "Che cosa vuoi raggiungere?"))
        VStack(spacing: BBSpacing.space2) {
            ForEach(GoalKind.allCases, id: \.self) { kind in
                let selected = draft.kind == kind
                Button { set(GoalWizard.withKind(draft, kind, essentialMonthly: essential)) } label: {
                    HStack(spacing: BBSpacing.space3) {
                        GoalIcon(iconKey: kind.iconKey, colorToken: kind.colorToken, diameter: 32)
                        VStack(alignment: .leading, spacing: 0) {
                            BBText(L10n.lookup(italian: kind.label), style: BBTypography.bodyStrong)
                            BBText(L10n.lookup(italian: kind.hint), style: BBTypography.caption, color: .bbText3)
                        }
                        Spacer(minLength: 0)
                    }
                    .padding(BBSpacing.space3)
                    .frame(minHeight: 56)
                    .background(RoundedRectangle.bb(BBRadius.xl).fill(selected ? Color.bbPrimary.opacity(0.05) : Color.clear))
                    .overlay(RoundedRectangle.bb(BBRadius.xl).strokeBorder(selected ? Color.bbPrimary : Color.bbBorder, lineWidth: 1))
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityAddTraits(selected ? .isSelected : [])
            }
        }
        if draft.kind != nil {
            BBTextField(label: L10n.lookup(italian: "Nome"), text: Binding(get: { draft.name }, set: { var d = draft; d.name = String($0.prefix(80)); set(d) }),
                        placeholder: L10n.lookup(italian: "es. Viaggio in Giappone"), height: 44)
        }
    }
}

private struct AmountStep: View {
    let draft: GoalDraft
    let view: GoalsView
    let goal: GoalView?
    let text: GoalsText
    let set: (GoalDraft) -> Void
    @State private var monthPicker = false
    @Environment(\.bbLocale) private var locale

    var body: some View {
        let emergency = draft.kind == .emergenza
        StepTitle(title: text.tr(emergency ? "Quanti mesi di spese vuoi coprire?" : "Quanto ti serve, ed entro quando?"),
                  description: text.tr("La data è facoltativa: senza, ti diciamo solo quando ci arrivi al ritmo di oggi."))
        // GOAL-017 (web #382): months × monthly spending, the spending computed from the movements and editable.
        if emergency {
            let essential = view.essentialMonthly
            VStack(alignment: .leading, spacing: BBSpacing.space3) {
                HStack(spacing: BBSpacing.space2) {
                    ForEach(GoalConstants.emergencyMonthChoices, id: \.self) { months in
                        GoalChoice(label: text.tr("{0} mesi", ["0": String(months)]), selected: draft.emergencyMonths == months) {
                            set(GoalWizard.withEmergencyMonths(draft, months: months, essentialMonthly: essential))
                        }
                    }
                }
                VStack(alignment: .leading, spacing: BBSpacing.space1_5) {
                    GoalAmountField(label: text.tr("Spese al mese"), value: GoalWizard.emergencySpend(draft, essentialMonthly: essential),
                                    currency: view.currency) { v in
                        set(GoalWizard.withMonthlySpend(draft, value: v))
                    }
                    BBText(text.tr(GoalWizard.spendNote(draft, essentialBasis: view.essentialBasis)), style: BBTypography.caption, color: .bbText3)
                }
            }
        }
        GoalAmountField(label: text.tr("Quanto ti serve"), value: draft.target, currency: view.currency) { v in
            var d = draft
            d.target = v
            d.emergencyMonths = nil
            set(d)
        }
        .id("target-\(draft.emergencyMonths ?? 0)-\(draft.monthlySpend ?? -1)")
        VStack(alignment: .leading, spacing: BBSpacing.space2) {
            BBText(text.tr("Entro quando"), style: BBTypography.body, color: .bbText2)
            HStack(spacing: BBSpacing.space2) {
                GoalChoice(label: text.tr("Nessuna data"), selected: draft.targetMonth == nil) { var d = draft; d.targetMonth = nil; set(d) }
                GoalChoice(label: draft.targetMonth.map { text.month($0) } ?? text.tr("Mese entro cui arrivarci"), selected: draft.targetMonth != nil) {
                    monthPicker = true
                }
            }
        }
        if let note = text.requiredNote(draft, todayKey: view.todayKey, capacity: GoalsRules.formCapacity(view, goal: goal)) {
            GoalNote(note)
        }
        Color.clear.frame(height: 0)
            .bbSheet(isPresented: $monthPicker, title: text.tr("Mese entro cui arrivarci")) {
                MonthPicker(minKey: Periods.addMonthsKey(view.todayKey, 1), value: draft.targetMonth) { key in
                    var d = draft
                    d.targetMonth = key
                    set(d)
                    monthPicker = false
                }
            }
    }
}

/// Native month + year choice with a minimum (GOAL-016, mobile adaptation of `type="month"`).
private struct MonthPicker: View {
    let minKey: String
    let value: String?
    let onPick: (String) -> Void
    @State private var year: Int?
    @Environment(\.bbLocale) private var locale

    var body: some View {
        let minYear = Int(minKey.prefix(4)) ?? 2026
        let minMonth = Int(minKey.dropFirst(5).prefix(2)) ?? 1
        let shownYear = year ?? value.flatMap { Int($0.prefix(4)) } ?? minYear
        VStack(alignment: .leading, spacing: BBSpacing.space3) {
            HStack {
                BBIconButton(icon: .chevronLeft, accessibilityLabel: L10n.lookup(italian: "Anno precedente")) { year = max(minYear, shownYear - 1) }
                    .bbDisabled(shownYear <= minYear)
                Spacer()
                BBText(String(shownYear), style: BBTypography.cardTitle)
                Spacer()
                BBIconButton(icon: .chevronRight, accessibilityLabel: L10n.lookup(italian: "Anno successivo")) { year = shownYear + 1 }
            }
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: BBSpacing.space2), count: 3), spacing: BBSpacing.space2) {
                ForEach(1...12, id: \.self) { m in
                    let key = String(format: "%04d-%02d", shownYear, m)
                    let disabled = shownYear < minYear || (shownYear == minYear && m < minMonth)
                    let selected = value == key
                    Button { onPick(key) } label: {
                        BBText(BBFormat.capitalize(BBFormat.monthName(m, locale: locale)), style: BBTypography.bodyStrong,
                               color: selected ? .bbPrimaryForeground : .bbForeground, lineLimit: 1)
                            .frame(maxWidth: .infinity, minHeight: 44)
                            .background(RoundedRectangle.bb(BBRadius.md).fill(selected ? Color.bbPrimary : Color.bbMuted.opacity(0.5)))
                    }
                    .buttonStyle(.plain)
                    .bbDisabled(disabled)
                }
            }
        }
    }
}

private struct SourcesStep: View {
    let draft: GoalDraft
    let view: GoalsView
    let goal: GoalView?
    let text: GoalsText
    let set: (GoalDraft) -> Void

    var body: some View {
        let sources = GoalsRules.formSources(view, goal: goal)
        StepTitle(title: text.tr("Da dove arrivano i soldi?"), description: text.tr("Scegli cosa è già per questo obiettivo. Puoi anche partire da zero."))
        if sources.isEmpty {
            BBText(text.tr("Non hai ancora conti né investimenti: l'obiettivo parte da zero e cresce con la quota del mese."), style: BBTypography.body, color: .bbText2)
        }
        ForEach([(GoalSourceKind.account, "Liquidità", BBIcon.landmark, Color.bbSwatchTeal), (.instrument, "Investimenti", .trendingUp, .bbSwatchBlue)], id: \.1) { group in
            let items = sources.filter { $0.kind == group.0 }
            if !items.isEmpty {
                VStack(alignment: .leading, spacing: 0) {
                    BBText(text.tr(group.1), style: BBTypography.overline, color: .bbText3).padding(.bottom, BBSpacing.space1_5)
                    ForEach(Array(items.enumerated()), id: \.offset) { i, source in
                        let key = GoalWizard.sourceKey(source.kind, source.id)
                        let amount = draft.sources.first { $0.key == key }?.amount
                        HStack(spacing: BBSpacing.space3) {
                            Button { set(GoalsRules.toggleSource(draft, source)) } label: {
                                HStack(spacing: BBSpacing.space3) {
                                    let icon = view.sources.first { $0.id == source.id && $0.kind == source.kind.rawValue }
                                    GoalSourceIcon(kind: source.kind.rawValue, refId: source.id, name: source.name, accountColor: icon?.accountColor,
                                                   accountIcon: icon?.accountIcon, instrumentType: icon?.instrumentType, size: 32, fallback: true)
                                    VStack(alignment: .leading, spacing: 0) {
                                        BBText(source.name, style: BBTypography.bodyStrong, color: amount != nil ? .bbPrimary : .bbForeground, lineLimit: 1)
                                        BBText(text.tr("{0} · {1} liberi", ["0": text.money(source.total), "1": text.money(source.free)]),
                                               style: BBTypography.caption, color: .bbText3)
                                    }
                                    Spacer(minLength: 0)
                                }
                                .frame(minHeight: 44)
                                .contentShape(Rectangle())
                            }
                            .buttonStyle(.plain)
                            .accessibilityAddTraits(amount != nil ? .isSelected : [])
                            if let amount {
                                GoalAmountField(value: amount, currency: view.currency, width: 120) { v in
                                    var d = draft
                                    d.setSource(key, max(0, v ?? 0))
                                    set(d)
                                }
                                .accessibilityLabel(text.tr("Parte di {0} per questo obiettivo", ["0": source.name]))
                            } else {
                                BBText(text.tr("Scegli"), style: BBTypography.body, color: .bbText3)
                            }
                        }
                        .padding(.vertical, BBSpacing.space2_5)
                    }
                }
            }
        }
        GoalNote(text.tr("Assegnati {0} di {1}. Dove li tieni non cambia il saldo dei conti: è solo un'etichetta. Per i titoli contiamo il valore al netto dell'imposta stimata se li vendessi oggi.",
                         ["0": text.money(GoalWizard.assignedTotal(draft)), "1": text.money(draft.target ?? 0)]))
    }
}

private struct PaceStep: View {
    let draft: GoalDraft
    let view: GoalsView
    let goal: GoalView?
    let text: GoalsText
    let set: (GoalDraft) -> Void

    var body: some View {
        let required = GoalWizard.requiredMonthly(draft, todayKey: view.todayKey)
        let capacity = GoalsRules.formCapacity(view, goal: goal)
        let free = GoalsRules.freeCapacity(capacity)
        let others = GoalsRules.positionChoices(view, goal: goal)
        StepTitle(title: text.tr("Quanto ogni mese?"), description: text.tr("È la quota del tuo risparmio che va a questo obiettivo. La puoi cambiare quando vuoi."))
        FlowLayout(spacing: BBSpacing.space2) {
            if let required {
                GoalChoice(label: text.tr("Quanto serve: {0}", ["0": text.money(required)]), selected: draft.monthly == required) { var d = draft; d.monthly = required; set(d) }
            }
            if let free, free > 0, free != required {
                GoalChoice(label: text.tr("Quanto avanza: {0}", ["0": text.money(free)]), selected: draft.monthly == free) { var d = draft; d.monthly = free; set(d) }
            }
        }
        GoalAmountField(label: text.tr("Quota al mese"), value: draft.monthly, currency: view.currency) { v in
            var d = draft
            d.monthly = v.map { max(0, $0) }
            set(d)
        }
        .id("monthly-\(draft.monthly.map { String($0) } ?? "")-\(required ?? 0)")
        if !others.isEmpty {
            VStack(alignment: .leading, spacing: BBSpacing.space2) {
                BBText(text.tr("Chi riceve per primo il risparmio del mese?"), style: BBTypography.body, color: .bbText2)
                FlowLayout(spacing: BBSpacing.space2) {
                    GoalChoice(label: text.tr("Prima di tutti"), selected: draft.priority == 0) { var d = draft; d.priority = 0; set(d) }
                    ForEach(Array(others.enumerated()), id: \.element.id) { i, g in
                        GoalChoice(label: i == others.count - 1 ? text.tr("In fondo, dopo {0}", ["0": g.name]) : text.tr("Dopo {0}", ["0": g.name]),
                                   selected: draft.priority == i + 1) { var d = draft; d.priority = i + 1; set(d) }
                    }
                }
            }
        }
        if GoalWizard.isCovered(draft) {
            GoalNote(text.tr("Con i soldi che hai già assegnato l'obiettivo è coperto: la quota può restare a zero."))
        }
        if let free, let monthly = draft.monthly, monthly > free + 0.5 {
            GoalNote(text.tr("Oggi ne avanzano {0} al mese: chi sta più in basso nella lista riceverà meno.", ["0": text.money(free)]))
        }
    }
}

private struct SummaryStep: View {
    let draft: GoalDraft
    let view: GoalsView
    let goal: GoalView?
    let text: GoalsText
    let offer: Bool
    @Binding var remind: Bool

    var body: some View {
        let kind = draft.kind ?? .altro
        let names = GoalsRules.sourceNames(GoalsRules.formSources(view, goal: goal))
        StepTitle(title: text.tr("Tutto giusto?"))
        HStack(spacing: BBSpacing.space3) {
            GoalIcon(iconKey: kind.iconKey, colorToken: kind.colorToken)
            BBText(draft.name, style: BBTextStyle.sectionHeading)
        }
        VStack(spacing: 0) {
            let rows = text.summaryRows(draft)
            ForEach(Array(rows.enumerated()), id: \.offset) { i, row in
                HStack {
                    BBText(row.label, style: BBTypography.body, color: .bbText2)
                    Spacer(minLength: BBSpacing.space3)
                    BBText(row.value, style: BBTypography.bodyStrong).monospacedDigit()
                }
                .padding(.vertical, BBSpacing.space2_5)
            }
        }
        if let from = text.summarySources(draft, names: names) {
            BBText(from, style: BBTypography.body, color: .bbText2)
        }
        if offer {
            HStack(alignment: .top, spacing: BBSpacing.space3) {
                BBCheckbox(isOn: $remind, accessibilityLabel: text.tr("Ricordamelo per email")).padding(.top, 2)
                VStack(alignment: .leading, spacing: 0) {
                    BBText(text.tr("Ricordamelo per email"), style: BBTypography.bodyStrong)
                    BBText(text.tr("A inizio mese a che punto sei, e un avviso quando lo raggiungi o la data si avvicina. Si spegne da Impostazioni o dal link in ogni email."),
                           style: BBTypography.body, color: .bbText3)
                }
            }
            .padding(.top, BBSpacing.space3)
            .onTapGesture { remind.toggle() }
        }
    }
}
