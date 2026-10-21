import BuddyBudgetKit
import SwiftUI

/// «Registra operazione» stepped flow and «Modifica operazione» single screen (INV-062…073). Validation and the
/// request body come from `OperationForm` (BuddyBudgetKit). Android: RegisterOperationView.kt.
struct RegisterOperationView: View {
    let model: InvestmentsModel
    @State private var form: OperationForm
    @State private var step = 0
    @State private var priceEdited = false
    @State private var suggestion: PriceOnDate?
    @State private var fetching = false
    @State private var error: String?
    @State private var saving = false
    @State private var priceTask: Task<Void, Never>?
    @Environment(\.bbLocale) private var locale

    init(model: InvestmentsModel, initial: OperationForm) {
        self.model = model
        _form = State(initialValue: initial)
        _priceEdited = State(initialValue: model.editing != nil || !initial.price.isEmpty)
    }

    private var editing: Bool { model.editing != nil }
    private var userCurrency: String { model.currency }
    private var suggestions: [Instrument] {
        guard let view = model.anyView else { return [] }
        return view.heldInstrumentIds.compactMap { view.instrument($0) }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: BBSpacing.space5) {
            if editing {
                FormDialogHeader(icon: .pencil, title: L10n.lookup(italian: "Modifica operazione"),
                                 description: L10n.lookup(italian: "Lo strumento non si cambia: per un altro strumento elimina e registra di nuovo."))
                FormDialogSection(title: L10n.lookup(italian: "Operazione")) {
                    typeSelect
                    dateField
                    VStack(alignment: .leading, spacing: BBSpacing.space2) {
                        BBText(L10n.lookup(italian: "Strumento"), style: BBTypography.bodyStrong.with(lineHeight: 14))
                        BBText(form.instrument?.name ?? "", style: BBTypography.body, color: .bbMutedForeground)
                    }
                }
                FormDialogSection(title: L10n.lookup(italian: "Importi")) {
                    amounts
                    if form.type.hasCosts { costs }
                }
                countervalue
                errorBox
                BBButton(L10n.lookup(italian: saving ? "Salvataggio…" : "Salva modifiche"), size: .touch, fullWidth: true, isLoading: saving) { save() }
            } else {
                FormDialogHeader(icon: .plus, title: L10n.lookup(italian: "Registra operazione"),
                                 description: L10n.lookup(italian: "Un acquisto, una vendita, un dividendo o un altro movimento del portafoglio."))
                progress
                switch step {
                case 0:
                    stepHeading("Che operazione è?", L10n.lookup(italian: "Scegli il tipo e lo strumento."))
                    typeSelect
                    VStack(alignment: .leading, spacing: BBSpacing.space2) {
                        BBText(L10n.lookup(italian: "Strumento"), style: BBTypography.bodyStrong.with(lineHeight: 14))
                        InstrumentPickerField(instrument: form.instrument, suggestions: suggestions, currency: userCurrency) { chosen in
                            form.instrument = chosen
                            form.held = model.heldQuantity(chosen.id)
                            priceEdited = false
                            form.price = ""
                            refreshPrice()
                        }
                    }
                case 1:
                    stepHeading("Quando e quanto?", form.type == .split
                                ? L10n.lookup(italian: "Es. 2 se ogni quota diventa due, 0,1 per un raggruppamento 10 a 1. Il costo resta lo stesso.")
                                : form.instrument?.name)
                    dateField
                    amounts
                    countervalue
                default:
                    stepHeading("Costi e imposte", L10n.lookup(italian: "Facoltativi: lascia 0 se non ci sono."))
                    costs
                    countervalue
                }
                errorBox
                actions
            }
        }
        .onAppear { refreshPrice() }
        .onDisappear { priceTask?.cancel() }
    }

    // MARK: Pieces

    private var progress: some View {
        HStack(spacing: BBSpacing.space1) {
            ForEach(0..<form.stepCount, id: \.self) { i in
                Capsule().fill(i <= step ? Color.bbPrimary : Color.bbMuted).frame(height: 4)
            }
        }
        .accessibilityElement()
        .accessibilityLabel(L10n.lookup(italian: "Passi della nuova operazione"))
        .accessibilityValue("\(step + 1)/\(form.stepCount)")
    }

    private func stepHeading(_ title: String, _ description: String?) -> some View {
        VStack(alignment: .leading, spacing: BBSpacing.space1) {
            BBText(L10n.lookup(italian: title), style: BBTextStyle.sectionHeading)
            if let description { BBText(description, style: BBTypography.body, color: .bbMutedForeground) }
        }
    }

    private var typeSelect: some View {
        BBSelect(label: L10n.lookup(italian: "Tipo"), options: OperationType.allCases.map { ($0, L10n.lookup(italian: $0.label)) },
                 selection: Binding(get: { form.type }, set: { next in
                     form.type = next
                     if step >= form.stepCount { step = form.stepCount - 1 }
                     refreshPrice()
                 }), title: L10n.lookup(italian: "Tipo di operazione"))
    }

    private var dateField: some View {
        BBDateField(label: L10n.lookup(italian: "Data"), date: Binding(get: { form.date }, set: { next in
            form.date = min(next, InvestmentsModel.todayKey)
            refreshPrice()
        }))
    }

    @ViewBuilder private var amounts: some View {
        let currency = form.instrument?.currency
        if form.showsQuantity {
            BBTextField(label: L10n.lookup(italian: form.quantityLabel), text: $form.quantity, keyboard: .amount)
        }
        if form.showsPrice {
            VStack(alignment: .leading, spacing: BBSpacing.space1_5) {
                BBTextField(label: L10n.lookup(italian: form.priceLabel) + (currency.map { " (\($0))" } ?? ""),
                            text: Binding(get: { form.price }, set: { form.price = $0; priceEdited = true }), keyboard: .amount)
                priceHint
            }
        }
        if form.showsGross {
            BBTextField(label: L10n.lookup(italian: "Importo lordo{0}", ["0": currency.map { " (\($0))" } ?? ""]), text: $form.gross, keyboard: .amount)
        }
    }

    @ViewBuilder private var priceHint: some View {
        let hint = form.type.suggestsMarketPrice ? PriceSuggestionHint.of(suggestion, fetching: fetching, date: form.date) : nil
        if let hint {
            let dateText: String = {
                if case .close(let d, _, _) = hint { return BBFormat.formatDateWithYear(d, locale: locale) }
                return ""
            }()
            HStack(spacing: BBSpacing.space1) {
                BBText(L10n.lookup(italian: hint.source, ["0": dateText]), style: BBTypography.caption, color: .bbMutedForeground)
                if let close = suggestion?.price?.close, priceEdited, form.priceValue != close {
                    Button {
                        form.price = OperationForm.priceText(close)
                        priceEdited = false
                    } label: {
                        BBText("· \(L10n.lookup(italian: "Usa")) \(BBFormat.formatNumber(close, maximumFractionDigits: 6, locale: locale))",
                               style: BBTypography.caption, color: .bbPrimary)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    @ViewBuilder private var costs: some View {
        BBTextField(label: L10n.lookup(italian: "Commissioni ({0})", ["0": userCurrency]), text: $form.fees, placeholder: "0", keyboard: .amount)
        BBTextField(label: L10n.lookup(italian: "Imposte trattenute ({0})", ["0": userCurrency]), text: $form.taxes, placeholder: "0", keyboard: .amount)
        if form.needsFx(userCurrency: userCurrency), let instrument = form.instrument {
            BBTextField(label: L10n.lookup(italian: "Cambio 1 {0} = ? {1}", ["0": instrument.currency, "1": userCurrency]), text: $form.fxRate,
                        placeholder: L10n.lookup(italian: "BCE del giorno"), keyboard: .amount)
        }
    }

    @ViewBuilder private var countervalue: some View {
        if let value = form.countervalue, let currency = form.instrument?.currency {
            BBText("\(L10n.lookup(italian: "Controvalore")) \(BBFormat.formatCurrency(value, currency: currency, locale: locale))",
                   style: BBTypography.bodyStrong).monospacedDigit()
        }
    }

    @ViewBuilder private var errorBox: some View {
        if let error { BBErrorBox(message: L10n.lookup(italian: error), reportArea: .operazione) }
    }

    private var actions: some View {
        HStack(spacing: BBSpacing.space2) {
            if step > 0 {
                BBButton(L10n.lookup(italian: "Indietro"), variant: .outline, size: .touch) {
                    error = nil
                    step -= 1
                }
            }
            Spacer(minLength: 0)
            if step < form.stepCount - 1 {
                BBButton(L10n.lookup(italian: "Continua"), size: .touch, isDisabled: step == 0 && form.instrument == nil) {
                    let gate = step == 0 ? form.stepOneError : form.stepTwoError
                    if let gate {
                        error = gate
                    } else {
                        error = nil
                        step += 1
                    }
                }
            } else {
                BBButton(L10n.lookup(italian: saving ? "Registrazione…" : "Registra operazione"), size: .touch, isLoading: saving) { save() }
            }
        }
    }

    // MARK: Behaviour

    private func save() {
        if let problem = form.validate(today: InvestmentsModel.todayKey) {
            error = problem
            return
        }
        saving = true
        error = nil
        Task {
            error = await model.save(form)
            saving = false
        }
    }

    /// INV-067: the close on/before the date, polled every 2 s while the history downloads; follows the date until edited.
    private func refreshPrice() {
        priceTask?.cancel()
        guard !editing, form.type.suggestsMarketPrice, let id = form.instrument?.id else {
            suggestion = nil
            return
        }
        let date = form.date
        suggestion = nil
        fetching = true
        priceTask = Task {
            for _ in 0..<30 {
                let result = try? await model.env.instruments.price(id: id, date: date)
                guard !Task.isCancelled else { return }
                suggestion = result ?? PriceOnDate(price: nil, loading: false)
                if let close = result?.price?.close, !priceEdited { form.price = OperationForm.priceText(close) }
                if result?.loading != true { break }
                try? await Task.sleep(for: .seconds(2))
            }
            fetching = false
        }
    }
}
