import BuddyBudgetKit
import SwiftUI

// Pensione «I tuoi dati» (PEN-005…017): snapshot form and list, fund profile, another fund, the add-fund form and
// the paste import. Android: PensionDataTab.kt.

struct PensionDataTab: View {
    let model: PensionModel

    var body: some View {
        if let view = model.state.view, let fund = view.fund {
            VStack(alignment: .leading, spacing: BBSpacing.space10) {
                if debugShows(0) { SnapshotsSection(model: model, fund: fund) }
                FundProfileSection(model: model, fund: fund).id(fund.id + fund.name + fund.adhesionDate)
                if view.funds.count < PensionRules.maxFunds {
                    PanelSection(title: L10n.lookup(italian: "Hai un altro fondo?"), icon: .circlePlus, color: .bbSwatchIndigo,
                                 description: L10n.lookup(italian: "Puoi tracciarne più di uno (per esempio un fondo negoziale e un PIP): il patrimonio netto li somma.")) {
                        AddFundForm(model: model).id(view.funds.count)
                    }
                }
            }
        }
    }
}

/// PEN-010/011/012.
private struct SnapshotsSection: View {
    let model: PensionModel
    let fund: PensionView.Fund
    @State private var date = PensionModel.todayKey
    @State private var contributions = ""
    @State private var value = ""
    @State private var saving = false
    @State private var error: String?
    @State private var showAll = false
    @Environment(\.bbLocale) private var locale
    @Environment(\.bbHideAmounts) private var hidden

    var body: some View {
        let text = PensionText(locale: locale, translate: { L10n.lookup(italian: $0) })
        let net = PensionRules.parseAmount(contributions)
        let val = PensionRules.parseAmount(value)
        let canSave = net != nil && val != nil && !date.isEmpty
        let rows = PensionRules.snapshotRows(fund.snapshots).filter { !model.pendingSnapshotRemovals.contains($0.id) }
        let visible = showAll ? rows : Array(rows.prefix(PensionRules.visibleSnapshots))
        PanelSection(title: L10n.lookup(italian: "Aggiorna i valori del fondo"), icon: .database, color: .bbPrimary,
                     description: L10n.lookup(italian: "Riporta i due numeri che vedi nell'area clienti, ogni volta che vuoi (di solito dopo ogni versamento del TFR). Il versamento lo ricaviamo noi dalla differenza. Se esiste già una fotografia con la stessa data, viene sostituita.")) {
            VStack(alignment: .leading, spacing: BBSpacing.space5) {
                VStack(alignment: .leading, spacing: BBSpacing.space3) {
                    VStack(alignment: .leading, spacing: BBSpacing.space1_5) {
                        BBText(L10n.lookup(italian: "Data"), style: BBTypography.body, color: .bbText2)
                        BBDateField(date: Binding(get: { date }, set: { date = min($0, model.today) }))
                    }
                    HStack(alignment: .top, spacing: BBSpacing.space3) {
                        labeled(L10n.lookup(italian: "Contributi netti")) {
                            BBTextField(text: $contributions, placeholder: L10n.lookup(italian: "es. 10.880"), keyboard: .amount)
                        }
                        labeled(L10n.lookup(italian: "Controvalore")) {
                            BBTextField(text: $value, placeholder: L10n.lookup(italian: "es. 11.420"), keyboard: .amount)
                        }
                    }
                    BBButton(L10n.lookup(italian: saving ? "Salvo…" : "Aggiungi"), fullWidth: true, isLoading: saving, isDisabled: !canSave || saving) {
                        guard let net, let val else { return }
                        saving = true
                        error = nil
                        Task {
                            error = await model.saveSnapshot(date: date, netContributions: net, value: val)
                            if error == nil {
                                contributions = ""
                                value = ""
                            }
                            saving = false
                        }
                    }
                }
                if let error { BBText(L10n.lookup(italian: error), style: BBTypography.body, color: .bbNeg) }
                Button { model.importOpen = true } label: {
                    HStack(spacing: BBSpacing.space1) {
                        BBText(L10n.lookup(italian: "Hai già uno storico?"), style: BBTypography.body, color: .bbText2)
                        BBIconView(.upload, size: .sm, color: .bbPrimary)
                        BBText(L10n.lookup(italian: "Importa da file CSV o Excel"), style: .link, color: .bbPrimary)
                    }
                    .frame(minHeight: 32)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                if !rows.isEmpty {
                    VStack(spacing: 0) {
                        ForEach(Array(visible.enumerated()), id: \.element.id) { index, row in
                            BBSwipeToDelete(onDelete: { model.removeSnapshot(row.snapshot) }) {
                                HStack(spacing: BBSpacing.space3) {
                                    VStack(alignment: .leading, spacing: 0) {
                                        HStack(alignment: .firstTextBaseline) {
                                            BBText(text.shortDate(row.snapshot.date), style: BBTypography.bodyStrong)
                                            Spacer(minLength: BBSpacing.space2)
                                            BBText(text.money(row.snapshot.value, model.currency, masked: hidden), style: .rowAmount.with(weight: 500))
                                        }
                                        HStack(spacing: BBSpacing.space2) {
                                            BBText("\(L10n.lookup(italian: "Contributi netti")) \(text.money(row.snapshot.netContributions, model.currency, masked: hidden))",
                                                   style: BBTypography.caption, color: .bbText2, lineLimit: 1)
                                            Spacer(minLength: BBSpacing.space2)
                                            BBText(row.delta.map { "+\(text.money($0, model.currency, masked: hidden))" } ?? "—",
                                                   style: BBTypography.caption, color: row.delta == nil ? .bbText2 : .bbPos)
                                                .accessibilityLabel("\(L10n.lookup(italian: "Versamento")) \(row.delta.map { text.money($0, model.currency) } ?? "—")")
                                        }
                                    }
                                    BBIconButton(icon: .trash2, accessibilityLabel: L10n.lookup(italian: "Elimina la fotografia del {0}", ["0": text.longDate(row.snapshot.date)]),
                                                 color: .bbMutedForeground) { model.removeSnapshot(row.snapshot) }
                                }
                                .padding(.vertical, BBSpacing.space1)
                            }
                        }
                    }
                    if rows.count > PensionRules.visibleSnapshots {
                        BBButton(showAll ? L10n.lookup(italian: "Mostra meno") : L10n.lookup(italian: "Mostra tutte ({0})", ["0": String(rows.count)]),
                                 variant: .ghost, size: .sm) { showAll.toggle() }
                    }
                }
            }
        }
    }

    private func labeled<Field: View>(_ label: String, @ViewBuilder field: () -> Field) -> some View {
        VStack(alignment: .leading, spacing: BBSpacing.space1_5) {
            BBText(label, style: BBTypography.body, color: .bbText2)
            field()
        }
        .frame(maxWidth: .infinity)
    }
}

/// PEN-008/009.
private struct FundProfileSection: View {
    let model: PensionModel
    let fund: PensionView.Fund
    @State private var name: String
    @State private var date: String
    @State private var error: String?
    @State private var busy = false

    init(model: PensionModel, fund: PensionView.Fund) {
        self.model = model
        self.fund = fund
        _name = State(initialValue: fund.name)
        _date = State(initialValue: fund.adhesionDate)
    }

    var body: some View {
        let canSave = PensionRules.canSaveProfile(name: name, date: date, originalName: fund.name, originalDate: fund.adhesionDate)
        PanelSection(title: L10n.lookup(italian: "Dati del fondo"), icon: .landmark, color: .bbSwatchSlate,
                     description: L10n.lookup(italian: "Nome e data di prima adesione: quest'ultima decide l'aliquota in uscita.")) {
            VStack(alignment: .leading, spacing: BBSpacing.space4) {
                VStack(alignment: .leading, spacing: BBSpacing.space1_5) {
                    BBText(L10n.lookup(italian: "Nome del fondo"), style: BBTypography.body, color: .bbText2)
                    BBTextField(text: Binding(get: { name }, set: { name = String($0.prefix(PensionRules.nameMaxLength)) }), keyboard: .text)
                }
                VStack(alignment: .leading, spacing: BBSpacing.space1_5) {
                    BBText(L10n.lookup(italian: "Prima adesione a una forma pensionistica"), style: BBTypography.body, color: .bbText2)
                    BBDateField(date: Binding(get: { date }, set: { date = min($0, model.today) }))
                    BBText(L10n.lookup(italian: "Conta la prima in assoluto, anche in un'altra azienda: decide l'aliquota in uscita."),
                           style: BBTypography.caption, color: .bbText2)
                }
                if let error { BBText(L10n.lookup(italian: error), style: BBTypography.body, color: .bbNeg) }
                HStack {
                    BBButton(L10n.lookup(italian: "Salva le modifiche"), isLoading: busy, isDisabled: !canSave || busy) {
                        busy = true
                        error = nil
                        Task {
                            error = await model.updateFund(name: JSNumber.trim(name), adhesionDate: date)
                            busy = false
                        }
                    }
                    Spacer(minLength: BBSpacing.space3)
                    Button { model.confirmDeleteFund = true } label: {
                        BBText(L10n.lookup(italian: "Elimina questo fondo"), style: BBTypography.body, color: .bbText2)
                            .underline()
                            .frame(minHeight: 32)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .bbAlertSheet(isPresented: Binding(get: { model.confirmDeleteFund }, set: { model.confirmDeleteFund = $0 }),
                      title: L10n.lookup(italian: "Eliminare questo fondo?"),
                      description: L10n.lookup(italian: "Verranno cancellate anche tutte le sue fotografie e sparirà dal patrimonio netto. L'operazione non si può annullare."),
                      confirmLabel: L10n.lookup(italian: "Elimina")) {
            Task { error = await model.deleteFund() }
        }
    }
}

/// PEN-006: two steps (name, first adhesion date).
struct AddFundForm: View {
    let model: PensionModel
    @State private var step = 0
    @State private var name = ""
    @State private var date = ""
    @State private var error: String?
    @State private var pending = false

    var body: some View {
        let canContinue = step == 1 ? !JSNumber.trim(name).isEmpty && !date.isEmpty && !pending : !JSNumber.trim(name).isEmpty
        VStack(alignment: .leading, spacing: BBSpacing.space4) {
            StepBars(index: step, count: 2).accessibilityLabel(L10n.lookup(italian: "Passi del nuovo fondo"))
            if step == 0 {
                StepHeading(title: L10n.lookup(italian: "Come si chiama il fondo?"))
                VStack(alignment: .leading, spacing: BBSpacing.space1_5) {
                    BBText(L10n.lookup(italian: "Nome del fondo"), style: BBTypography.body, color: .bbText2)
                    BBTextField(text: Binding(get: { name }, set: { name = String($0.prefix(PensionRules.nameMaxLength)) }),
                                placeholder: L10n.lookup(italian: "es. Piano pensione Moneyfarm"), keyboard: .text)
                }
            } else {
                StepHeading(title: L10n.lookup(italian: "Quando hai aderito?"),
                            description: L10n.lookup(italian: "Conta la prima adesione in assoluto a una forma pensionistica, anche in un'altra azienda: decide l'aliquota in uscita."))
                VStack(alignment: .leading, spacing: BBSpacing.space1_5) {
                    BBText(L10n.lookup(italian: "Data di prima adesione"), style: BBTypography.body, color: .bbText2)
                    BBDateField(date: Binding(get: { date.isEmpty ? model.today : date }, set: { date = min($0, model.today) }))
                }
            }
            if let error { BBErrorBox(message: L10n.lookup(italian: error), reportArea: .pensione) }
            HStack(spacing: BBSpacing.space2) {
                if step == 1 {
                    BBButton(L10n.lookup(italian: "Indietro"), variant: .outline) { step = 0 }
                }
                Spacer(minLength: 0)
                BBButton(L10n.lookup(italian: step == 1 ? (pending ? "Salvataggio…" : "Aggiungi il fondo") : "Continua"),
                         isLoading: pending, isDisabled: !canContinue) {
                    if step == 0 {
                        step = 1
                        if date.isEmpty { date = model.today }
                        return
                    }
                    pending = true
                    error = nil
                    Task {
                        error = await model.createFund(name: JSNumber.trim(name), adhesionDate: date)
                        pending = false
                    }
                }
            }
        }
    }
}

/// «Importa le fotografie» (PEN-014…018): File (CSV/TXT/XLSX picked in Files, the template, or pasted rows) →
/// Colonne → Riepilogo. The file is read on the device; nothing is written until the summary is confirmed; closing
/// resets the wizard.
struct PensionImportView: View {
    let model: PensionModel
    let fund: PensionView.Fund
    @State private var wizard: PensionImportState
    @State private var running = false
    @State private var error: String?
    @State private var picking = false
    @State private var template: URL?
    @Environment(\.bbLocale) private var locale
    @Environment(\.bbHideAmounts) private var hidden

    init(model: PensionModel, fund: PensionView.Fund) {
        self.model = model
        self.fund = fund
        var wizard = PensionImportState(today: model.today, existing: fund.snapshots)
        #if DEBUG
        // DEBUG-only `-BBDialog import-filled`: sample rows read into the Colonne step, for screenshots.
        if DebugLaunch.value("-BBDialog") == "import-filled" {
            wizard.text = "Data;Contributi netti;Controvalore\n31/03/2026;10880,00;11250,40\n30/06/2026;11420,00;11890,15\n31/13/2026;1;1"
            wizard.read()
        }
        #endif
        _wizard = State(initialValue: wizard)
    }

    var body: some View {
        let text = PensionText(locale: locale, translate: { L10n.lookup(italian: $0) })
        VStack(alignment: .leading, spacing: BBSpacing.space5) {
            FormDialogHeader(icon: .fileUp, title: L10n.lookup(italian: "Importa le fotografie"),
                             description: L10n.lookup(italian: "Da un file CSV o Excel, nel fondo «") + fund.name + "».")
            if wizard.done == nil {
                HStack(spacing: BBSpacing.space1_5) {
                    ForEach(PensionImportState.Step.allCases, id: \.self) { step in
                        let index = PensionImportState.Step.allCases.firstIndex(of: step)!
                        let current = PensionImportState.Step.allCases.firstIndex(of: wizard.step)!
                        VStack(alignment: .leading, spacing: BBSpacing.space1) {
                            Capsule().fill(index <= current ? Color.bbPrimary : Color.bbAlphaForeground10).frame(height: 4)
                            BBText(L10n.lookup(italian: step.label), style: index == current ? BBTypography.bodyStrong : BBTypography.body,
                                   color: index == current ? .bbForeground : .bbText2)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                    }
                }
                .accessibilityElement(children: .combine)
                .accessibilityLabel(L10n.lookup(italian: "Passi dell'import"))
            }
            switch wizard.step {
            case .file: fileStep
            case .columns: columnsStep(text)
            case .summary: summaryStep(text)
            }
            if let error = error ?? wizard.error { BBText(L10n.lookup(italian: error), style: BBTypography.body, color: .bbNeg) }
            actions
        }
        .importFilePicker(isPresented: $picking) { files in
            if let file = files.first { wizard.loadFile(name: file.name, data: file.data) }
        }
        .shareSheet(file: $template)
    }

    /// PEN-014 / PEN-018: file picker, template download (share sheet), or pasted rows.
    @ViewBuilder private var fileStep: some View {
        PanelSection(title: L10n.lookup(italian: "Scegli il file"), icon: .fileSpreadsheet, color: .bbSwatchGreen,
                     description: L10n.lookup(italian: "Una riga per fotografia, con tre colonne: la data, i contributi netti e il controvalore. Il file viene letto sul telefono e non viene caricato né conservato: al server arrivano solo le righe che confermi.")) {
            VStack(alignment: .leading, spacing: BBSpacing.space3) {
                FilePickZone(title: L10n.lookup(italian: "Scegli un file CSV o Excel (.xlsx)"), subtitle: L10n.lookup(italian: "CSV, TXT o Excel (.xlsx)")) {
                    picking = true
                }
                InlineLinkText(parts: [
                    .init(text: L10n.lookup(italian: "Non sai da dove partire?") + " "),
                    .init(text: L10n.lookup(italian: "Scarica il modello")) {
                        template = ImportFileTypes.temporaryFile(name: PensionImport.templateFileName, data: PensionImport.templateData())
                    },
                    .init(text: " " + L10n.lookup(italian: "e compilalo con i valori dell'area clienti del tuo fondo.")),
                ], color: .bbText2)
            }
        }
        PanelSection(title: L10n.lookup(italian: "Oppure incolla le righe"), icon: .clipboardPaste, color: .bbSwatchBlue,
                     description: L10n.lookup(italian: "Anche copiate da Excel")) {
            VStack(alignment: .trailing, spacing: BBSpacing.space2) {
                BBTextArea(text: $wizard.text, placeholder: L10n.lookup(italian: "Data;Contributi netti;Controvalore\n31/03/2026;10880,00;11250,40"))
                BBButton(L10n.lookup(italian: "Leggi"), variant: .outline, size: .sm, isDisabled: JSNumber.trim(wizard.text).isEmpty) { wizard.read() }
            }
        }
    }

    @ViewBuilder private func columnsStep(_ text: PensionText) -> some View {
        if let table = wizard.table, let mapping = wizard.mapping {
            PanelSection(title: L10n.lookup(italian: "Colonne"), icon: .columns3, color: .bbSwatchBlue,
                         description: "\(wizard.fileName ?? L10n.lookup(italian: "Testo incollato")) \(L10n.lookup(italian: "· controlla che ogni colonna sia quella giusta."))") {
                VStack(alignment: .leading, spacing: BBSpacing.space3) {
                    ForEach(PensionImportField.allCases, id: \.self) { field in
                        BBSelect(label: L10n.lookup(italian: field.label),
                                 options: [(Int?.none, L10n.lookup(italian: "Nessuna colonna"))] + table.headers.indices.map { (Optional($0), columnLabel(table, $0)) },
                                 selection: Binding(get: { mapping.columns[field] }, set: { wizard.mapping?.columns[field] = $0 }))
                    }
                    BBSelect(label: L10n.lookup(italian: "Formato delle date"),
                             options: [(ImportDateOrder.ymd, L10n.lookup(italian: "Anno, mese, giorno (2026-01-31)")),
                                       (.dmy, L10n.lookup(italian: "Giorno, mese, anno (31/01/2026)")),
                                       (.mdy, L10n.lookup(italian: "Mese, giorno, anno (01/31/2026)"))],
                             selection: Binding(get: { mapping.dateOrder }, set: { wizard.mapping?.dateOrder = $0 }))
                    BBSelect(label: L10n.lookup(italian: "Separatore dei decimali"),
                             options: [(ImportDecimalSeparator.dot, L10n.lookup(italian: "Punto (1,234.56)")),
                                       (.comma, L10n.lookup(italian: "Virgola (1.234,56)"))],
                             selection: Binding(get: { mapping.decimal }, set: { wizard.mapping?.decimal = $0 }))
                }
            }
            PanelSection(title: L10n.lookup(italian: "Anteprima"), icon: .table, color: .bbSwatchGreen) {
                if !wizard.missing.isEmpty {
                    BBText("\(L10n.lookup(italian: "Indica quale colonna contiene:")) \(wizard.missing.map { L10n.lookup(italian: $0).lowercased() }.joined(separator: ", ")).",
                           style: BBTypography.body, color: .bbNeg)
                } else {
                    VStack(alignment: .leading, spacing: BBSpacing.space2) {
                        let ok = wizard.snapshots
                        let problems = wizard.problems
                        BBText("\(ok.count) \(L10n.lookup(italian: "fotografie lette su")) \(wizard.rows.count) \(L10n.lookup(italian: "righe"))"
                               + (problems.isEmpty ? "" : L10n.lookup(italian: ", {0} scartate", ["0": String(problems.count)])) + ".", style: BBTypography.body)
                        ForEach(Array(ok.prefix(5).enumerated()), id: \.offset) { _, s in
                            HStack(alignment: .firstTextBaseline, spacing: BBSpacing.space2) {
                                BBText("\(L10n.lookup(italian: "Riga")) \(s.line)", style: BBTypography.caption, color: .bbText2).frame(width: 52, alignment: .leading)
                                BBText(text.shortDate(s.date), style: BBTypography.bodyStrong).frame(maxWidth: .infinity, alignment: .leading)
                                VStack(alignment: .trailing, spacing: 0) {
                                    BBText(text.money(s.value, model.currency, masked: hidden), style: BBTypography.body).monospacedDigit()
                                    BBText(text.money(s.netContributions, model.currency, masked: hidden), style: BBTypography.caption, color: .bbText2).monospacedDigit()
                                }
                            }
                            .padding(.vertical, BBSpacing.space1)
                        }
                        ForEach(Array(problems.prefix(5).enumerated()), id: \.offset) { _, row in
                            if case .error(let line, let message) = row {
                                HStack(alignment: .top, spacing: BBSpacing.space1_5) {
                                    BBIconView(.triangleAlert, size: .sm, color: .bbNeg).padding(.top, 2)
                                    BBText("\(L10n.lookup(italian: "Riga")) \(line): \(L10n.lookup(italian: message))", style: BBTypography.body, color: .bbText2)
                                }
                            }
                        }
                        if problems.count > 5 {
                            BBText("\(L10n.lookup(italian: "…e altre")) \(problems.count - 5)", style: BBTypography.body, color: .bbText2)
                        }
                    }
                }
            }
        }
    }

    private func columnLabel(_ table: PensionImportTable, _ column: Int) -> String {
        let header = table.headers[column].isEmpty ? L10n.lookup(italian: "Colonna {0}", ["0": String(column + 1)]) : table.headers[column]
        let example = table.rows.first { column < $0.count && !JSNumber.trim($0[column]).isEmpty }.map { $0[column] }
        return header + (example.map { L10n.lookup(italian: " — es. {0}", ["0": $0]) } ?? "")
    }

    @ViewBuilder private func summaryStep(_ text: PensionText) -> some View {
        if let done = wizard.done {
            VStack(spacing: BBSpacing.space2) {
                BBIconView(.circleCheck, points: 32, color: .bbPos)
                BBText(done.new + done.update == 0 ? L10n.lookup(italian: "Niente da cambiare")
                       : L10n.lookup(italian: "{0} aggiunte, {1} aggiornate", ["0": String(done.new), "1": String(done.update)]),
                       style: BBTypography.cardTitle.with(size: 18, lineHeight: 28))
                if done.unchanged > 0 {
                    BBText("\(done.unchanged) \(L10n.lookup(italian: "erano già presenti e sono state saltate."))", style: BBTypography.body, color: .bbMutedForeground)
                        .multilineTextAlignment(.center)
                }
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, BBSpacing.space6)
        } else {
            let plan = wizard.plan
            let updates = plan.rows.filter { $0.status == .update }
            let errors = plan.rows.filter { $0.status == .error }
            let discarded = wizard.problems.count
            PanelSection(title: L10n.lookup(italian: "Cosa cambia"), icon: .listChecks, color: .bbSwatchGreen) {
                VStack(alignment: .leading, spacing: BBSpacing.space3) {
                    HStack(alignment: .top, spacing: BBSpacing.space4) {
                        stat(plan.counts.new, L10n.lookup(italian: "da aggiungere"))
                        stat(plan.counts.update, L10n.lookup(italian: "da aggiornare"))
                        stat(plan.counts.unchanged, L10n.lookup(italian: "già presenti"))
                    }
                    BBText(L10n.lookup(italian: "Una fotografia con la stessa data di una già salvata ne sostituisce i valori; se sono identici viene saltata, quindi puoi reimportare lo stesso file senza doppioni."),
                           style: BBTypography.body, color: .bbText2)
                    if discarded > 0 {
                        BBText("\(discarded) \(L10n.lookup(italian: "righe del file sono state scartate al passo Colonne."))", style: BBTypography.body, color: .bbText2)
                    }
                }
            }
            if !updates.isEmpty {
                PanelSection(title: L10n.lookup(italian: "Verranno aggiornate"), icon: .listChecks, color: .bbSwatchOrange) {
                    VStack(spacing: 0) {
                        HStack {
                            BBText(L10n.lookup(italian: "Aggiorna"), style: BBTypography.body, color: .bbText2)
                            Spacer()
                            BBText(L10n.lookup(italian: "Controvalore prima"), style: BBTypography.body, color: .bbText2)
                        }
                        .padding(.bottom, BBSpacing.space2)
                        ForEach(Array(updates.prefix(6).enumerated()), id: \.offset) { _, row in
                            HStack {
                                BBText(text.shortDate(row.date), style: BBTypography.bodyStrong)
                                Spacer()
                                BBText(row.previous.map { text.money($0.value, model.currency, masked: hidden) } ?? "—", style: BBTypography.body).monospacedDigit()
                            }
                            .padding(.vertical, BBSpacing.space2)
                        }
                        if updates.count > 6 {
                            BBText("\(L10n.lookup(italian: "…e altre")) \(updates.count - 6)", style: BBTypography.body, color: .bbText2)
                                .frame(maxWidth: .infinity, alignment: .leading).padding(.top, BBSpacing.space2)
                        }
                    }
                }
            }
            if plan.error != nil || !errors.isEmpty || wizard.tooManyRows {
                VStack(alignment: .leading, spacing: BBSpacing.space2) {
                    HStack(spacing: BBSpacing.space1_5) {
                        BBIconView(.triangleAlert, size: .md, color: .bbNeg)
                        BBText(L10n.lookup(italian: "Finché ci sono errori non si importa nulla"), style: BBTypography.bodyStrong, color: .bbNeg)
                    }
                    if let planError = plan.error { BBText(L10n.lookup(italian: planError, plan.errorValues), style: BBTypography.body, color: .bbNeg) }
                    if wizard.tooManyRows { BBText(L10n.lookup(italian: "Al massimo 1000 righe per import"), style: BBTypography.body, color: .bbNeg) }
                    ForEach(Array(errors.prefix(6).enumerated()), id: \.offset) { _, row in
                        BBText("\(L10n.lookup(italian: "Riga")) \(row.line): \(L10n.lookup(italian: row.message ?? "", row.messageValues))", style: BBTypography.body, color: .bbNeg)
                    }
                    if errors.count > 6 { BBText("\(L10n.lookup(italian: "…e altre")) \(errors.count - 6)", style: BBTypography.body, color: .bbNeg) }
                    BBText(L10n.lookup(italian: "Correggi il file e ricaricalo."), style: BBTypography.body, color: .bbText2)
                }
                .padding(BBSpacing.space3)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(RoundedRectangle.bb(BBRadius.lg).fill(Color.bbNegSoft))
            }
        }
    }

    private func stat(_ value: Int, _ label: String) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            BBText(String(value), style: BBTypography.amountLarge).monospacedDigit()
            BBText(label, style: BBTypography.body, color: .bbText2)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    @ViewBuilder private var actions: some View {
        if wizard.done != nil {
            HStack {
                Spacer()
                BBButton(L10n.lookup(italian: "Chiudi"), size: .touch) { model.importOpen = false }
            }
        } else {
            HStack(spacing: BBSpacing.space2) {
                BBButton(L10n.lookup(italian: wizard.step == .file ? "Annulla" : "Indietro"), variant: .ghost, size: .touch, isDisabled: running) {
                    error = nil
                    if wizard.step == .file { model.importOpen = false } else { wizard.back() }
                }
                Spacer(minLength: 0)
                switch wizard.step {
                case .file:
                    EmptyView()
                case .columns:
                    BBButton(L10n.lookup(italian: "Avanti"), size: .touch, isDisabled: !wizard.canContinue) { wizard.step = .summary }
                case .summary:
                    let plan = wizard.plan
                    let count = plan.counts.new + plan.counts.update
                    BBButton(running ? L10n.lookup(italian: "Importo…") : plan.nothingToWrite ? L10n.lookup(italian: "Niente di nuovo da importare")
                             : L10n.lookup(italian: "Importa {0} fotografie", ["0": String(count)]),
                             size: .touch, isLoading: running, isDisabled: plan.nothingToWrite || plan.blocked || wizard.tooManyRows || running) {
                        running = true
                        error = nil
                        Task {
                            switch await model.importRows(wizard.payload) {
                            case .success(let counts): wizard.done = counts
                            case .failure(let failure): error = failure.message
                            }
                            running = false
                        }
                    }
                }
            }
        }
    }
}
