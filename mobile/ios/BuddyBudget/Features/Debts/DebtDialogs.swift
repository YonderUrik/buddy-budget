import BuddyBudgetKit
import SwiftUI

// Debiti dialogs (10-debts §2, §4–6): add flow, pay installment with the optional linked transaction, simple events
// and early repayment. Full-screen form dialogs; every open starts from empty fields. Android: DebtDialogs.kt.

// MARK: - Add debt (DEBT-009…017)

struct AddDebtFlow: View {
    let model: DebtsModel
    @State private var form: DebtAddFormState?
    /// 0 = start mode, 1 = name/date, 2 = figures, 3 = costs + preview.
    @State private var step = 0
    @State private var error: String?
    @State private var saving = false
    @State private var costsOpen = false
    @Environment(\.bbLocale) private var locale

    var body: some View {
        let text = DebtsText(locale: locale, translate: { L10n.lookup(italian: $0) })
        VStack(alignment: .leading, spacing: BBSpacing.space5) {
            FormDialogHeader(icon: .landmark, title: L10n.lookup(italian: "Aggiungi un debito"),
                             description: L10n.lookup(italian: form == nil ? "Il finanziamento parte adesso o è già in corso?"
                                                      : "Un passo alla volta: bastano tre dati su quattro, il quarto lo calcoliamo noi."))
            StepBars(index: step, count: DebtsRules.addSteps)
                .accessibilityLabel(L10n.lookup(italian: "Passi per aggiungere un debito"))
            if let form {
                details(form, text: text)
            } else {
                startStep
            }
        }
        #if DEBUG
        .onAppear {
            // DEBUG-only `-BBAddStep 1…3`: a prefilled example for screenshots.
            guard form == nil, let n = DebugLaunch.value("-BBAddStep").flatMap(Int.init) else { return }
            form = DebtAddFormState(name: "Prestito auto", startMode: .nuovo, principal: "15000", installments: "60", annualRate: "6,9",
                                    firstInstallmentDate: DebtsModel.todayKey)
            step = n
        }
        #endif
    }

    private var startStep: some View {
        VStack(spacing: 0) {
            ForEach(Array(DebtStartOption.all.enumerated()), id: \.offset) { index, option in
                Button {
                    form = DebtAddFormState(startMode: option.mode, firstInstallmentDate: DebtsModel.todayKey)
                    step = 1
                } label: {
                    HStack(alignment: .top, spacing: BBSpacing.space3) {
                        BBIconBadge(icon: option.mode == .nuovo ? .play : option.mode == .origine ? .fileText : .camera,
                                    color: .bbPrimary, diameter: 36, iconSize: 18)
                        VStack(alignment: .leading, spacing: BBSpacing.space1) {
                            BBText(L10n.lookup(italian: option.title), style: BBTypography.bodyLarge.with(weight: 500))
                            BBText(L10n.lookup(italian: option.description), style: BBTypography.body, color: .bbMutedForeground)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        BBIconView(.chevronRight, size: .md, color: .bbMutedForeground).padding(.top, 10)
                    }
                    .padding(.vertical, BBSpacing.space4)
                    .contentShape(Rectangle())
                }
                .buttonStyle(BBPressableStyle(pressedBackground: .bbAlphaPrimary5, shape: AnyShape(RoundedRectangle.bb(BBRadius.lg)), translate: false))
                if index < DebtStartOption.all.count - 1 { BBSeparator() }
            }
        }
    }

    @ViewBuilder private func details(_ state: DebtAddFormState, text: DebtsText) -> some View {
        let copy = DebtFieldCopy.of(state.startMode)
        let resolution = DebtCalc.resolveAddForm(state)
        let resolved: DebtResolvedAddForm? = if case .ok(let r) = resolution { r } else { nil }
        let binding = { (key: WritableKeyPath<DebtAddFormState, String>) in
            Binding(get: { form?[keyPath: key] ?? "" }, set: { form?[keyPath: key] = $0 })
        }
        switch step {
        case 1:
            StepHeading(title: L10n.lookup(italian: "Come si chiama il finanziamento?"),
                        description: L10n.lookup(italian: "Il nome serve a riconoscerlo nell'elenco; poi la data della {0}.",
                                                 ["0": L10n.lookup(italian: copy.firstDate).lowercased()]))
            DebtField(label: L10n.lookup(italian: "Nome"), text: Binding(get: { form?.name ?? "" },
                                                                          set: { form?.name = String($0.prefix(DebtsRules.nameMaxLength)) }),
                      placeholder: L10n.lookup(italian: "Es. Prestito auto"), keyboard: .text)
            VStack(alignment: .leading, spacing: BBSpacing.space1) {
                BBText(L10n.lookup(italian: copy.firstDate), style: BBTypography.caption, color: .bbMutedForeground)
                BBDateField(date: binding(\.firstInstallmentDate))
            }
        case 2:
            StepHeading(title: L10n.lookup(italian: "I dati che conosci"),
                        description: L10n.lookup(italian: "Compila quelli che hai. Se te ne manca uno, lascialo vuoto: lo calcoliamo dagli altri tre."))
            Grid(alignment: .topLeading, horizontalSpacing: BBSpacing.space3, verticalSpacing: BBSpacing.space3) {
                GridRow {
                    DebtField(label: L10n.lookup(italian: copy.principal), text: binding(\.principal),
                              placeholder: text.calculatedPlaceholder(.principal, resolved: resolved))
                    DebtField(label: L10n.lookup(italian: "Rata mensile"), text: binding(\.installment),
                              placeholder: text.calculatedPlaceholder(.installment, resolved: resolved))
                }
                GridRow {
                    DebtField(label: L10n.lookup(italian: copy.installments), text: binding(\.installments),
                              placeholder: text.calculatedPlaceholder(.installments, resolved: resolved), keyboard: .amount)
                    DebtField(label: L10n.lookup(italian: "Tasso annuo (TAN, %)"), text: binding(\.annualRate),
                              placeholder: text.calculatedPlaceholder(.annualRate, resolved: resolved))
                }
            }
            if let resolved, let calc = resolved.calculated {
                HStack(alignment: .top, spacing: BBSpacing.space2) {
                    BBIconView(.info, size: .md, color: .bbPrimary).padding(.top, 2)
                    RunsText(runs: text.calculated(calc, value: value(calc, resolved), currency: model.currency), style: BBTypography.body)
                }
            }
            if case .failure(let message?) = resolution {
                BBText(L10n.lookup(italian: message), style: BBTypography.body, color: .bbNeg)
            }
        default:
            StepHeading(title: L10n.lookup(italian: "Spese accessorie e conferma"),
                        description: L10n.lookup(italian: "Le spese sono facoltative; sotto vedi il piano che ne esce."))
            costsSection(state)
            if let resolved, let preview = try? DebtCalc.previewAddForm(state, resolved) {
                VStack(alignment: .leading, spacing: BBSpacing.space2) {
                    BBText(L10n.lookup(italian: "Anteprima del piano"), style: BBTypography.bodyStrong)
                    HStack(alignment: .top, spacing: BBSpacing.space3) {
                        previewCell(L10n.lookup(italian: "Rata"), text.money(preview.installment, model.currency))
                        previewCell(L10n.lookup(italian: "Finisce a"), BBFormat.formatMonthYear(preview.endDate, locale: locale))
                        previewCell(L10n.lookup(italian: resolved.apr != nil ? "Interessi · TAEG" : "Interessi totali"),
                                    text.money(preview.totalInterest, model.currency, digits: 0)
                                        + (resolved.apr.map { " · " + BBFormat.formatNumber($0, minimumFractionDigits: 2, maximumFractionDigits: 2, locale: locale) + "%" } ?? ""))
                    }
                }
            }
        }
        if let error { BBErrorBox(message: L10n.lookup(italian: error), reportArea: .debito) }
        HStack(spacing: BBSpacing.space2) {
            BBButton(L10n.lookup(italian: "Indietro"), variant: .outline, size: .touch) {
                error = nil
                if step == 1 { form = nil }
                step -= 1
            }
            Spacer(minLength: 0)
            BBButton(L10n.lookup(italian: step == 3 ? (saving ? "Salvo…" : "Aggiungi debito") : "Continua"), size: .touch,
                     isLoading: saving) { next(state, resolution) }
        }
    }

    private func value(_ key: DebtLoanInputKey, _ resolved: DebtResolvedAddForm) -> Double {
        switch key {
        case .principal: resolved.inputs.principal
        case .installment: resolved.inputs.installment
        case .installments: resolved.inputs.installments
        case .annualRate: resolved.inputs.annualRate
        }
    }

    private func previewCell(_ label: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            BBText(label, style: BBTypography.caption, color: .bbMutedForeground)
            BBText(value, style: .rowAmount.with(size: 14, lineHeight: 20, weight: 500))
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    @ViewBuilder private func costsSection(_ state: DebtAddFormState) -> some View {
        VStack(alignment: .leading, spacing: BBSpacing.space3) {
            Button { withAnimation(.easeOut(duration: BBMotion.durationFast)) { costsOpen.toggle() } } label: {
                HStack(spacing: BBSpacing.space2) {
                    BBIconBadge(icon: .receipt, color: .bbPrimary, diameter: 28, iconSize: 14)
                    (Text(L10n.lookup(italian: "Spese accessorie")).fontWeight(.semibold).foregroundColor(.bbForeground)
                        + Text(" " + L10n.lookup(italian: "(facoltativo)")).foregroundColor(.bbMutedForeground))
                        .bbTextStyle(BBTypography.body)
                    Spacer(minLength: 0)
                    BBIconView(.chevronDown, size: .md, color: .bbMutedForeground).rotationEffect(.degrees(costsOpen || !state.costs.isEmpty ? 180 : 0))
                }
                .frame(minHeight: BBLayout.minTouchTarget)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            if costsOpen || !state.costs.isEmpty {
                ForEach(state.costs.indices, id: \.self) { index in
                    VStack(spacing: BBSpacing.space2) {
                        HStack(spacing: BBSpacing.space2) {
                            BBTextField(text: costBinding(index, \.label), placeholder: L10n.lookup(italian: "Es. Assicurazione"), keyboard: .text)
                                .accessibilityLabel(L10n.lookup(italian: "Nome della spesa"))
                            BBIconButton(icon: .x, accessibilityLabel: L10n.lookup(italian: "Togli la spesa")) { form?.costs.remove(at: index) }
                        }
                        HStack(spacing: BBSpacing.space2) {
                            BBTextField(text: costBinding(index, \.amount), placeholder: BBFormat.getCurrencySymbol(model.currency, locale: locale),
                                        keyboard: .amount)
                                .accessibilityLabel(L10n.lookup(italian: "Importo della spesa"))
                            BBSelect(options: DebtCostKind.allCases.map { ($0, L10n.lookup(italian: $0 == .unaTantum ? "Una tantum" : "Ogni rata")) },
                                     selection: Binding(get: { form?.costs[safe: index]?.kind ?? .unaTantum }, set: { form?.costs[index].kind = $0 }),
                                     title: L10n.lookup(italian: "Quando si paga"))
                        }
                    }
                    .padding(.bottom, BBSpacing.space1)
                }
                if state.costs.count < DebtsRules.maxCosts {
                    BBButton(L10n.lookup(italian: "Aggiungi una spesa"), icon: .plus, variant: .ghost, size: .sm) {
                        form?.costs.append(DebtAddCostField(label: "", amount: "", kind: .unaTantum))
                    }
                }
            }
        }
    }

    private func costBinding(_ index: Int, _ key: WritableKeyPath<DebtAddCostField, String>) -> Binding<String> {
        Binding(get: { form?.costs[safe: index]?[keyPath: key] ?? "" }, set: { if form?.costs.indices.contains(index) == true { form?.costs[index][keyPath: key] = $0 } })
    }

    private func next(_ state: DebtAddFormState, _ resolution: DebtAddFormResolution) {
        let missing = "Servono almeno tre dati su quattro tra capitale, rata, numero di rate e tasso"
        switch step {
        case 1:
            if JSNumber.trim(state.name).isEmpty { error = "Dai un nome al debito, per riconoscerlo nell'elenco."; return }
            error = nil
            step = 2
        case 2:
            guard case .ok = resolution else {
                if case .failure(let message) = resolution { error = message ?? missing }
                return
            }
            error = nil
            step = 3
        default:
            if let basics = DebtCalc.validateAddFormBasics(state) { error = basics; return }
            guard case .ok(let resolved) = resolution else {
                if case .failure(let message) = resolution { error = message ?? missing }
                return
            }
            error = nil
            saving = true
            Task {
                error = await model.create(DebtCalc.buildCreateDebtInput(state, resolved, today: DebtsModel.todayKey))
                saving = false
            }
        }
    }
}

// MARK: - Pay installment (DEBT-023, DEBT-024)

struct PayInstallmentView: View {
    let model: DebtsModel
    let debtId: String
    let row: DebtPlanRow
    @State private var date: String
    @State private var amount: String
    @State private var transaction: Movement?
    @State private var linkOpen = false
    @State private var error: String?
    @State private var saving = false
    @Environment(\.bbLocale) private var locale

    init(model: DebtsModel, debtId: String, row: DebtPlanRow) {
        self.model = model
        self.debtId = debtId
        self.row = row
        _date = State(initialValue: DebtsRules.defaultPaymentDate(row, today: DebtsModel.todayKey))
        _amount = State(initialValue: AmountInputText.input(row.installment, locale: LocalizedStrings.shared.language.bbLocale))
    }

    var body: some View {
        VStack(alignment: .leading, spacing: BBSpacing.space5) {
            FormDialogHeader(icon: .circleCheck, title: L10n.lookup(italian: "Rata {0} pagata{1}", ["0": String(row.number), "1": ""]),
                             description: L10n.lookup(italian: "Data e importo reali, precompilati dal piano."))
            FormDialogSection(title: L10n.lookup(italian: "Il pagamento"), icon: .wallet) {
                HStack(alignment: .top, spacing: BBSpacing.space3) {
                    VStack(alignment: .leading, spacing: BBSpacing.space1) {
                        BBText(L10n.lookup(italian: "Data del pagamento"), style: BBTypography.caption, color: .bbMutedForeground)
                        BBDateField(date: $date)
                    }
                    .frame(maxWidth: .infinity)
                    DebtField(label: L10n.lookup(italian: "Importo pagato"), text: $amount, hint: L10n.lookup(italian: "Quello realmente addebitato"))
                }
            }
            VStack(alignment: .leading, spacing: BBSpacing.space2) {
                Button { withAnimation(.easeOut(duration: BBMotion.durationFast)) { linkOpen.toggle() } } label: {
                    HStack(spacing: BBSpacing.space2) {
                        BBIconView(.link, size: .md, color: .bbMutedForeground)
                        (Text(L10n.lookup(italian: "Collega una transazione")).fontWeight(.medium).foregroundColor(.bbForeground)
                            + Text(" " + L10n.lookup(italian: "(facoltativo)")).foregroundColor(.bbMutedForeground))
                            .bbTextStyle(BBTypography.body)
                        Spacer(minLength: 0)
                        BBIconView(.chevronDown, size: .md, color: .bbMutedForeground).rotationEffect(.degrees(linkOpen ? 180 : 0))
                    }
                    .frame(minHeight: 36)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                if linkOpen || transaction != nil {
                    BBText(L10n.lookup(italian: "Solo un promemoria: non cambia la transazione."), style: BBTypography.body, color: .bbMutedForeground)
                    TransactionPicker(model: model, dueDate: row.dueDate, expected: row.installment, selected: $transaction)
                }
            }
            .padding(BBSpacing.space3)
            .overlay(RoundedRectangle.bb(BBRadius.xl).strokeBorder(Color.bbBorder, lineWidth: 1))
            if let error { BBText(L10n.lookup(italian: error), style: BBTypography.body, color: .bbNeg) }
            HStack {
                Spacer(minLength: 0)
                BBButton(L10n.lookup(italian: saving ? "Salvo…" : "Segna pagata"), size: .touch, isLoading: saving) { submit() }
            }
        }
    }

    private func submit() {
        switch DebtsRules.paymentInput(row, date: date, amount: amount, transactionId: transaction?.id) {
        case .failure(let message): error = message.source
        case .success(let input):
            error = nil
            saving = true
            Task {
                error = await model.addEvent(debtId: debtId, input)
                saving = false
            }
        }
    }
}

/// DEBT-024: expenses ±20 days around the due date, same amount first, filterable by text and category; never links
/// on its own.
private struct TransactionPicker: View {
    let model: DebtsModel
    let dueDate: String
    let expected: Double
    @Binding var selected: Movement?
    @State private var all: [Movement]?
    @State private var search = ""
    @State private var categoryId: String?
    @Environment(\.bbLocale) private var locale
    @Environment(\.bbHideAmounts) private var hidden

    var body: some View {
        let visible = DebtCalc.rankInstallmentCandidates(all ?? [], filter: MovementFilter(categoryId: categoryId, searchText: search),
                                                         dueDate: dueDate, expectedAmount: expected)
        VStack(alignment: .leading, spacing: BBSpacing.space2) {
            BBTextField(text: $search, placeholder: L10n.lookup(italian: "Cerca…"), keyboard: .text)
                .accessibilityLabel(L10n.lookup(italian: "Cerca transazioni per descrizione o nota"))
            BBSelect(options: [(String?.none, L10n.lookup(italian: "Tutte le categorie"))] + model.categories.map { (Optional($0.id), $0.name) },
                     selection: $categoryId, title: L10n.lookup(italian: "Filtra per categoria"))
            if let selected {
                HStack(spacing: BBSpacing.space2) {
                    BBText("\(L10n.lookup(italian: "Collegata:")) \(selected.description) · \(BBFormat.formatCurrency(abs(selected.amount), currency: model.currency, locale: locale, masked: hidden))",
                           style: BBTypography.body, lineLimit: 1)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    BBIconButton(icon: .x, accessibilityLabel: L10n.lookup(italian: "Scollega la transazione")) { self.selected = nil }
                }
                .padding(.leading, BBSpacing.space2)
                .background(RoundedRectangle.bb(BBRadius.md).fill(Color.bbAlphaPrimary5))
                .overlay(RoundedRectangle.bb(BBRadius.md).strokeBorder(Color.bbAlphaPrimary45, lineWidth: 1))
            }
            ScrollView {
                VStack(spacing: 0) {
                    if all == nil {
                        status(L10n.lookup(italian: "Cerco le transazioni…"))
                    } else if visible.isEmpty {
                        status(L10n.lookup(italian: all?.isEmpty == true ? "Nessuna uscita vicina alla scadenza." : "Nessuna transazione corrisponde ai filtri."))
                    } else {
                        ForEach(visible) { t in
                            let isSelected = t.id == selected?.id
                            Button { selected = isSelected ? nil : t } label: {
                                HStack(spacing: BBSpacing.space2) {
                                    if let category = model.categories.first(where: { $0.id == t.categoryId }) {
                                        CategoryAvatar(category: category, diameter: 20)
                                    }
                                    VStack(alignment: .leading, spacing: 0) {
                                        BBText(t.description, style: BBTypography.body, lineLimit: 1)
                                        BBText(BBFormat.formatShortDate(t.date, locale: locale), style: BBTypography.caption, color: .bbText2)
                                    }
                                    .frame(maxWidth: .infinity, alignment: .leading)
                                    BBText(BBFormat.formatCurrency(abs(t.amount), currency: model.currency, locale: locale, masked: hidden),
                                           style: .rowAmount.with(size: 14, lineHeight: 20, weight: 500))
                                    if isSelected { BBIconView(.check, size: .md, color: .bbPrimary) }
                                }
                                .padding(.horizontal, BBSpacing.space2)
                                .padding(.vertical, BBSpacing.space1_5)
                                .background(isSelected ? Color.bbAlphaPrimary10 : .clear)
                                .contentShape(Rectangle())
                            }
                            .buttonStyle(.plain)
                            .accessibilityAddTraits(isSelected ? .isSelected : [])
                        }
                    }
                }
            }
            .frame(maxHeight: 224)
            .fixedSize(horizontal: false, vertical: true)
            .overlay(RoundedRectangle.bb(BBRadius.md).strokeBorder(Color.bbBorder, lineWidth: 1))
            .clipShape(RoundedRectangle.bb(BBRadius.md))
        }
        .task { all = await model.candidates(dueDate: dueDate) ?? [] }
    }

    private func status(_ text: String) -> some View {
        BBText(text, style: BBTypography.body, color: .bbText2)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, BBSpacing.space2)
            .padding(.vertical, BBSpacing.space3)
    }
}

// MARK: - Rate change / balance correction (DEBT-025, DEBT-026)

struct DebtEventFormView: View {
    let model: DebtsModel
    let debtId: String
    let kind: DebtEventDialogKind
    @State private var date = DebtsModel.todayKey
    @State private var value = ""
    @State private var error: String?
    @State private var saving = false

    var body: some View {
        VStack(alignment: .leading, spacing: BBSpacing.space5) {
            FormDialogHeader(icon: kind == .balanceCorrection ? .slidersHorizontal : .percent, title: L10n.lookup(italian: kind.title),
                             description: L10n.lookup(italian: kind.description))
            HStack(alignment: .top, spacing: BBSpacing.space3) {
                VStack(alignment: .leading, spacing: BBSpacing.space1) {
                    BBText(L10n.lookup(italian: "Dalla data"), style: BBTypography.caption, color: .bbMutedForeground)
                    BBDateField(date: $date)
                }
                .frame(maxWidth: .infinity)
                DebtField(label: L10n.lookup(italian: kind.label), text: $value, hint: L10n.lookup(italian: kind.hint))
            }
            if let error { BBText(L10n.lookup(italian: error), style: BBTypography.body, color: .bbNeg) }
            HStack {
                Spacer(minLength: 0)
                BBButton(L10n.lookup(italian: saving ? "Salvo…" : kind.submit), size: .touch, isLoading: saving) {
                    switch kind.input(date: date, value: value) {
                    case .failure(let message): error = message.source
                    case .success(let input):
                        error = nil
                        saving = true
                        Task {
                            error = await model.addEvent(debtId: debtId, input)
                            saving = false
                        }
                    }
                }
            }
        }
    }
}

// MARK: - Early repayment (DEBT-032…035)

struct EarlyRepaymentView: View {
    let model: DebtsModel
    let debt: DebtView
    @State private var mode: DebtEarlyRepaymentMode = .once
    @State private var date = DebtsModel.todayKey
    @State private var amount = ""
    @State private var penalty = ""
    @State private var unit: DebtPenaltyUnit = .eur
    @State private var effect: DebtEarlyRepaymentEffect?
    @State private var error: String?
    @State private var saving = false
    @Environment(\.bbLocale) private var locale
    @Environment(\.bbHideAmounts) private var hidden

    var body: some View {
        let text = DebtsText(locale: locale, translate: { L10n.lookup(italian: $0) })
        #if DEBUG
        let _ = debugPrefill()
        #endif
        let preview = DebtsRules.earlyRepayment(debt, today: model.state.today,
                                                values: DebtEarlyRepaymentFormValues(mode: mode, date: date, amount: amount, penalty: penalty, penaltyUnit: unit))
        VStack(alignment: .leading, spacing: BBSpacing.space5) {
            FormDialogHeader(icon: .piggyBank, title: L10n.lookup(italian: "Estinzione anticipata"),
                             description: L10n.lookup(italian: "Vedi cosa cambia prima di decidere. Se l'hai già fatto, scegli l'alternativa che la banca ti ha applicato e registrala."))
            FormDialogSection(title: L10n.lookup(italian: "Quanto e quando"), icon: .banknote) {
                SegmentedControl(options: [(DebtEarlyRepaymentMode.once, L10n.lookup(italian: "Una volta")),
                                           (.monthly, L10n.lookup(italian: "Ogni mese (simula)"))],
                                 selection: Binding(get: { mode }, set: { next in
                                     mode = next
                                     amount = ""
                                     effect = nil
                                 }), accessibilityLabel: L10n.lookup(italian: "Quante volte"), stretch: true)
                HStack(alignment: .top, spacing: BBSpacing.space3) {
                    DebtField(label: L10n.lookup(italian: mode == .once ? "Importo che estingui" : "Extra ogni mese"), text: $amount)
                    if mode == .once {
                        VStack(alignment: .leading, spacing: BBSpacing.space1) {
                            BBText(L10n.lookup(italian: "Data"), style: BBTypography.caption, color: .bbMutedForeground)
                            BBDateField(date: $date)
                        }
                        .frame(maxWidth: .infinity)
                    }
                }
                if mode == .once {
                    VStack(alignment: .leading, spacing: BBSpacing.space1) {
                        BBText(L10n.lookup(italian: "Penale di estinzione (facoltativa)"), style: BBTypography.caption, color: .bbMutedForeground)
                        HStack(spacing: BBSpacing.space2) {
                            BBTextField(text: $penalty, keyboard: .amount)
                            BBSelect(options: [(DebtPenaltyUnit.eur, "€"), (.percent, L10n.lookup(italian: "% della somma"))], selection: $unit,
                                     title: L10n.lookup(italian: "Unità della penale"))
                                .frame(width: 150)
                        }
                        BBText(L10n.lookup(italian: "La trovi nel contratto: spesso fino all'1% della somma"), style: BBTypography.caption, color: .bbMutedForeground)
                    }
                }
            }
            if preview != .empty || error != nil {
                FormDialogSection(title: L10n.lookup(italian: "Cosa cambia"), icon: .gitCompareArrows) {
                    switch preview {
                    case .error(let message):
                        BBText(L10n.lookup(italian: message), style: BBTypography.body, color: .bbNeg)
                    case .once(_, _, _, let comparison):
                        VStack(alignment: .leading, spacing: BBSpacing.space2) {
                            BBText(text.baseline(comparison, currency: model.currency, masked: hidden), style: BBTypography.caption, color: .bbMutedForeground)
                            outcomeCard(comparison.reduceInstallment, text: text)
                            outcomeCard(comparison.reduceDuration, text: text)
                        }
                    case .monthly(let value, let result):
                        VStack(alignment: .leading, spacing: BBSpacing.space1) {
                            BBText("\(L10n.lookup(italian: "Con")) \(text.money(value, model.currency, masked: hidden)) \(L10n.lookup(italian: "in più ogni mese"))",
                                   style: BBTypography.bodyStrong).padding(.bottom, BBSpacing.space1)
                            outcomeRow(L10n.lookup(italian: "Finisci"), text.finish(result.endDate, monthsSaved: result.monthsSaved))
                            outcomeRow(L10n.lookup(italian: "Interessi risparmiati"), text.money(result.interestSaved, model.currency, masked: hidden), strong: true, color: .bbPos)
                            outcomeRow(L10n.lookup(italian: "Versato in extra in totale"), text.money(result.extraPaid, model.currency, masked: hidden))
                            BBText(L10n.lookup(italian: "È solo una simulazione: non si registra. Per registrarle, inserisci le singole estinzioni quando le fai."),
                                   style: BBTypography.caption, color: .bbMutedForeground).padding(.top, BBSpacing.space1)
                        }
                    case .empty:
                        EmptyView()
                    }
                    if let error { BBText(L10n.lookup(italian: error), style: BBTypography.body, color: .bbNeg) }
                }
            }
            if mode == .once {
                HStack {
                    Spacer(minLength: 0)
                    BBButton(L10n.lookup(italian: saving ? "Salvo…" : effect != nil ? "Registra come fatto" : "Scegli un'alternativa per registrarla"),
                             icon: effect != nil && !saving ? .check : nil, size: .touch, isLoading: saving,
                             isDisabled: effect == nil || !isOnce(preview)) { register(preview) }
                }
            }
        }
    }

    #if DEBUG
    /// DEBUG-only `-BBDialog early-filled`: 5000 € and the reduce-duration choice, for screenshots.
    private func debugPrefill() {
        guard amount.isEmpty, effect == nil, DebugLaunch.value("-BBDialog") == "early-filled" else { return }
        DispatchQueue.main.async {
            amount = "5000"
            effect = .reduceDuration
        }
    }
    #endif

    private func isOnce(_ preview: DebtEarlyRepaymentPreview) -> Bool {
        if case .once = preview { return true }
        return false
    }

    private func outcomeCard(_ outcome: DebtEarlyRepaymentOutcome, text: DebtsText) -> some View {
        let selected = effect == outcome.effect
        let reduceRate = outcome.effect == .reduceInstallment
        return Button { effect = outcome.effect } label: {
            VStack(alignment: .leading, spacing: BBSpacing.space1) {
                HStack(spacing: BBSpacing.space1_5) {
                    BBIconView(reduceRate ? .trendingDown : .calendarCheck, size: .md, color: .bbPrimary)
                    BBText(L10n.lookup(italian: reduceRate ? "Riduci la rata" : "Riduci la durata"), style: BBTypography.bodyStrong)
                }
                BBText(L10n.lookup(italian: reduceRate ? "Stessa scadenza, rata più bassa" : "Stessa rata, finisci prima"),
                       style: BBTypography.caption, color: .bbMutedForeground)
                    .padding(.bottom, BBSpacing.space1)
                outcomeRow(L10n.lookup(italian: "Prossima rata"), outcome.closesDebt ? "—" : text.money(outcome.nextInstallment, model.currency, masked: hidden))
                outcomeRow(L10n.lookup(italian: "Finisci"), text.finish(outcome.endDate, monthsSaved: outcome.monthsSaved))
                outcomeRow(L10n.lookup(italian: "Interessi risparmiati"), text.money(outcome.interestSaved, model.currency, masked: hidden), strong: true, color: .bbPos)
                outcomeRow(L10n.lookup(italian: "Al netto della penale"), text.money(outcome.netBenefit, model.currency, masked: hidden), strong: true,
                           color: outcome.netBenefit > 0 ? .bbPos : .bbForeground)
            }
            .padding(BBSpacing.space3)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(RoundedRectangle.bb(BBRadius.lg).fill(selected ? Color.bbAlphaPrimary5 : .clear))
            .overlay(RoundedRectangle.bb(BBRadius.lg).strokeBorder(selected ? Color.bbPrimary : Color.bbBorder, lineWidth: 1))
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(selected ? .isSelected : [])
    }

    private func outcomeRow(_ label: String, _ value: String, strong: Bool = false, color: Color = .bbForeground) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: BBSpacing.space2) {
            BBText(label, style: BBTypography.body, color: .bbMutedForeground)
            Spacer(minLength: BBSpacing.space2)
            BBText(value, style: strong ? BBTypography.bodyStrong : BBTypography.body, color: color).monospacedDigit()
        }
    }

    private func register(_ preview: DebtEarlyRepaymentPreview) {
        guard case .once(let value, let penalty, let day, _) = preview, let effect else { return }
        error = nil
        saving = true
        Task {
            error = await model.addEvent(debtId: debt.id, .earlyRepayment(date: day.iso, amount: value, penalty: penalty, effect: effect))
            saving = false
        }
    }
}
