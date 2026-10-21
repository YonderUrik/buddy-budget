import BuddyBudgetKit
import SwiftUI

/// «Righe da controllare» (IMP-034…048): reasons, the three ways out and every row by outcome. Nothing is saved
/// until the user chooses. Twin of `ImportReviewView` on Android.
struct ImportReviewView: View {
    let model: ImportsModel
    let job: PersonalImportListing.Job
    let file: PersonalImportReceiptFile
    @State private var preview: PersonalImportPreview?
    @State private var loadError: String?
    @State private var busy: String?
    @State private var actionError: String?
    @State private var confirmSkip = false
    @State private var confirmReanalyze = false
    @State private var help = false
    @Environment(\.bbLocale) private var locale
    @Environment(\.bbHideAmounts) private var hidden

    var body: some View {
        let groups = preview.map { PersonalImportRules.groups($0.records) }
        let errors = groups?.errors.count ?? 0
        let importable = (groups?.cash ?? 0) + (groups?.investments ?? 0)
        let total = preview?.records.count ?? 0
        let rowProblem = errors > 0
        let title = rowProblem ? (errors == 1 ? L10n.lookup(italian: "1 riga da controllare") : L10n.lookup(italian: "{0} righe da controllare", ["0": String(errors)]))
            : L10n.lookup(italian: "Non siamo riusciti a importare il file")
        VStack(alignment: .leading, spacing: BBSpacing.space5) {
            HStack(alignment: .top, spacing: BBSpacing.space3) {
                BBIconView(.triangleAlert, size: .xl, color: .bbSwatchAmber).padding(.top, 2)
                VStack(alignment: .leading, spacing: BBSpacing.space1) {
                    BBText(preview == nil && loadError == nil ? L10n.lookup(italian: "Controllo le righe…") : title, style: BBTextStyle.sectionHeading)
                        .accessibilityAddTraits(.isHeader)
                    BBText(preview == nil && loadError == nil ? L10n.lookup(italian: "Un attimo: leggo l'esito dell'analisi.")
                           : rowProblem ? L10n.lookup(italian: "Su {0} righe lette, {1} sono pronte e {2} non le ho capite. Non ho salvato nulla: scegli tu cosa fare.",
                                                      ["0": String(total), "1": String(importable), "2": String(errors)])
                           : (job.error ?? L10n.lookup(italian: "Puoi riprovare con un altro file, oppure aprire il dettaglio dalla lista.")),
                           style: BBTypography.body, color: .bbMutedForeground)
                    ReportErrorLink(area: .importMovimenti, error: job.error ?? title)
                }
            }
            ImportFileRow(name: file.name, detail: ([file.source] + (file.size.map { [PersonalImportRules.sizeText($0, locale)] } ?? [])
                                                    + (total > 0 ? [L10n.lookup(italian: "{0} righe lette", ["0": String(total)])] : [])).joined(separator: " · "))
            if let loadError { BBText(loadError, style: BBTypography.body, color: .bbDestructive) }
            if let preview, let groups {
                VStack(alignment: .leading, spacing: BBSpacing.space2) {
                    BBText(L10n.lookup(italian: "Cosa puoi fare"), style: BBTypography.bodyStrong)
                    if rowProblem && importable > 0 {
                        BBButton(importable == 1 ? L10n.lookup(italian: "Importa la riga riconosciuta")
                                 : L10n.lookup(italian: "Importa le {0} righe riconosciute", ["0": String(importable)]),
                                 icon: .listChecks, size: .touch, fullWidth: true, isLoading: busy == "skip", isDisabled: busy != nil) { confirmSkip = true }
                    }
                    BBButton(busy == "reanalyze" ? L10n.lookup(italian: "Rianalizzo…") : L10n.lookup(italian: "Rianalizza con l'AI"), icon: .wandSparkles,
                             variant: rowProblem && importable > 0 ? .outline : .default, size: .touch, fullWidth: true,
                             isLoading: busy == "reanalyze", isDisabled: busy != nil) { confirmReanalyze = true }
                    BBButton(L10n.lookup(italian: "Carica un file corretto"), icon: .upload, variant: .ghost, size: .touch, fullWidth: true,
                             isDisabled: busy != nil) { model.anotherFile() }
                    if let actionError { ErrorWithReport(area: .importMovimenti, error: actionError) }
                }
                if rowProblem {
                    PanelSection(title: L10n.lookup(italian: "Cosa non va"), icon: .triangleAlert, color: .bbSwatchAmber,
                                 description: L10n.lookup(italian: "Il numero è la riga del file originale (l'intestazione è la riga 1). Apri il file, cerca la riga e confronta con il motivo."),
                                 action: { EmptyView() }) {
                        VStack(alignment: .leading, spacing: 0) {
                            ForEach(Array(PersonalImportRules.errorsByReason(groups.errors).enumerated()), id: \.element.id) { index, group in
                                if index > 0 { BBSeparator() }
                                ReasonGroupView(group: group, hidden: hidden)
                            }
                        }
                    }
                }
                ImportRowsView(preview: preview, groups: groups)
                DisclosureBox(title: L10n.lookup(italian: "Perché succede e come correggere"), isOpen: $help, boxed: false, icon: .sparkles) {
                    ForEach(["Il formato del file viene ricavato dall'AI alla prima lettura: a volte sbaglia su righe insolite (note, totali, movimenti di tipo raro). Se le righe segnalate ti sembrano normali, «Rianalizza con l'AI» di solito basta.",
                             "Se il motivo parla di data o importo, controlla che nel file siano scritti come nelle altre righe (stesso separatore decimale, stessa forma della data).",
                             "Se poche righe non ti servono, importa le altre: le righe saltate non entrano nei conti e potrai aggiungerle a mano o ricaricarle corrette."], id: \.self) { line in
                        HStack(alignment: .firstTextBaseline, spacing: BBSpacing.space2) {
                            BBText("•", style: BBTypography.body, color: .bbMutedForeground)
                            BBText(L10n.lookup(italian: line), style: BBTypography.body, color: .bbMutedForeground)
                        }
                    }
                }
            }
        }
        .padding(BBSpacing.space4)
        .overlay(RoundedRectangle.bb(BBRadius.xl).strokeBorder(Color.bbBorder))
        .task(id: job.id) {
            do {
                preview = try await model.preview(job.id)
                #if DEBUG
                // `-BBReviewAction reanalyze|skip`: runs a review action without taps (simulator E2E).
                switch DebugLaunch.value("-BBReviewAction") {
                case "reanalyze": run("reanalyze") { await model.reanalyze(job.id, file: file) }
                case "skip": run("skip") { await model.importSkipping(job.id) }
                default: break
                }
                #endif
            } catch {
                loadError = ImportAPIFailure(error).message ?? L10n.lookup(italian: "Anteprima non disponibile")
            }
        }
        .bbAlertSheet(isPresented: $confirmSkip, title: L10n.lookup(italian: "Importare saltando {0} righe?", ["0": String(errors)]),
                      description: L10n.lookup(italian: "Salvo le {0} righe riconosciute e salto le altre {1}: non entrano nei conti. Potrai correggerle nel file e ricaricarlo più avanti, senza doppioni. Il formato resta salvato per i prossimi file.",
                                               ["0": String(importable), "1": String(errors)]),
                      confirmLabel: L10n.lookup(italian: "Importa e salta"), confirmVariant: .default) {
            run("skip") { await model.importSkipping(job.id) }
        }
        .bbAlertSheet(isPresented: $confirmReanalyze, title: L10n.lookup(italian: "Rianalizzare il file con l'AI?"),
                      description: L10n.lookup(italian: "Il file viene letto di nuovo dal modello AI, come al primo caricamento, per ricavare un formato migliore. Non devi ricaricarlo e non salvo nulla finché i controlli non passano. Utile se le righe segnalate ti sembrano giuste."),
                      confirmLabel: L10n.lookup(italian: "Rianalizza"), confirmVariant: .default) {
            run("reanalyze") { await model.reanalyze(job.id, file: file) }
        }
    }

    private func run(_ action: String, _ work: @escaping () async -> String?) {
        busy = action
        actionError = nil
        Task {
            actionError = await work()
            busy = nil
        }
    }
}

/// One reason and its rows: file line and original text (hidden with «Nascondi gli importi», IMP-044).
private struct ReasonGroupView: View {
    let group: PersonalImportRules.ErrorReasonGroup
    let hidden: Bool
    @State private var all = false

    var body: some View {
        let rows = all ? group.records : Array(group.records.prefix(PersonalImportRules.reviewRowsPerReason))
        VStack(alignment: .leading, spacing: BBSpacing.space2) {
            (Text(L10n.lookup(italian: group.reason)).foregroundStyle(Color.bbForeground).font(BBTypography.bodyStrong.font)
             + Text("  " + (group.records.count == 1 ? L10n.lookup(italian: "1 riga") : L10n.lookup(italian: "{0} righe", ["0": String(group.records.count)])))
                .foregroundStyle(Color.bbMutedForeground).font(BBTypography.body.font))
            ForEach(rows) { record in
                HStack(alignment: .top, spacing: BBSpacing.space2) {
                    BBText(L10n.lookup(italian: "Riga {0}", ["0": String(PersonalImportRules.sourceLine(record))]), style: BBTypography.caption,
                           color: .bbMutedForeground)
                        .monospacedDigit()
                        .frame(width: 68, alignment: .leading)
                    let text = PersonalImportRules.sourceText(record)
                    Text(hidden ? L10n.lookup(italian: "(nascosta)") : text.isEmpty ? L10n.lookup(italian: "(riga vuota)") : text)
                        .font(.system(size: 11, design: .monospaced))
                        .foregroundStyle(hidden ? Color.bbMutedForeground : Color.bbForeground)
                        .textSelection(.enabled)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(RoundedRectangle.bb(BBRadius.md).fill(Color.bbAlphaMuted60))
                }
            }
            if group.records.count > PersonalImportRules.reviewRowsPerReason && !all {
                Button { all = true } label: {
                    BBText(L10n.lookup(italian: "Mostra tutte le {0} righe", ["0": String(group.records.count)]), style: BBTypography.caption.with(weight: 500),
                           color: .bbPrimary)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.vertical, BBSpacing.space3)
    }
}

/// «Tutte le righe» (IMP-045…047): tabs by outcome, 25 rows per page, tap to see the original columns.
struct ImportRowsView: View {
    let preview: PersonalImportPreview
    let groups: PersonalImportRules.PreviewGroups
    @State private var tab: PersonalImportRules.PreviewTab?
    @State private var shown = PersonalImportRules.rowsPageSize
    @Environment(\.bbHideAmounts) private var hidden

    var body: some View {
        let current = tab ?? groups.defaultTab
        let rows = groups.records(current)
        PanelSection(title: L10n.lookup(italian: "Tutte le righe"), icon: .searchCheck, color: .bbSwatchSlate,
                     description: L10n.lookup(italian: "{0} righe lette: {1} movimenti, {2} operazioni, {3} escluse. Non salvo nulla finché non scegli.",
                                              ["0": String(preview.records.count), "1": String(groups.cash), "2": String(groups.investments),
                                               "3": String(groups.ignored.count)]),
                     action: { EmptyView() }) {
            if hidden {
                BBText(L10n.lookup(italian: "Disattiva «Nascondi gli importi» per consultare il dettaglio."), style: BBTypography.body, color: .bbMutedForeground)
            } else {
                VStack(alignment: .leading, spacing: BBSpacing.space4) {
                    ScrollableSegmentedControl(options: groups.tabs.map { ($0, label($0)) },
                                               selection: Binding(get: { current }, set: { tab = $0; shown = PersonalImportRules.rowsPageSize }),
                                               accessibilityLabel: L10n.lookup(italian: "Righe per esito"))
                    if rows.isEmpty {
                        BBText(L10n.lookup(italian: "Nessuna riga in questa scheda."), style: BBTypography.body, color: .bbMutedForeground)
                    } else {
                        VStack(spacing: 0) {
                            ForEach(Array(rows.prefix(shown).enumerated()), id: \.element.id) { index, record in
                                if index > 0 { BBSeparator() }
                                PreviewRecordRow(record: record, headers: preview.headers, currency: preview.currency)
                            }
                        }
                    }
                    if rows.count > shown {
                        HStack {
                            BBText("1–\(shown) \(L10n.lookup(italian: "di")) \(rows.count)", style: BBTypography.caption, color: .bbMutedForeground)
                            Spacer()
                            BBButton(L10n.lookup(italian: "Mostra altre"), variant: .outline, size: .sm) { shown += PersonalImportRules.rowsPageSize }
                        }
                    }
                }
            }
        }
    }

    private func label(_ tab: PersonalImportRules.PreviewTab) -> String {
        switch tab {
        case .importable: L10n.lookup(italian: "Da importare · {0}", ["0": String(groups.importable.count)])
        case .ignored: L10n.lookup(italian: "Escluse · {0}", ["0": String(groups.ignored.count)])
        case .errors: L10n.lookup(italian: "Errori · {0}", ["0": String(groups.errors.count)])
        }
    }
}

private struct PreviewRecordRow: View {
    let record: PersonalImportPreview.Record
    let headers: [String]
    let currency: String
    @State private var open = false
    @Environment(\.bbLocale) private var locale

    var body: some View {
        let s = PersonalImportRules.rowSummary(record)
        VStack(alignment: .leading, spacing: BBSpacing.space2) {
            Button { open.toggle() } label: {
                HStack(alignment: .firstTextBaseline, spacing: BBSpacing.space3) {
                    BBText(s.date.map { BBFormat.formatShortDate($0, locale: locale) } ?? "", style: BBTypography.caption, color: .bbMutedForeground)
                        .frame(width: 52, alignment: .leading)
                    VStack(alignment: .leading, spacing: 0) {
                        BBText(L10n.lookup(italian: s.title), style: BBTypography.bodyStrong, lineLimit: 1)
                        BBText(subtitle(s), style: BBTypography.caption, color: .bbMutedForeground, lineLimit: 1)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    if let amount = s.amount, let cur = s.currency {
                        BBText(BBFormat.formatCurrency(amount, currency: cur, locale: locale), style: BBTypography.bodyStrong,
                               color: s.positive && s.kind != nil ? .bbPos : .bbForeground)
                            .monospacedDigit()
                    }
                }
                .frame(minHeight: 44)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            if open {
                VStack(alignment: .leading, spacing: BBSpacing.space1) {
                    ForEach(Array(record.source.enumerated()), id: \.offset) { i, value in
                        (Text((i < headers.count ? headers[i] : L10n.lookup(italian: "Colonna {0}", ["0": String(i + 1)])) + ": ").fontWeight(.medium)
                         + Text(value))
                            .font(BBTypography.caption.font)
                            .foregroundStyle(Color.bbMutedForeground)
                            .textSelection(.enabled)
                    }
                    if let rate = record.rate {
                        BBText(L10n.lookup(italian: "Cambio verso") + " " + currency + ": " + ImportXlsx.jsToString(rate), style: BBTypography.caption,
                               color: .bbMutedForeground)
                    }
                }
                .padding(.leading, 64)
            }
        }
        .padding(.vertical, BBSpacing.space2_5)
    }

    private func subtitle(_ s: PersonalImportRules.RowSummary) -> String {
        let line = L10n.lookup(italian: "riga {0}", ["0": String(s.line)])
        guard let kind = s.kind else { return L10n.lookup(italian: "Riga {0}", ["0": String(s.line)]) }
        var text = L10n.lookup(italian: kind)
        if let q = s.quantity, let p = s.price {
            text += L10n.lookup(italian: " · {0} × {1} {2}", ["0": ImportXlsx.jsToString(q), "1": ImportXlsx.jsToString(p), "2": s.currency ?? ""])
        }
        return text + " · " + line
    }
}
