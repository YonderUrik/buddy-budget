import BuddyBudgetKit
import SwiftUI

/// «Il risultato è sbagliato» (IMP-049…054): start a correction of an imported job, follow it, compare current and
/// proposed data, confirm the replacement or discard it. Comparison tables become stacked rows on phone (mobile note).
/// Twin of `ImportCorrectionView` on Android.
struct ImportCorrectionView: View {
    let model: ImportsModel
    let job: PersonalImportListing.Job
    @State private var feedback = ""
    @State private var file: PickedFile?
    @State private var consent = false
    @State private var approved = false
    @State private var busy = false
    @State private var error: String?
    @State private var picking = false
    @State private var comparison: PersonalImportCorrection?
    @State private var comparisonError: String?
    @State private var comparing = false
    @State private var open: Set<String> = []
    @Environment(\.bbLocale) private var locale

    var body: some View {
        let starting = job.status == "imported"
        VStack(alignment: .leading, spacing: BBSpacing.space4) {
            BBText(L10n.lookup(italian: starting ? "Il risultato è sbagliato" : "Correzione dell’importazione"), style: BBTextStyle.sectionHeading)
                .accessibilityAddTraits(.isHeader)
            BBText(L10n.lookup(italian: "I movimenti originali restano invariati fino alla conferma della sostituzione."), style: BBTypography.body)
            if starting { startForm } else { progress }
            if let error { BBText(L10n.lookup(italian: error), style: BBTypography.body, color: .bbDestructive) }
        }
        .padding(BBSpacing.space4)
        .overlay(RoundedRectangle.bb(BBRadius.xl).strokeBorder(Color.bbBorder))
        .importFilePicker(isPresented: $picking) { files in file = files.first }
        .task(id: "\(job.id)-\(job.status)") {
            guard job.status == "correction_ready" else { return }
            comparing = true
            do {
                comparison = try await model.comparison(job.id)
                comparisonError = nil
            } catch {
                comparisonError = ImportAPIFailure(error).message ?? L10n.lookup(italian: "Confronto non disponibile")
            }
            comparing = false
        }
    }

    @ViewBuilder private var startForm: some View {
        VStack(alignment: .leading, spacing: BBSpacing.space2) {
            BBText(L10n.lookup(italian: "Che cosa è sbagliato?"), style: BBTypography.bodyStrong)
            BBTextArea(text: Binding(get: { feedback }, set: { feedback = String($0.prefix(PersonalImportRules.feedbackMaxLength)) }), placeholder: "")
        }
        VStack(alignment: .leading, spacing: BBSpacing.space2) {
            BBText(L10n.lookup(italian: "Ricarica il file originale CSV o Excel"), style: BBTypography.bodyStrong)
            if let file {
                ImportFileRow(name: file.name, detail: PersonalImportRules.sizeText(file.data.count, locale), filled: false,
                              removeLabel: L10n.lookup(italian: "Rimuovi {0}", ["0": file.name])) { self.file = nil }
            } else {
                BBButton(L10n.lookup(italian: "Scegli un file"), icon: .upload, variant: .outline, size: .touch, fullWidth: true) { picking = true }
            }
        }
        BBText(L10n.lookup(italian: "Il file precedente è stato eliminato dopo l’importazione. L’AI analizzerà il file completo insieme alla tua segnalazione tramite OpenRouter, senza conservazione presso il fornitore."),
               style: BBTypography.body, color: .bbMutedForeground)
        CheckboxRow(isOn: $consent, text: L10n.lookup(italian: "Acconsento a inviare il file completo e la segnalazione per una nuova analisi AI."))
        BBButton(L10n.lookup(italian: busy ? "Invio…" : "Analizza la correzione"), size: .touch, fullWidth: true, isLoading: busy,
                 isDisabled: busy || file == nil || JSNumber.trim(feedback).isEmpty || !consent) {
            guard let file else { return }
            busy = true
            error = nil
            Task {
                error = await model.startCorrection(of: job.id, feedback: feedback, file: file)
                busy = false
            }
        }
        BBButton(L10n.lookup(italian: "Annulla"), variant: .ghost, size: .touch, fullWidth: true, isDisabled: busy) { model.open(jobId: job.id) }
    }

    @ViewBuilder private var progress: some View {
        if job.status == "queued" || job.status == "processing" {
            BBText(L10n.lookup(italian: "Nuova analisi in corso. Ti avviseremo via email quando potrai controllarla."), style: BBTypography.body)
        }
        if let jobError = job.error { BBText(jobError, style: BBTypography.body, color: .bbDestructive) }
        if job.status == "expired" {
            BBText(L10n.lookup(italian: "La correzione è scaduta. Scartala e ricarica il file dall’importazione originale."), style: BBTypography.body)
        }
        if comparing { BBText(L10n.lookup(italian: "Caricamento del confronto…"), style: BBTypography.body, color: .bbMutedForeground) }
        if let comparisonError { BBText(comparisonError, style: BBTypography.body, color: .bbDestructive) }
        if let data = comparison { compare(data) }
        BBButton(L10n.lookup(italian: "Scarta correzione e mantieni originale"), variant: .outline, size: .touch, fullWidth: true, isDisabled: busy) {
            finish(replace: false)
        }
    }

    @ViewBuilder private func compare(_ data: PersonalImportCorrection) -> some View {
        let money = { (value: Double) in BBFormat.formatCurrency(value, currency: data.currency, locale: locale) }
        VStack(alignment: .leading, spacing: BBSpacing.space2) {
            BBText(L10n.lookup(italian: "Effetto dell’importazione sul conto"), style: BBTypography.bodyStrong)
            compareRow(L10n.lookup(italian: "Movimenti"), String(data.before.count), String(data.after.count))
            compareRow(L10n.lookup(italian: "Operazioni di investimento"), String(data.investmentsBefore), String(data.investmentsAfter))
            compareRow(L10n.lookup(italian: "Variazione di liquidità"), money(data.cashBefore), money(data.cashAfter))
        }
        cashList(L10n.lookup(italian: "Movimenti attuali"), data.before, money)
        cashList(L10n.lookup(italian: "Movimenti proposti"), data.after, money)
        tradeList(L10n.lookup(italian: "Investimenti attuali"), data.tradesBefore, money)
        tradeList(L10n.lookup(italian: "Investimenti proposti"), data.tradesAfter, money)
        CheckboxRow(isOn: $approved, text: L10n.lookup(italian: "Ho controllato il confronto e voglio sostituire i dati dell’importazione originale."))
        BBButton(L10n.lookup(italian: "Conferma e sostituisci"), size: .touch, fullWidth: true, isLoading: busy, isDisabled: busy || !approved) {
            finish(replace: true)
        }
    }

    private func compareRow(_ label: String, _ before: String, _ after: String) -> some View {
        VStack(alignment: .leading, spacing: BBSpacing.space1) {
            BBText(label, style: BBTypography.body)
            HStack(spacing: BBSpacing.space4) {
                VStack(alignment: .leading, spacing: 0) {
                    BBText(L10n.lookup(italian: "Attuale"), style: BBTypography.caption, color: .bbMutedForeground)
                    BBText(before, style: BBTypography.bodyStrong).monospacedDigit()
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                VStack(alignment: .leading, spacing: 0) {
                    BBText(L10n.lookup(italian: "Proposto"), style: BBTypography.caption, color: .bbMutedForeground)
                    BBText(after, style: BBTypography.bodyStrong).monospacedDigit()
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .padding(BBSpacing.space3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle.bb(BBRadius.lg).fill(Color.bbAlphaMuted50))
    }

    private func cashList(_ title: String, _ rows: [PersonalImportCorrection.CashRow], _ money: @escaping (Double) -> String) -> some View {
        DisclosureBox(title: title, isOpen: binding(title), boxed: false) {
            ForEach(Array(rows.enumerated()), id: \.offset) { _, r in
                BBText("\(BBFormat.formatShortDate(r.date, locale: locale)) · \(r.description) · \(money(r.amount))", style: BBTypography.body)
                    .padding(.vertical, BBSpacing.space1)
            }
        }
    }

    private func tradeList(_ title: String, _ rows: [PersonalImportCorrection.Trade], _ money: @escaping (Double) -> String) -> some View {
        DisclosureBox(title: title, isOpen: binding(title), boxed: false) {
            BBText(L10n.lookup(italian: "Prezzo e lordo nella valuta dello strumento; commissioni e imposte nella valuta del profilo."), style: BBTypography.caption,
                   color: .bbMutedForeground)
            ForEach(Array(rows.enumerated()), id: \.offset) { _, r in
                VStack(alignment: .leading, spacing: 2) {
                    BBText("\(r.date.map { BBFormat.formatShortDate($0, locale: locale) } ?? "") · \(r.description ?? "")", style: BBTypography.bodyStrong)
                    BBText([L10n.lookup(italian: ImportOperationTypes.label(r.type)),
                            "\(L10n.lookup(italian: "Quantità")) \(BBFormat.formatNumber(r.quantity, maximumFractionDigits: 10, locale: locale))",
                            "\(L10n.lookup(italian: "Prezzo")) \(BBFormat.formatNumber(r.price, maximumFractionDigits: 8, locale: locale)) \(r.currency)",
                            "\(L10n.lookup(italian: "Lordo")) \(r.grossAmount.map { "\(BBFormat.formatNumber($0, maximumFractionDigits: 3, locale: locale)) \(r.currency)" } ?? "—")",
                            "\(L10n.lookup(italian: "Commissioni")) \(money(r.fees))", "\(L10n.lookup(italian: "Imposte")) \(money(r.taxes))"].joined(separator: " · "),
                           style: BBTypography.caption, color: .bbMutedForeground)
                }
                .padding(.vertical, BBSpacing.space1)
            }
        }
    }

    private func binding(_ key: String) -> Binding<Bool> {
        Binding(get: { open.contains(key) }, set: { if $0 { open.insert(key) } else { open.remove(key) } })
    }

    private func finish(replace: Bool) {
        busy = true
        error = nil
        Task {
            error = await model.finishCorrection(job, replace: replace)
            busy = false
        }
    }
}
