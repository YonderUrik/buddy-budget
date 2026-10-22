import BuddyBudgetKit
import SwiftUI

/// Anteprima of a server statement (IBKR, DEGIRO, Trade Republic): counts, destination portfolio (DEGIRO, INV-097),
/// first operations, account movements, rows not imported and warnings (INV-096).
struct BrokerStatementStep: View {
    @Bindable var model: BrokerImportModel
    @Environment(\.bbLocale) private var locale

    var body: some View {
        let rows = model.rows
        let operations = rows.filter(\.isOk).count
        let cash = model.statement?.cashMovements
        let warnings = model.warnings
        VStack(alignment: .leading, spacing: BBSpacing.space6) {
            ImportDialogSection {
                PreviewHeader(fileName: model.fileName, providerName: model.statement.map { ImportProviders.info($0.provider).name })
                PreviewNumbers(items: [(operations, operations == 1 ? "operazione da importare" : "operazioni da importare")]
                               + (cash.map { [($0.count, "movimenti del conto")] } ?? [])
                               + [(rows.count - operations + warnings.count, "da guardare")])
                if operations == 0 && (cash ?? []).isEmpty {
                    ImportNotice(tone: .error, title: "Non ci sono operazioni da importare in questo file",
                                 hint: "Controlla di aver esportato il periodo giusto e di aver scelto il file del broker corretto.")
                }
            }
            if model.statement?.preset == "degiro" && !model.portfolios.isEmpty {
                let portfolios = model.portfolios
                BBSelect(label: L10n.lookup(italian: "In quale portafoglio lo metto?"),
                         options: (portfolios.count > 1 ? [("", L10n.lookup(italian: "Scegli un portafoglio"))] : []) + portfolios.map { ($0.id, $0.name) },
                         selection: Binding(get: { model.portfolioId.isEmpty && portfolios.count == 1 ? portfolios[0].id : model.portfolioId },
                                            set: { model.portfolioId = $0 }),
                         height: BBLayout.minTouchTarget)
            }
            if operations > 0 {
                ImportDialogSection(title: L10n.lookup(italian: "Le prime operazioni")) { ImportRowsPreview(rows: rows) }
            }
            if let cash, !cash.isEmpty {
                ImportDialogSection(title: L10n.lookup(italian: "Movimenti del conto"),
                                    description: L10n.lookup(italian: "Pagamenti con carta, bonifici, interessi e bonus: finiscono in Liquidità → Movimenti, da categorizzare. Il saldo si calcola dallo storico completo partendo da zero, perché il file non contiene un saldo ufficiale.")) {
                    VStack(spacing: 0) {
                        ForEach(Array(cash.prefix(4).enumerated()), id: \.offset) { i, m in
                            if i > 0 { BBSeparator() }
                            HStack(alignment: .firstTextBaseline, spacing: BBSpacing.space3) {
                                BBText("\(m.date.split(separator: "-").reversed().joined(separator: "/")) · \(m.description)", style: BBTypography.body, lineLimit: 1)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                                BBText("\(String(format: "%.2f", m.amount)) \(m.currency)", style: BBTypography.caption).monospacedDigit()
                            }
                            .padding(.vertical, BBSpacing.space1_5)
                        }
                    }
                    if cash.count > 4 {
                        BBText("\(L10n.lookup(italian: "…e altri")) \(cash.count - 4) \(L10n.lookup(italian: "movimenti, tutti inclusi."))", style: BBTypography.caption,
                               color: .bbMutedForeground)
                    }
                }
            }
            SkippedRowsView(rows: rows)
            if !warnings.isEmpty {
                ImportNotice(tone: .warning, title: "\(warnings.count) \(L10n.lookup(italian: warnings.count == 1 ? "voce del rendiconto non viene importata" : "voci del rendiconto non vengono importate"))",
                             hint: "Se contano per i tuoi numeri, registrale a mano da «Registra».") {
                    VStack(alignment: .leading, spacing: BBSpacing.space1) {
                        ForEach(Array(warnings.prefix(5).enumerated()), id: \.offset) { _, w in
                            BBText("\(L10n.lookup(italian: "Riga")) \(w.line) · \(w.section): \(L10n.lookup(italian: w.message))", style: BBTypography.body,
                                   color: .bbMutedForeground)
                        }
                        if warnings.count > 5 {
                            BBText("\(L10n.lookup(italian: "…e altre")) \(warnings.count - 5).", style: BBTypography.body, color: .bbMutedForeground)
                        }
                    }
                }
            }
        }
    }
}

/// Anteprima of a column CSV (generic, Yahoo, Fineco, INV-098): counts, first operations, rows not imported and
/// «Come leggo le colonne» (closed when the format is recognised).
struct BrokerMappingStep: View {
    @Bindable var model: BrokerImportModel
    @State private var fieldsOpen = false

    var body: some View {
        let rows = model.rows
        let ok = rows.filter(\.isOk)
        let withWarning = ok.filter { !$0.warnings.isEmpty }.count
        let missing = model.missing
        let recognizedAs = model.provider == .fineco ? ImportProviders.info(.fineco).name : model.presetLabel
        VStack(alignment: .leading, spacing: BBSpacing.space6) {
            ImportDialogSection {
                PreviewHeader(fileName: model.fileName, providerName: recognizedAs)
                if missing.isEmpty {
                    PreviewNumbers(items: [(ok.count, ok.count == 1 ? "operazione da importare" : "operazioni da importare"),
                                           (rows.count - ok.count, "righe non importate"), (withWarning, "con un avviso")])
                } else {
                    ImportNotice(tone: .warning, title: "Mi manca qualche colonna",
                                 hint: L10n.lookup(italian: "Indica quale colonna contiene {0}.", ["0": missing.map { L10n.lookup(italian: $0) }.joined(separator: ", ")]))
                }
            }
            if missing.isEmpty && !ok.isEmpty {
                ImportDialogSection(title: L10n.lookup(italian: "Le prime operazioni"),
                                    description: withWarning > 0 ? L10n.lookup(italian: "{0} con un avviso: controllale prima di proseguire.", ["0": String(withWarning)]) : nil) {
                    VStack(alignment: .leading, spacing: BBSpacing.space2) {
                        BBText("\(ok.count) \(L10n.lookup(italian: "operazioni lette su")) \(rows.count) \(L10n.lookup(italian: "righe"))"
                               + (rows.count > ok.count ? L10n.lookup(italian: ", {0} scartate", ["0": String(rows.count - ok.count)]) : "")
                               + (withWarning > 0 ? L10n.lookup(italian: ", {0} con un avviso", ["0": String(withWarning)]) : "") + ".",
                               style: BBTypography.body)
                        ImportRowsPreview(rows: rows)
                    }
                }
            }
            if missing.isEmpty && ok.isEmpty && !rows.isEmpty {
                ImportNotice(tone: .error, title: "Con queste colonne non trovo nessuna operazione valida",
                             hint: "Controlla qui sotto che colonne e formati (date, decimali) siano quelli del tuo file.")
            }
            if missing.isEmpty { SkippedRowsView(rows: rows) }
            if recognizedAs != nil && missing.isEmpty {
                DisclosureBox(title: L10n.lookup(italian: "Come leggo le colonne"), isOpen: $fieldsOpen, boxed: false) { fields }
            } else {
                PanelSection(title: L10n.lookup(italian: "Come leggo le colonne"), icon: .table, color: .bbSwatchIndigo,
                             description: L10n.lookup(italian: "Per ogni informazione scegli la colonna del tuo file. La prossima volta ricordo la scelta per file con le stesse intestazioni."),
                             action: { EmptyView() }) { fields }
            }
        }
    }

    @ViewBuilder private var fields: some View {
        if let table = model.table, let mapping = model.mapping {
            let columnOptions: [(Int?, String)] = [(nil, L10n.lookup(italian: "Nessuna colonna"))] + table.headers.indices.map { i in
                let header = table.headers[i].isEmpty ? L10n.lookup(italian: "Colonna {0}", ["0": String(i + 1)]) : table.headers[i]
                let example = ImportMappingRules.columnExample(table, column: i)
                return (Optional(i), header + (example.isEmpty ? "" : L10n.lookup(italian: " — es. {0}", ["0": example])))
            }
            VStack(alignment: .leading, spacing: BBSpacing.space3) {
                ForEach(ImportField.formOrder, id: \.self) { field in
                    BBSelect(label: L10n.lookup(italian: field.label), options: columnOptions,
                             selection: Binding(get: { mapping.columns[field] }, set: { model.setColumn(field, $0) }))
                }
                BBSelect(label: L10n.lookup(italian: "Formato delle date"),
                         options: [(ImportDateOrder.ymd, L10n.lookup(italian: "Anno, mese, giorno (2026-01-31)")),
                                   (.dmy, L10n.lookup(italian: "Giorno, mese, anno (31/01/2026)")),
                                   (.mdy, L10n.lookup(italian: "Mese, giorno, anno (01/31/2026)"))],
                         selection: Binding(get: { mapping.dateOrder }, set: { order in model.updateMapping { $0.dateOrder = order } }))
                BBSelect(label: L10n.lookup(italian: "Separatore dei decimali"),
                         options: [(ImportDecimalSeparator.dot, L10n.lookup(italian: "Punto (1,234.56)")),
                                   (.comma, L10n.lookup(italian: "Virgola (1.234,56)"))],
                         selection: Binding(get: { mapping.decimal }, set: { decimal in model.updateMapping { $0.decimal = decimal } }))
                let typeValues = ImportMappingRules.distinctValues(table, column: mapping.columns[.type])
                if mapping.columns[.type] == nil {
                    BBSelect(label: L10n.lookup(italian: "Senza colonna tipo, ogni riga è un"),
                             options: ImportOperationTypes.all.map { ($0, L10n.lookup(italian: ImportOperationTypes.label($0))) },
                             selection: Binding(get: { mapping.defaultType }, set: { type in model.updateMapping { $0.defaultType = type } }))
                } else if !typeValues.isEmpty {
                    VStack(alignment: .leading, spacing: BBSpacing.space3) {
                        BBText(L10n.lookup(italian: "Cosa significano i valori della colonna tipo"), style: BBTypography.caption, color: .bbMutedForeground)
                        ForEach(typeValues, id: \.self) { value in
                            BBSelect(label: "\"\(value)\"",
                                     options: ImportOperationTypes.typeTargets.map { ($0, L10n.lookup(italian: ImportOperationTypes.label($0))) },
                                     selection: Binding(get: { mapping.typeValues[value.lowercased()] ?? "ignora" },
                                                        set: { target in model.updateMapping { $0.typeValues[value.lowercased()] = target } }))
                        }
                    }
                    .padding(BBSpacing.space3)
                    .overlay(RoundedRectangle.bb(BBRadius.lg).strokeBorder(Color.bbBorder))
                }
            }
        }
    }
}

/// Strumenti (INV-099): what each instrument of the file was matched to and what to do; attention first.
struct BrokerInstrumentsStep: View {
    let model: BrokerImportModel
    let currency: String
    let suggestions: [Instrument]

    var body: some View {
        let identities = model.identities
        if identities.isEmpty {
            BBText(L10n.lookup(italian: "Questo file contiene solo movimenti del conto: non ci sono strumenti da abbinare. Vai avanti per importarli tutti."),
                   style: BBTypography.body, color: .bbMutedForeground)
        } else {
            let included = model.included.count
            let missing = identities.filter { ImportChoices.attentionRank(model.choices[$0.identity.key]) == 0 && !model.excluded.contains($0.identity.key) }.count
            let toCheck = identities.filter { ImportChoices.attentionRank(model.choices[$0.identity.key]) == 1 }.count
            let sorted = model.order.compactMap { key in identities.first { $0.identity.key == key } }
            VStack(alignment: .leading, spacing: BBSpacing.space4) {
                (Text("\(included)").fontWeight(.medium).foregroundStyle(Color.bbForeground)
                 + Text(" \(L10n.lookup(italian: "su")) \(identities.count) \(L10n.lookup(italian: identities.count == 1 ? "titolo" : "titoli")) \(L10n.lookup(italian: "pronti da importare."))"
                        + (missing > 0 ? L10n.lookup(italian: " {0} non {1}: cercali oppure lasciali fuori, e le loro operazioni non verranno importate.",
                                                     ["0": String(missing), "1": L10n.lookup(italian: missing == 1 ? "è stato trovato" : "sono stati trovati")]) : "")
                        + (toCheck > 0 ? " \(toCheck) \(L10n.lookup(italian: toCheck == 1 ? "è da controllare" : "sono da controllare"))." : "")
                        + " " + L10n.lookup(italian: "I titoli nuovi si aggiungono ai tuoi strumenti.")))
                    .font(BBTypography.body.font)
                    .foregroundStyle(Color.bbMutedForeground)
                VStack(spacing: 0) {
                    ForEach(Array((sorted.isEmpty ? identities : sorted).enumerated()), id: \.element.id) { i, identity in
                        if i > 0 { BBSeparator() }
                        InstrumentChoiceRow(model: model, identity: identity, currency: currency, suggestions: suggestions)
                    }
                }
            }
        }
    }
}

private struct InstrumentChoiceRow: View {
    let model: BrokerImportModel
    let identity: ImportIdentityCount
    let currency: String
    let suggestions: [Instrument]
    @State private var changing = false

    var body: some View {
        let key = identity.identity.key
        let choice = model.choices[key]
        let status = ImportChoices.describe(choice)
        let usable = choice?.isUsable == true
        let included = usable && !model.excluded.contains(key)
        let attention = status.tone == .missing || status.tone == .check
        let (icon, color): (BBIcon, Color) = switch status.tone {
        case .ready: (.circleCheck, .bbPos)
        case .manual: (.pencilLine, .bbSwatchIndigo)
        case .check: (.circleQuestionMark, .bbSwatchAmber)
        case .missing: (.circleAlert, .bbDestructive)
        }
        HStack(alignment: .top, spacing: BBSpacing.space3) {
            BBCheckbox(isOn: Binding(get: { included }, set: { model.setExcluded(key, !$0) }),
                       accessibilityLabel: L10n.lookup(italian: "Importa {0}", ["0": ImportNormalize.identityLabel(identity.identity)]), isDisabled: !usable)
                .padding(.top, 4)
            VStack(alignment: .leading, spacing: BBSpacing.space2) {
                HStack(alignment: .firstTextBaseline, spacing: BBSpacing.space3) {
                    BBText(identity.identity.name ?? identity.identity.symbol ?? identity.identity.isin ?? "", style: BBTypography.bodyStrong, lineLimit: 1)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    BBText("\(identity.count) \(L10n.lookup(italian: identity.count == 1 ? "operazione" : "operazioni"))", style: BBTypography.caption,
                           color: .bbMutedForeground)
                }
                if identity.identity.name != nil {
                    Text([identity.identity.symbol, identity.identity.isin].compactMap { $0 }.joined(separator: " · "))
                        .font(.system(size: 12, design: .monospaced)).foregroundStyle(Color.bbMutedForeground)
                }
                HStack(alignment: .top, spacing: BBSpacing.space2) {
                    BBIconBadge(icon: icon, color: color, diameter: 20, iconSize: 12)
                    (Text(L10n.lookup(italian: status.title)).fontWeight(.medium).foregroundStyle(Color.bbForeground)
                     + Text(" · " + L10n.lookup(italian: status.text)).foregroundStyle(Color.bbMutedForeground))
                        .font(BBTypography.body.font)
                }
                if let chosen = chosenName(choice) {
                    (Text(chosen.name).foregroundStyle(Color.bbForeground) + Text(chosen.detail.map { " · " + $0 } ?? "").foregroundStyle(Color.bbMutedForeground))
                        .font(BBTypography.body.font)
                        .padding(.leading, 28)
                }
                Group {
                    if attention || changing {
                        InstrumentPickerField(instrument: nil, suggestions: suggestions, currency: identity.identity.currency ?? currency,
                                              placeholder: usable ? "Scegli un altro strumento…" : "Cerca lo strumento…") { instrument in
                            model.choose(key, instrument: instrument)
                            changing = false
                        }
                    } else {
                        BBButton(L10n.lookup(italian: "Non è questo? Cambia strumento"), variant: .ghost, size: .sm) { changing = true }
                    }
                }
                .padding(.leading, 28)
            }
        }
        .padding(.vertical, BBSpacing.space4)
        .opacity(included ? 1 : 0.7)
    }

    private func chosenName(_ choice: InstrumentChoice?) -> (name: String, detail: String?)? {
        switch choice {
        case .known(let instrument): (instrument.name, instrument.isin)
        case let .create(_, label, detail, type, _, _): (label, "\(detail) · \(L10n.lookup(italian: ImportChoices.typeLabel(type)))")
        default: nil
        }
    }
}

/// Conferma (INV-100…102): what will happen, then what happened and where to find the data.
struct BrokerSummaryStep: View {
    let model: BrokerImportModel
    let onManage: () -> Void
    let onNavigate: (String) -> Void

    var body: some View {
        if let result = model.result {
            if model.done { done(result) } else { preview(result) }
        }
    }

    private func count(_ n: Int, _ one: String, _ many: String) -> String {
        n == 1 ? "1 \(L10n.lookup(italian: one))" : "\(n) \(L10n.lookup(italian: many))"
    }

    private func fact(_ text: Text) -> some View {
        HStack(alignment: .top, spacing: BBSpacing.space2) {
            BBIconView(.check, size: .md, color: .bbPos).padding(.top, 2)
            text.font(BBTypography.body.font).foregroundStyle(Color.bbMutedForeground)
        }
    }

    @ViewBuilder private func done(_ result: ImportRunResult) -> some View {
        VStack(spacing: BBSpacing.space2) {
            BBIconView(.circleCheck, points: 40, color: .bbPos)
            BBText(String(result.inserted), style: BBTypography.amountLarge).monospacedDigit()
            BBText(L10n.lookup(italian: result.inserted == 1 ? "operazione importata" : "operazioni importate"), style: BBTypography.body, color: .bbMutedForeground)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, BBSpacing.space4)
        ImportDialogSection(title: L10n.lookup(italian: "Cosa è successo")) {
            VStack(alignment: .leading, spacing: BBSpacing.space1_5) {
                if let r = result.replacement {
                    fact(Text("\(count(r.statements, "rendiconto precedente sostituito", "rendiconti precedenti sostituiti")) (\(r.operations) \(L10n.lookup(italian: "operazioni, dal")) \(r.from) \(L10n.lookup(italian: "al")) \(r.to))."))
                }
                if result.instrumentsCreated > 0 {
                    fact(Text("\(count(result.instrumentsCreated, "strumento nuovo aggiunto", "strumenti nuovi aggiunti")) \(L10n.lookup(italian: "ai tuoi strumenti."))"))
                }
                if result.counts.duplicate > 0 {
                    fact(Text(count(result.counts.duplicate, "operazione era già presente ed è stata saltata", "operazioni erano già presenti e sono state saltate")
                              + L10n.lookup(italian: ": nessun doppione.")))
                }
                if model.statement != nil {
                    fact(Text(L10n.lookup(italian: "I dati originali del file sono conservati, così puoi sostituirli o cancellarli da «Gestisci importazioni».")))
                }
            }
        }
        ImportDialogSection(title: L10n.lookup(italian: "Cosa fare ora")) {
            VStack(alignment: .leading, spacing: BBSpacing.space1_5) {
                InlineLinkText(parts: [.init(text: L10n.lookup(italian: "Trovi le operazioni in") + " "),
                                       .init(text: L10n.lookup(italian: "Investimenti → Operazioni")) { onNavigate("/investimenti/operazioni") },
                                       .init(text: ".")])
                if model.cashCount > 0 {
                    InlineLinkText(parts: [.init(text: L10n.lookup(italian: "I movimenti del conto sono in") + " "),
                                           .init(text: L10n.lookup(italian: "Liquidità → Movimenti")) { onNavigate("/liquidita") },
                                           .init(text: L10n.lookup(italian: ", da categorizzare."))])
                }
                if model.statement != nil {
                    InlineLinkText(parts: [.init(text: L10n.lookup(italian: "Il file è nella lista delle importazioni: da") + " "),
                                           .init(text: L10n.lookup(italian: "Gestisci importazioni"), action: onManage),
                                           .init(text: " " + L10n.lookup(italian: "puoi vederlo, sostituirlo o cancellarlo."))])
                }
                BBText(L10n.lookup(italian: "I prezzi storici si scaricano in background: il grafico si completa entro qualche minuto."), style: BBTypography.body,
                       color: .bbMutedForeground)
            }
        }
    }

    @ViewBuilder private func preview(_ result: ImportRunResult) -> some View {
        let errors = result.rows.filter { $0.status == "error" }
        let rows = model.rows
        let discarded = rows.filter { !$0.isOk }.count
        let freeShares = rows.filter { $0.operation?.price == 0 && $0.operation?.type == "acquisto" }.count
        ImportDialogSection {
            if errors.isEmpty {
                PreviewNumbers(items: [(result.counts.new, result.counts.new == 1 ? "operazione da importare" : "operazioni da importare"),
                                       (result.counts.duplicate, "già presenti, saltate"),
                                       (model.newInstruments, model.newInstruments == 1 ? "strumento nuovo" : "strumenti nuovi")])
            }
            if result.counts.new == 0 && errors.isEmpty {
                ImportNotice(tone: .info, title: "Non c'è niente di nuovo da importare") {
                    BBText(L10n.lookup(italian: "Tutte le operazioni di questo file sono già presenti: puoi caricarlo di nuovo senza creare doppioni."),
                           style: BBTypography.body, color: .bbMutedForeground)
                }
            }
            if let r = result.replacement {
                ImportNotice(tone: .info, title: L10n.lookup(italian: "Sostituisco {0} ({1} operazioni)",
                                                             ["0": count(r.statements, "rendiconto", "rendiconti"), "1": String(r.operations)])) {
                    BBText("\(L10n.lookup(italian: "Il nuovo file copre il periodo")) \(r.from) – \(r.to) \(L10n.lookup(italian: "e prende il posto di quello che c'era. I periodi fuori da questo intervallo restano invariati. Se un controllo fallisce, non viene sostituito nulla."))",
                           style: BBTypography.body, color: .bbMutedForeground)
                }
            }
            VStack(alignment: .leading, spacing: BBSpacing.space1_5) {
                if result.counts.duplicate > 0 {
                    fact(Text(L10n.lookup(italian: "Le operazioni già presenti vengono saltate: puoi reimportare lo stesso file senza creare doppioni.")))
                }
                if freeShares > 0 {
                    fact(Text("\(count(freeShares, "acquisto a prezzo zero", "acquisti a prezzo zero")) \(L10n.lookup(italian: "(quote ricevute gratis, per esempio staking): abbassano il prezzo medio."))"))
                }
                if discarded > 0 {
                    fact(Text(count(discarded, "riga del file non viene importata", "righe del file non vengono importate") + L10n.lookup(italian: ": le hai viste nell'anteprima.")))
                }
            }
        }
        if !errors.isEmpty {
            ImportDialogSection(title: errors.count == 1 ? L10n.lookup(italian: "1 riga da correggere") : L10n.lookup(italian: "{0} righe da correggere", ["0": String(errors.count)]),
                                description: L10n.lookup(italian: "Finché ci sono errori non importo nulla, così non resta un import a metà.")) {
                VStack(alignment: .leading, spacing: BBSpacing.space3) {
                    ForEach(Array(errors.prefix(5).enumerated()), id: \.offset) { _, row in
                        let e = ImportMessages.explainRow(row.message ?? "Riga non valida")
                        ImportNotice(tone: .error, title: L10n.lookup(italian: "Riga {0}: {1}", ["0": String(row.line), "1": L10n.lookup(italian: e.text)]),
                                     hint: e.hint, detail: row.message)
                    }
                    if errors.count > 5 {
                        BBText("\(L10n.lookup(italian: "…e altre")) \(errors.count - 5) \(L10n.lookup(italian: "righe."))", style: BBTypography.body, color: .bbMutedForeground)
                    }
                    BBText(L10n.lookup(italian: "Correggi il file e ricaricalo, oppure torna indietro ed escludi lo strumento interessato."), style: BBTypography.body,
                           color: .bbMutedForeground)
                }
            }
        }
    }
}
