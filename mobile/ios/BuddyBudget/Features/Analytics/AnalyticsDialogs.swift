import BuddyBudgetKit
import SwiftUI

// Dialogs of «Risposte»: walkthrough (ANA-005/006), «Tutte le ipotesi» (ANA-033/034, full screen), «Il tuo traguardo»
// (ANA-007/008) and the glossary sheet (ANA-032). Android: AnalyticsDialogs.kt.

struct AnalyticsDialogs: ViewModifier {
    let model: AnalyticsModel

    func body(content: Content) -> some View {
        content
            .bbSheet(isPresented: Binding(get: { model.walkthroughOpen }, set: { if !$0 { model.closeWalkthrough() } })) {
                WalkthroughView(model: model)
            }
            .bbSheet(isPresented: Binding(get: { model.termId != nil }, set: { if !$0 { model.termId = nil } }),
                     title: model.termId.flatMap(AnalyticsContent.term).map { L10n.lookup(italian: $0.title) }) {
                if let entry = model.termId.flatMap(AnalyticsContent.term) {
                    BBText(L10n.lookup(italian: entry.text), style: BBTypography.body, color: .bbMutedForeground)
                }
            }
            .bbSheet(isPresented: Binding(get: { model.targetDialogOpen }, set: { model.targetDialogOpen = $0 }),
                     title: L10n.lookup(italian: "Il tuo traguardo")) {
                if let view = model.state.view, let plan = model.state.savedPlan {
                    TargetForm(model: model, view: view, plan: plan)
                }
            }
            .formDialog(isPresented: Binding(get: { model.assumptionsOpen }, set: { model.assumptionsOpen = $0 })) {
                if let view = model.state.view, let plan = model.state.savedPlan {
                    AssumptionsForm(model: model, view: view, plan: plan)
                }
            }
    }
}

/// ANA-005: six steps, «Salta» / «Indietro», «Avanti» / «Inizia», dots.
private struct WalkthroughView: View {
    let model: AnalyticsModel

    var body: some View {
        let steps = AnalyticsContent.walkthrough
        let index = min(model.walkthroughStep, steps.count - 1)
        let step = steps[index]
        VStack(alignment: .leading, spacing: BBSpacing.space4) {
            VStack(alignment: .leading, spacing: BBSpacing.space1_5) {
                BBText(L10n.lookup(italian: "Passo") + " \(index + 1) " + L10n.lookup(italian: "di") + " \(steps.count)",
                       style: BBTypography.body, color: .bbMutedForeground)
                BBText(L10n.lookup(italian: step.title), style: BBTypography.cardTitle.with(size: 18, lineHeight: 26)).accessibilityAddTraits(.isHeader)
            }
            VStack(alignment: .leading, spacing: BBSpacing.space3) {
                ForEach(step.body, id: \.self) { BBText(L10n.lookup(italian: $0), style: BBTypography.body, color: .bbMutedForeground) }
            }
            HStack(spacing: BBSpacing.space2) {
                HStack(spacing: BBSpacing.space1) {
                    ForEach(0..<steps.count, id: \.self) { i in
                        Circle().fill(i == index ? Color.bbPrimary : Color.bbMutedForeground.opacity(0.3)).frame(width: 6, height: 6)
                    }
                }
                .accessibilityHidden(true)
                Spacer(minLength: 0)
                if index > 0 {
                    BBButton(L10n.lookup(italian: "Indietro"), variant: .outline) { model.walkthroughStep = index - 1 }
                } else {
                    BBButton(L10n.lookup(italian: "Salta"), variant: .ghost) { model.closeWalkthrough() }
                }
                if index == steps.count - 1 {
                    BBButton(L10n.lookup(italian: "Inizia")) { model.closeWalkthrough() }
                } else {
                    BBButton(L10n.lookup(italian: "Avanti")) { model.walkthroughStep = index + 1 }
                }
            }
        }
    }
}

/// ANA-008: one figure, live preview, saved as data-linked when equal to the data.
private struct TargetForm: View {
    let model: AnalyticsModel
    let view: AnalyticsView
    let plan: FirePlan
    @State private var draft: AnalyticsGoalDraft?
    @State private var localError: String?
    @Environment(\.bbLocale) private var locale
    @Environment(\.bbHideAmounts) private var hidden

    var body: some View {
        let text = AnalyticsText(locale: locale, masked: hidden, translate: { L10n.lookup(italian: $0) })
        let current = draft ?? AnalyticsGoalDraft(plan: plan)
        VStack(alignment: .leading, spacing: BBSpacing.space5) {
            BBText(L10n.lookup(italian: "Il traguardo è il patrimonio che ti permette di vivere dei tuoi soldi: ogni anno ne prelevi una piccola parte e ti basta per le spese. Ti serve una sola cifra."),
                   style: BBTypography.body, color: .bbMutedForeground)
            VStack(alignment: .leading, spacing: BBSpacing.space1_5) {
                BBTextField(label: L10n.lookup(italian: "Quanto ti serve in un anno"),
                            text: Binding(get: { current.text }, set: { var d = current; d.text = $0; draft = d }),
                            placeholder: L10n.lookup(italian: "Per esempio 24.000"), keyboard: .text, height: 44)
                BBText(current.dataSpending.map { L10n.lookup(italian: "Dai tuoi movimenti spendi circa {0} l'anno: puoi tenerla o scrivere la cifra con cui vorresti vivere.",
                                                              ["0": text.money($0, view.currency)]) }
                    ?? L10n.lookup(italian: "Tutte le spese di un anno: casa, spesa, svago. Se non la sai, parti da 12 volte quello che spendi in un mese."),
                       style: BBTypography.caption, color: .bbMutedForeground)
            }
            if let preview = current.preview(base: view.base, assumptions: view.assumptions), let target = preview.target {
                VStack(alignment: .leading, spacing: BBSpacing.space1) {
                    BBText(L10n.lookup(italian: "Il tuo traguardo"), style: BBTypography.body, color: .bbMutedForeground)
                    BBText(text.money(target, view.currency), style: BBTypography.statValue).monospacedDigit()
                    BBText(L10n.lookup(italian: "Prelevandone il") + " " + text.pct(view.assumptions.withdrawalRate) + " "
                        + L10n.lookup(italian: "ogni anno ricavi quello che ti serve.") + " " + text.goalPreviewWhen(preview, todayYear: model.todayYear),
                           style: BBTypography.body, color: .bbText2)
                    BBText(L10n.lookup(italian: "Rendimento, prelievo e il resto si cambiano dopo, da «Tutte le ipotesi»."), style: BBTypography.caption, color: .bbMutedForeground)
                }
            } else {
                BBText(L10n.lookup(italian: "Scrivi la cifra: qui compare il patrimonio che ti serve."), style: BBTypography.body, color: .bbMutedForeground)
            }
            if let error = localError ?? model.state.saveError {
                BBText(error, style: BBTypography.body, color: .bbNeg)
            }
            VStack(spacing: BBSpacing.space2) {
                BBButton(model.state.saving ? L10n.lookup(italian: "Salvo…") : L10n.lookup(italian: "Salva il traguardo"), size: .touch, fullWidth: true,
                         isDisabled: model.state.saving) {
                    guard let patch = current.patch else {
                        localError = L10n.lookup(italian: "Scrivi quanto ti serve in un anno, per esempio 24.000.")
                        return
                    }
                    localError = nil
                    Task { if await model.save(patch) { model.targetDialogOpen = false } }
                }
                BBButton(L10n.cancel, variant: .outline, size: .touch, fullWidth: true) { model.targetDialogOpen = false }
            }
        }
    }
}

/// ANA-033 / ANA-034: «Tutte le ipotesi» as a full-screen form with the save buttons at the bottom.
private struct AssumptionsForm: View {
    let model: AnalyticsModel
    let view: AnalyticsView
    let plan: FirePlan
    @State private var draft: AnalyticsAssumptionsDraft?
    @State private var localError: String?
    @Environment(\.bbLocale) private var locale
    @Environment(\.bbHideAmounts) private var hidden

    var body: some View {
        let text = AnalyticsText(locale: locale, masked: hidden, translate: { L10n.lookup(italian: $0) })
        let d = draft ?? AnalyticsAssumptionsDraft(view.assumptions)
        let info = view.returnInfo
        let offer = AnalyticsRules.historyOffer(info)
        let phrase = text.periodPhrase(view.assumptions.dataPeriod, fromKey: view.base.cashflow.fromKey, toKey: view.base.cashflow.toKey)
        VStack(alignment: .leading, spacing: BBSpacing.space5) {
            VStack(alignment: .leading, spacing: BBSpacing.space1_5) {
                BBText(L10n.lookup(italian: "Tutte le ipotesi"), style: BBTextStyle.sectionHeading).accessibilityAddTraits(.isHeader)
                BBText(L10n.lookup(italian: "Quelle che cambi raramente. Si applicano a tutta la pagina e restano salvate."), style: BBTypography.body, color: .bbMutedForeground)
            }
            .padding(.trailing, BBSpacing.space10)
            BBText(L10n.lookup(italian: "Tutti i calcoli partono da queste ipotesi: sono tue assunzioni, non previsioni. Cambiale e guarda come si muovono i risultati."),
                   style: BBTypography.body, color: .bbMutedForeground)
            ForEach(AnalyticsAssumptionsDraft.PercentField.allCases, id: \.self) { field in
                VStack(alignment: .leading, spacing: BBSpacing.space1_5) {
                    BBTextField(label: L10n.lookup(italian: field.label) + " (%)",
                                text: Binding(get: { d.percents[field] ?? "" }, set: { var n = d; n.set(field, $0); draft = n }), keyboard: .amount)
                    if field == .expectedReturn, let offer, !d.returnAuto {
                        Button { var n = d; n.useHistory(offer); draft = n } label: {
                            BBText(L10n.lookup(italian: "Usa il tuo rendimento (") + text.pct(offer) + ")", style: .link, color: .bbPrimary)
                        }
                        .buttonStyle(.plain)
                    }
                    BBText(field == .expectedReturn
                        ? (d.returnAuto ? L10n.lookup(italian: "Torna a seguire il tuo storico al salvataggio.") : text.returnSourceText(info, currency: view.currency, period: view.assumptions.dataPeriod))
                            + " " + L10n.lookup(italian: field.hint)
                        : L10n.lookup(italian: field.hint), style: BBTypography.caption, color: .bbMutedForeground)
                }
            }
            field(L10n.lookup(italian: "Anni di pensione da coprire"), d.years, keyboard: .number,
                  hint: L10n.lookup(italian: "Quanto deve durare il patrimonio. Per smettere a 45 anni e arrivare a 90, circa 45; più è lungo, più il tasso di prelievo sicuro scende.")) {
                var n = d; n.years = $0; draft = n
            }
            field(L10n.lookup(italian: "Spesa annua in pensione ({0})", ["0": view.currency]), d.spending, keyboard: .number,
                  placeholder: L10n.lookup(italian: "Dai tuoi dati"),
                  hint: plan.spendingSource == .dati && plan.spending != nil
                      ? L10n.lookup(italian: "Vuoto = uso le tue uscite {0}, riportate a un anno: {1}. Scrivi una cifra se in pensione spenderai diversamente.",
                                    ["0": phrase, "1": text.money(plan.spending ?? 0, view.currency)])
                      : L10n.lookup(italian: "Vuoto = uso le tue uscite {0}, riportate a un anno (servono almeno 3 mesi di movimenti).", ["0": phrase])) {
                var n = d; n.spending = $0; draft = n
            }
            field(L10n.lookup(italian: "Risparmio annuo ({0})", ["0": view.currency]), d.savings, keyboard: .number,
                  placeholder: L10n.lookup(italian: "Dai tuoi dati"),
                  hint: plan.savingsSource == .dati && plan.savings != nil
                      ? L10n.lookup(italian: "Vuoto = uso quanto hai messo da parte {0}, riportato a un anno: {1}.", ["0": phrase, "1": text.money(plan.savings ?? 0, view.currency)])
                      : L10n.lookup(italian: "Vuoto = uso entrate meno uscite {0}, riportate a un anno. Scrivi 0 se non versi più nulla.", ["0": phrase])) {
                var n = d; n.savings = $0; draft = n
            }
            VStack(alignment: .leading, spacing: BBSpacing.space1_5) {
                BBSelect(label: L10n.lookup(italian: "Regola di prelievo"), options: WithdrawalRule.allCases.map { ($0, text.ruleLabel($0)) },
                         selection: Binding(get: { d.rule }, set: { var n = d; n.rule = $0; draft = n }))
                BBText(L10n.lookup(italian: "Come decidi quanto prelevare ogni anno in pensione. La scheda Prelievi le confronta."), style: BBTypography.caption, color: .bbMutedForeground)
            }
            VStack(alignment: .leading, spacing: BBSpacing.space1_5) {
                BBText(L10n.lookup(italian: "Pensione pubblica attesa (facoltativa)"), style: BBTypography.bodyStrong.with(lineHeight: 14))
                BBTextField(text: Binding(get: { d.pensionAnnual }, set: { var n = d; n.pensionAnnual = $0; draft = n }),
                            placeholder: L10n.lookup(italian: "Importo annuo ({0})", ["0": view.currency]), keyboard: .number)
                    .accessibilityLabel(L10n.lookup(italian: "Importo annuo della pensione pubblica"))
                BBTextField(text: Binding(get: { d.pensionAfter }, set: { var n = d; n.pensionAfter = $0; draft = n }),
                            placeholder: L10n.lookup(italian: "Dopo quanti anni di pensione FIRE"), keyboard: .number)
                    .accessibilityLabel(L10n.lookup(italian: "Anni dall'inizio della pensione FIRE"))
                BBText(L10n.lookup(italian: "Se andrai in pensione presto, la pensione pubblica arriverà più tardi e ridurrà quanto devi prelevare da allora. Scrivi l'importo in euro di oggi e fra quanti anni dall'inizio la riceverai; lascia vuoto per ignorarla (scelta prudente)."),
                       style: BBTypography.caption, color: .bbMutedForeground)
            }
            if model.taxes {
                toggle(L10n.lookup(italian: "Conta le imposte sulle plusvalenze"),
                       L10n.lookup(italian: "Il patrimonio che spendi è quello dopo le tasse: il numero FIRE sale di conseguenza. Stimate:") + " "
                           + text.money(plan.liquidation.latentTax, view.currency) + " " + L10n.lookup(italian: "se vendessi tutto oggi."),
                       d.includeTax) { var n = d; n.includeTax = $0; draft = n }
            }
            toggle(L10n.lookup(italian: "Includi la previdenza complementare"),
                   (view.base.wealth.pension > 0 ? L10n.lookup(italian: "Valore attuale {0}. ", ["0": text.money(view.base.wealth.pension, view.currency)]) : "")
                       + L10n.lookup(italian: "Di solito non è prelevabile prima dell'età pensionabile, quindi è escluso di default."),
                   d.includePension) { var n = d; n.includePension = $0; draft = n }
            if let error = localError ?? model.state.saveError {
                BBText(error, style: BBTypography.body, color: .bbNeg)
            }
            VStack(spacing: BBSpacing.space2) {
                BBButton(model.state.saving ? L10n.lookup(italian: "Salvo…") : L10n.lookup(italian: "Salva ipotesi"), size: .touch, fullWidth: true,
                         isDisabled: model.state.saving) {
                    switch d.submit(text: text) {
                    case .failure(let e):
                        localError = e.text
                    case .success(let patch):
                        localError = nil
                        Task { if await model.save(patch) { model.assumptionsOpen = false } }
                    }
                }
                BBButton(L10n.lookup(italian: "Ripristina i valori consigliati"), variant: .outline, size: .touch, fullWidth: true, isDisabled: model.state.saving) {
                    var n = d
                    n.resetToDefaults(info)
                    draft = n
                }
            }
        }
    }

    private func field(_ label: String, _ value: String, keyboard: BBKeyboard, placeholder: String = "", hint: String,
                       onChange: @escaping (String) -> Void) -> some View {
        VStack(alignment: .leading, spacing: BBSpacing.space1_5) {
            BBTextField(label: label, text: Binding(get: { value }, set: onChange), placeholder: placeholder, keyboard: keyboard)
            BBText(hint, style: BBTypography.caption, color: .bbMutedForeground)
        }
    }

    private func toggle(_ title: String, _ hint: String, _ isOn: Bool, onChange: @escaping (Bool) -> Void) -> some View {
        HStack(alignment: .top, spacing: BBSpacing.space4) {
            VStack(alignment: .leading, spacing: 2) {
                BBText(title, style: BBTypography.bodyStrong)
                BBText(hint, style: BBTypography.caption, color: .bbMutedForeground)
            }
            Spacer(minLength: 0)
            BBSwitch(isOn: Binding(get: { isOn }, set: onChange), accessibilityLabel: title)
        }
    }
}
