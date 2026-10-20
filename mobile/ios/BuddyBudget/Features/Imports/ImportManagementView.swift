import BuddyBudgetKit
import SwiftUI

/// «Importazioni» dialog from «Importazioni fatte» (07-investments §9, INV-106…110): the files uploaded grouped by
/// source, deletion with a confirmation of what goes and what stays (decision 0003), full reset with a typed
/// confirmation. Same fields as `ImportManagementModel` on Android.
@MainActor @Observable
final class ImportManagementModel {
    struct Confirmation: Equatable {
        enum Kind: Equatable { case broker(id: String, ids: [String]), personal(id: String, token: String) }
        let kind: Kind
        let title: String
        let intro: String
        let items: [String]
        let removes: [String]
        let keeps: [String]
        let confirmLabel: String
    }

    private(set) var statements: [BrokerStatementRecord] = []
    private(set) var loading = false
    private(set) var statementsFailed = false
    private(set) var personalFailed = false
    var showAll = false
    var listOpen = false
    var advancedOpen = false
    private(set) var verifying = false
    private(set) var verifyError: String?
    private(set) var deleted = false
    var confirmation: Confirmation?
    private(set) var deleting = false
    private(set) var deleteError: String?
    // Reset (INV-109/110)
    var resetOpen = false
    private(set) var resetPreview: InvestmentResetPreview?
    private(set) var resetPreviewLoading = false
    private(set) var resetPreviewError: String?
    var resetText = ""
    private(set) var resetting = false
    private(set) var resetError: String?
    private(set) var resetDone = false

    @ObservationIgnored let env: AppEnvironment
    @ObservationIgnored let imports: ImportsModel
    @ObservationIgnored var onChanged: (() -> Void)?

    init(env: AppEnvironment, imports: ImportsModel) {
        self.env = env
        self.imports = imports
    }

    var history: [ImportHistoryItem] { ImportHistory.build(statements: statements, personal: imports.listing) }

    func load() async {
        loading = true
        deleted = false
        async let personal: Void = imports.load()
        do {
            statements = try await env.brokerImports.statements()
            statementsFailed = false
        } catch {
            statementsFailed = true
        }
        await personal
        personalFailed = imports.listing == nil
        loading = false
    }

    /// INV-107: the statement and every later one of the same account; INV-108: the server's preview + token.
    func requestDelete(_ item: ImportHistoryItem, locale: BBLocale) async {
        deleteError = nil
        deleted = false
        switch item.kind {
        case .broker:
            let affected = ImportHistory.affectedStatements(item.id, in: statements)
            let source = translatedSource(item.source)
            let many = affected.count > 1
            confirmation = Confirmation(
                kind: .broker(id: item.id, ids: affected.map(\.id)),
                title: many ? L10n.lookup(italian: "Eliminare {0} importazioni di {1}?", ["0": String(affected.count), "1": source])
                    : L10n.lookup(italian: "Eliminare l'importazione di {0}?", ["0": source]),
                intro: L10n.lookup(italian: many ? "Insieme a quella scelta vanno tolti i caricamenti successivi dello stesso conto, perché i loro saldi partono da questo."
                                   : "Il rendiconto e le sue operazioni vengono tolti dal portafoglio."),
                items: affected.map { ImportHistory.period(from: $0.statement.from, to: $0.statement.to, timeZone: .current, locale: locale) },
                removes: [L10n.lookup(italian: item.source.hasPrefix("Trade Republic") ? "Le operazioni di questi rendiconti e i movimenti del conto importati con loro"
                                      : "Le operazioni di questi rendiconti"),
                          L10n.lookup(italian: "La liquidità torna all'ultima chiusura conservata, o a zero")],
                keeps: [L10n.lookup(italian: "Strumenti e prezzi storici"), L10n.lookup(italian: "Puoi ripristinare tutto importando di nuovo i file originali")],
                confirmLabel: many ? L10n.lookup(italian: "Elimina {0} importazioni", ["0": String(affected.count)]) : L10n.lookup(italian: "Elimina l'importazione"))
        case .personal:
            verifying = true
            verifyError = nil
            defer { verifying = false }
            do {
                let preview = try await env.personalImports.deletionSummary(item.id)
                confirmation = Confirmation(
                    kind: .personal(id: item.id, token: preview.token),
                    title: L10n.lookup(italian: "Eliminare l'importazione «{0}»?", ["0": preview.name]),
                    intro: L10n.lookup(italian: "I dati caricati con questo formato personale vengono tolti dal tuo patrimonio."),
                    items: preview.uploads.map { L10n.lookup(italian: "Caricamento del {0}", ["0": ImportHistory.date($0.createdAt, timeZone: .current, locale: locale)]) },
                    removes: [L10n.lookup(italian: "{0} movimenti di cassa (inclusi i regolamenti degli investimenti)", ["0": String(preview.cashCount)]),
                              L10n.lookup(italian: "{0} operazioni di investimento", ["0": String(preview.investmentCount)])],
                    keeps: [L10n.lookup(italian: "Il formato personale, i conti e gli strumenti"),
                            L10n.lookup(italian: "Puoi reimportare il CSV quando vuoi: i saldi si aggiornano di nuovo")],
                    confirmLabel: L10n.lookup(italian: "Elimina l'importazione"))
            } catch {
                verifyError = ImportAPIFailure(error).message ?? L10n.lookup(italian: "Operazione non riuscita")
            }
        }
    }

    func confirmDelete() async {
        guard let confirmation else { return }
        deleting = true
        deleteError = nil
        defer { deleting = false }
        do {
            switch confirmation.kind {
            case .broker(let id, let ids): try await env.brokerImports.deleteStatement(id, confirmedIds: ids)
            case .personal(let id, let token): try await env.personalImports.delete(id, token: token)
            }
            self.confirmation = nil
            await load()
            deleted = true
            onChanged?()
        } catch {
            deleteError = ImportAPIFailure(error).message ?? L10n.lookup(italian: "Operazione non riuscita")
        }
    }

    /// INV-109: always a fresh preview right before the confirmation.
    func reviewReset() async {
        resetText = ""
        resetError = nil
        resetPreview = nil
        resetPreviewError = nil
        resetOpen = true
        resetPreviewLoading = true
        defer { resetPreviewLoading = false }
        do {
            resetPreview = try await env.brokerImports.resetPreview()
        } catch {
            resetPreviewError = ImportAPIFailure(error).message ?? L10n.lookup(italian: "Operazione non riuscita")
        }
    }

    var canReset: Bool {
        resetPreview != nil && !resetPreviewLoading && !resetting && resetError == nil && resetText == ImportHistory.resetConfirmation
    }

    func reset() async {
        guard canReset, let preview = resetPreview else { return }
        resetting = true
        defer { resetting = false }
        do {
            try await env.brokerImports.reset(revision: preview.revision)
            resetOpen = false
            resetDone = true
            await load()
            onChanged?()
        } catch {
            resetError = ImportAPIFailure(error).message ?? L10n.lookup(italian: "Operazione non riuscita")
        }
    }

    func translatedSource(_ source: String) -> String {
        if ImportHistory.isIbkrSource(source) {
            return source.replacingOccurrences(of: " · conto …", with: " · \(L10n.lookup(italian: "conto")) …")
        }
        return L10n.lookup(italian: source)
    }
}

struct ImportManagementView: View {
    @Bindable var model: ImportManagementModel
    let onOpenJob: (String) -> Void
    @Environment(\.bbLocale) private var locale

    var body: some View {
        let history = model.history
        VStack(alignment: .leading, spacing: BBSpacing.space4) {
            FormDialogHeader(icon: .database, title: L10n.lookup(italian: "Importazioni"),
                             description: L10n.lookup(italian: "I file che hai caricato. Per aggiornare un periodo importa un file più recente: le operazioni già presenti vengono saltate."),
                             color: .bbSwatchSlate)
            if model.loading && history.isEmpty {
                BBText(L10n.lookup(italian: "Caricamento importazioni…"), style: BBTypography.body, color: .bbMutedForeground)
            }
            if model.statementsFailed { failure("Non riesco a leggere i rendiconti.") }
            if model.personalFailed { failure("Non riesco a leggere i CSV personali.") }
            if !model.loading && !model.statementsFailed && !model.personalFailed && history.isEmpty {
                BBText(L10n.lookup(italian: "Non hai ancora importato nessun file: con «Importa un file» carichi il rendiconto del tuo broker."),
                       style: BBTypography.body, color: .bbMutedForeground)
            }
            if model.verifying { BBText(L10n.lookup(italian: "Verifico cosa verrebbe eliminato…"), style: BBTypography.body, color: .bbMutedForeground) }
            if let error = model.verifyError { BBText(L10n.lookup(italian: error), style: BBTypography.body, color: .bbDestructive) }
            if model.deleted {
                BBText(L10n.lookup(italian: "Importazione eliminata. Saldi e posizioni sono aggiornati."), style: BBTypography.body)
            }
            if model.resetDone {
                BBText(L10n.lookup(italian: "Investimenti azzerati. Ora puoi reimportare i rendiconti completi."), style: BBTypography.body)
            }
            if !history.isEmpty { list(history) }
        }
        .task {
            await model.load()
            #if DEBUG
            // `-BBImportDelete show|confirm`: the deletion confirmation of the newest import (screenshots, E2E cleanup).
            if let mode = DebugLaunch.value("-BBImportDelete"), let first = model.history.first {
                await model.requestDelete(first, locale: locale)
                if mode == "confirm" { await model.confirmDelete() }
            }
            #endif
        }
        .bbSheet(isPresented: Binding(get: { model.confirmation != nil }, set: { if !$0, !model.deleting { model.confirmation = nil } }),
                 title: model.confirmation?.title) {
            if let confirmation = model.confirmation { deleteSheet(confirmation) }
        }
        .bbSheet(isPresented: Binding(get: { model.resetOpen }, set: { if !$0, !model.resetting { model.resetOpen = false } }),
                 title: L10n.lookup(italian: "Azzerare tutto lo storico investimenti?")) {
            resetSheet
        }
    }

    private func failure(_ text: String) -> some View {
        HStack(spacing: BBSpacing.space1) {
            BBText(L10n.lookup(italian: text), style: BBTypography.body, color: .bbDestructive)
            TextLinkButton(L10n.lookup(italian: "Riprova")) { Task { await model.load() } }
        }
    }

    private func summary(_ history: [ImportHistoryItem]) -> String {
        let sources = Set(history.map(\.source)).count
        let files = history.count == 1 ? "1 \(L10n.lookup(italian: "file caricato"))" : "\(history.count) \(L10n.lookup(italian: "file caricati"))"
        let origins = sources == 1 ? L10n.lookup(italian: "1 origine") : L10n.lookup(italian: "{0} origini", ["0": String(sources)])
        return L10n.lookup(italian: "{0} da {1} · ultimo il {2}",
                           ["0": files, "1": origins, "2": ImportHistory.date(history[0].createdAt, timeZone: .current, locale: locale)])
    }

    @ViewBuilder private func list(_ history: [ImportHistoryItem]) -> some View {
        VStack(alignment: .leading, spacing: BBSpacing.space2) {
            Button { withAnimation(.easeOut(duration: 0.2)) { model.listOpen.toggle() } } label: {
                HStack(spacing: BBSpacing.space2) {
                    VStack(alignment: .leading, spacing: 2) {
                        BBText(L10n.lookup(italian: "Vedi e gestisci i file caricati"), style: BBTypography.bodyStrong)
                        BBText(summary(history), style: BBTypography.caption, color: .bbMutedForeground)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    BBIconView(.chevronDown, size: .md, color: .bbMutedForeground).rotationEffect(.degrees(model.listOpen ? 180 : 0))
                }
                .frame(minHeight: BBLayout.minTouchTarget)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            if model.listOpen {
                let groups = ImportHistory.group(model.showAll ? history : Array(history.prefix(ImportHistory.visible)))
                VStack(alignment: .leading, spacing: BBSpacing.space5) {
                    ForEach(groups) { group in
                        VStack(alignment: .leading, spacing: 0) {
                            BBText(model.translatedSource(group.source), style: BBTypography.bodyStrong.with(weight: 600))
                            ForEach(Array(group.items.enumerated()), id: \.element.id) { i, item in
                                if i > 0 { BBSeparator() }
                                historyRow(item)
                            }
                        }
                    }
                    if history.count > ImportHistory.visible {
                        BBButton(model.showAll ? L10n.lookup(italian: "Mostra meno") : L10n.lookup(italian: "Mostra tutte ({0})", ["0": String(history.count)]),
                                 variant: .ghost, size: .sm) { model.showAll.toggle() }
                    }
                    (Text(L10n.lookup(italian: "Annullare un'importazione:") + " ").fontWeight(.medium).foregroundStyle(Color.bbForeground)
                     + Text(L10n.lookup(italian: "«Elimina» toglie le operazioni e i saldi che quel file aveva portato; ti mostro cosa sparisce prima di confermare e puoi sempre reimportare il file."))
                        .foregroundStyle(Color.bbMutedForeground))
                        .font(BBTypography.body.font)
                    DisclosureBox(title: L10n.lookup(italian: "Opzioni avanzate") + " " + L10n.lookup(italian: "· ripartire da zero"),
                                  isOpen: $model.advancedOpen, boxed: false) {
                        VStack(alignment: .leading, spacing: BBSpacing.space2) {
                            BBText(L10n.lookup(italian: "Riparti da zero"), style: BBTypography.bodyStrong.with(weight: 600))
                            BBText(L10n.lookup(italian: "Numeri duplicati dopo un vecchio import? Azzera lo storico investimenti e poi importa nuovamente i CSV completi, dal più vecchio al più recente. Si eliminano anche le operazioni inserite a mano."),
                                   style: BBTypography.body, color: .bbMutedForeground)
                            BBButton(L10n.lookup(italian: "Rimuovi tutti gli import e azzera gli investimenti"), variant: .outline, size: .touch, fullWidth: true) {
                                Task { await model.reviewReset() }
                            }
                        }
                    }
                }
            }
        }
    }

    private func historyRow(_ item: ImportHistoryItem) -> some View {
        let color: Color = switch item.tone {
        case .ok: .bbPos
        case .warning: .bbSwatchAmber
        case .error: .bbDestructive
        case .pending: .bbSwatchIndigo
        }
        let details = item.details.map { d in
            d.count.map { "\($0) \(L10n.lookup(italian: $0 == 1 ? d.one : d.many))" } ?? L10n.lookup(italian: d.one)
        }
        let status = item.warnings.map { "\($0) \(L10n.lookup(italian: $0 == 1 ? "avviso" : "avvisi"))" } ?? L10n.lookup(italian: item.statusLabel)
        let label = L10n.lookup(italian: "{0}{1}, caricato il {2}",
                                ["0": model.translatedSource(item.source),
                                 "1": item.period.map { ", " + ImportHistory.period(from: $0.from, to: $0.to, timeZone: .current, locale: locale) } ?? "",
                                 "2": ImportHistory.date(item.createdAt, timeZone: .current, locale: locale)])
        return VStack(alignment: .leading, spacing: BBSpacing.space2) {
            VStack(alignment: .leading, spacing: 2) {
                BBText(item.period.map { ImportHistory.period(from: $0.from, to: $0.to, timeZone: .current, locale: locale) } ?? L10n.lookup(italian: "File caricato"),
                       style: BBTypography.bodyStrong)
                BBText(([L10n.lookup(italian: "Caricato il") + " " + ImportHistory.date(item.createdAt, timeZone: .current, locale: locale)] + details).joined(separator: " · "),
                       style: BBTypography.caption, color: .bbMutedForeground)
            }
            HStack(spacing: BBSpacing.space3) {
                HStack(spacing: BBSpacing.space1_5) {
                    Circle().fill(color).frame(width: 8, height: 8)
                    BBText(status, style: BBTypography.body, color: .bbMutedForeground)
                }
                Spacer(minLength: 0)
                if item.kind == .personal {
                    Button { onOpenJob(item.id) } label: {
                        BBText(L10n.lookup(italian: "Apri"), style: BBTypography.bodyStrong, color: .bbPrimary).frame(minHeight: BBLayout.minTouchTarget)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(L10n.lookup(italian: "Apri l'importazione: {0}", ["0": label]))
                }
                Button { Task { await model.requestDelete(item, locale: locale) } } label: {
                    BBText(L10n.lookup(italian: "Elimina"), style: BBTypography.bodyStrong, color: .bbDestructive).frame(minHeight: BBLayout.minTouchTarget)
                }
                .buttonStyle(.plain)
                .disabled(model.verifying)
                .accessibilityLabel(L10n.lookup(italian: "Elimina l'importazione: {0}", ["0": label]))
            }
        }
        .padding(.vertical, BBSpacing.space3)
    }

    private func deleteSheet(_ c: ImportManagementModel.Confirmation) -> some View {
        VStack(alignment: .leading, spacing: BBSpacing.space4) {
            BBText(c.intro, style: BBTypography.body, color: .bbMutedForeground)
            VStack(alignment: .leading, spacing: BBSpacing.space1_5) {
                BBText(L10n.lookup(italian: "Viene eliminato"), style: BBTypography.bodyStrong)
                ForEach(c.items, id: \.self) { BBText($0, style: BBTypography.bodyStrong) }
                ForEach(c.removes, id: \.self) { BBText($0, style: BBTypography.body, color: .bbMutedForeground) }
            }
            VStack(alignment: .leading, spacing: BBSpacing.space1_5) {
                BBText(L10n.lookup(italian: "Resta com'è"), style: BBTypography.bodyStrong)
                ForEach(c.keeps, id: \.self) { BBText($0, style: BBTypography.body, color: .bbMutedForeground) }
            }
            if let error = model.deleteError { BBText(L10n.lookup(italian: error), style: BBTypography.body, color: .bbDestructive) }
            VStack(spacing: BBSpacing.space2) {
                BBButton(model.deleting ? L10n.lookup(italian: "Eliminazione…") : c.confirmLabel, variant: .destructive, size: .touch, fullWidth: true,
                         isLoading: model.deleting, isDisabled: model.deleting) { Task { await model.confirmDelete() } }
                BBButton(L10n.cancel, variant: .ghost, size: .touch, fullWidth: true, isDisabled: model.deleting) { model.confirmation = nil }
            }
        }
    }

    private var resetSheet: some View {
        VStack(alignment: .leading, spacing: BBSpacing.space3) {
            BBText(L10n.lookup(italian: "I vecchi import non sono distinguibili dalle operazioni manuali. Questa azione elimina tutte le operazioni di investimento, anche quelle inserite a mano, tutti i rendiconti e i prezzi personali, inclusi i movimenti del conto importati da Trade Republic. Cancella lo storico del valore degli investimenti e azzera la liquidità dei conti collegati agli import. Non è annullabile: per ripristinare i dati servono i CSV originali."),
                   style: BBTypography.body, color: .bbMutedForeground)
            BBText(L10n.lookup(italian: "Conti bancari e relativi movimenti, budget, debiti e pensioni restano invariati. Portafogli, strumenti e impostazioni restano disponibili."),
                   style: BBTypography.body)
            if model.resetPreviewLoading { BBText(L10n.lookup(italian: "Preparazione del riepilogo…"), style: BBTypography.body, color: .bbMutedForeground) }
            if let error = model.resetPreviewError { BBText(L10n.lookup(italian: error), style: BBTypography.body, color: .bbDestructive) }
            if let p = model.resetPreview {
                VStack(alignment: .leading, spacing: BBSpacing.space1) {
                    BBText("\(p.operations) \(L10n.lookup(italian: "operazioni da eliminare (")) \(p.untrackedOperations) \(L10n.lookup(italian: "senza origine tracciata, incluse eventuali operazioni manuali)"))",
                           style: BBTypography.body)
                    BBText("\(p.statements) \(L10n.lookup(italian: "rendiconti da eliminare"))", style: BBTypography.body)
                    BBText("\(p.prices) \(L10n.lookup(italian: "prezzi personali da eliminare"))", style: BBTypography.body)
                    BBText("\(p.cashAccounts) \(L10n.lookup(italian: "conti di liquidità broker da azzerare"))", style: BBTypography.body)
                }
                (Text(L10n.lookup(italian: "Per confermare scrivi") + " ") + Text(ImportHistory.resetConfirmation).fontWeight(.semibold))
                    .font(BBTypography.body.font).foregroundStyle(Color.bbForeground)
                BBTextField(text: $model.resetText, isDisabled: model.resetting, height: BBLayout.minTouchTarget)
            }
            if let error = model.resetError { BBText(L10n.lookup(italian: error), style: BBTypography.body, color: .bbDestructive) }
            if model.resetPreviewError != nil || model.resetError != nil {
                BBButton(L10n.lookup(italian: "Aggiorna riepilogo"), variant: .outline, size: .touch, fullWidth: true) { Task { await model.reviewReset() } }
            }
            VStack(spacing: BBSpacing.space2) {
                BBButton(model.resetting ? L10n.lookup(italian: "Azzeramento…") : L10n.lookup(italian: "Azzera definitivamente gli investimenti"),
                         variant: .destructive, size: .touch, fullWidth: true, isLoading: model.resetting, isDisabled: !model.canReset) {
                    Task { await model.reset() }
                }
                BBButton(L10n.cancel, variant: .ghost, size: .touch, fullWidth: true, isDisabled: model.resetting) { model.resetOpen = false }
            }
        }
    }
}
