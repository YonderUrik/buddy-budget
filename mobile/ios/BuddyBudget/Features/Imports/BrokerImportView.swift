import BuddyBudgetKit
import SwiftUI

/// «Importa operazioni» full-screen dialog (07-investments §8, INV-092…105). State in `BrokerImportModel`.
/// Twin of `BrokerImportView` on Android.
struct BrokerImportView: View {
    @Bindable var model: BrokerImportModel
    let currency: String
    let suggestions: [Instrument]
    let onOpenImports: (String?) -> Void
    let onManage: () -> Void
    let onNavigate: (String) -> Void
    @State private var picking = false

    var body: some View {
        VStack(alignment: .leading, spacing: BBSpacing.space5) {
            FormDialogHeader(icon: .upload, title: L10n.lookup(italian: "Importa operazioni"),
                             description: L10n.lookup(italian: "Carica il file del tuo broker: lo leggo, ti mostro cosa importerei e importo solo quando confermi."))
            ForEach(model.fallbackJobs, id: \.id) { job in
                InlineLinkText(parts: [.init(text: "\(job.name): \(L10n.lookup(italian: "Analisi AI avviata")) · "),
                                       .init(text: L10n.lookup(italian: "Segui l'analisi")) { onOpenImports(job.id) }], color: .bbForeground)
            }
            if model.batchFinished {
                BBText("\(L10n.lookup(italian: "Tutti i")) \(model.batch.count) \(L10n.lookup(italian: "file sono stati elaborati. I file già importati sono stati saltati senza creare doppioni."))",
                       style: BBTypography.body)
                BBButton(L10n.lookup(italian: "Chiudi"), size: .touch) { model.close() }
            } else if let jobId = model.fallbackJobId {
                BBText(L10n.lookup(italian: "La lettura standard non è riuscita. L'analisi AI è stata avviata automaticamente; il supporto riceverà il report dell'errore."),
                       style: BBTypography.body)
                TextLinkButton(L10n.lookup(italian: "Segui l'analisi")) { onOpenImports(jobId) }
                BBButton(L10n.lookup(italian: model.isBatch ? "File successivo" : "Chiudi"), size: .touch) { model.finish() }
            } else {
                if model.isBatch { batchProgress }
                if !model.done { stepper }
                if let error = model.error { notice(for: error) }
                switch model.step {
                case .file: fileStep
                case .mapping:
                    if model.statement != nil { BrokerStatementStep(model: model) } else { BrokerMappingStep(model: model) }
                case .instruments: BrokerInstrumentsStep(model: model, currency: currency, suggestions: suggestions)
                case .summary: BrokerSummaryStep(model: model, onManage: onManage, onNavigate: onNavigate)
                }
                if model.reading || model.resolving || model.running || model.loadingFiles {
                    VStack(alignment: .leading, spacing: BBSpacing.space2) {
                        ProgressBar(state: .indeterminate, label: L10n.lookup(italian: "Elaborazione in corso")).frame(height: 6)
                        ShimmerText(text: L10n.lookup(italian: model.reading || model.loadingFiles ? "Leggo il file…" : model.resolving ? "Cerco gli strumenti…"
                                                      : model.step == .summary ? "Importo le operazioni…" : "Controllo le operazioni…"))
                    }
                }
                actions
            }
        }
        .importFilePicker(isPresented: $picking, multiple: true) { files in Task { await model.pick(files) } }
    }

    private func notice(for error: String) -> some View {
        let explained = ImportMessages.explainFile(error)
        return ImportNotice(tone: .error, title: explained.text, hint: explained.hint, detail: explained.text == error ? nil : error,
                            report: ReportError(area: .importInvestimenti, message: error))
    }

    private var batchProgress: some View {
        VStack(alignment: .leading, spacing: BBSpacing.space2) {
            BBText("\(L10n.lookup(italian: "File")) \(model.batchIndex + 1) \(L10n.lookup(italian: "di")) \(model.batch.count): \(model.batch[min(model.batchIndex, model.batch.count - 1)].name)",
                   style: BBTypography.bodyStrong)
            BBText(L10n.lookup(italian: "Controlla e conferma un rendiconto alla volta: ognuno viene salvato da solo, quindi se ti fermi quelli già completati restano importati."),
                   style: BBTypography.body, color: .bbMutedForeground)
            ForEach(Array(model.batch.enumerated()), id: \.offset) { i, file in
                HStack(spacing: BBSpacing.space2) {
                    if i == model.batchIndex { BBSpinner(size: .md, color: .bbMutedForeground) } else {
                        BBIconView(i < model.batchIndex ? .check : .circleDashed, size: .md, color: i < model.batchIndex ? .bbPos : .bbMutedForeground)
                    }
                    BBText(file.name, style: BBTypography.body, color: .bbMutedForeground, lineLimit: 1)
                }
                .accessibilityElement(children: .combine)
                .accessibilityValue(L10n.lookup(italian: i < model.batchIndex ? "elaborato" : i == model.batchIndex ? "in corso" : "in attesa"))
            }
        }
    }

    private var stepper: some View {
        let steps = BrokerImportModel.Step.allCases
        return VStack(alignment: .leading, spacing: BBSpacing.space2) {
            BBText("\(L10n.lookup(italian: "Passo")) \(model.step.rawValue + 1) \(L10n.lookup(italian: "di")) \(steps.count) · \(L10n.lookup(italian: model.step.label))",
                   style: BBTypography.bodyStrong)
            HStack(spacing: BBSpacing.space1_5) {
                ForEach(steps, id: \.self) { step in
                    Capsule().fill(step.rawValue <= model.step.rawValue ? Color.bbPrimary : Color.bbBorder).frame(height: 4)
                }
            }
            .accessibilityHidden(true)
            BBText(L10n.lookup(italian: model.step.hint), style: BBTypography.body, color: .bbMutedForeground)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel(L10n.lookup(italian: "Passi dell'import"))
    }

    @ViewBuilder private var fileStep: some View {
        CheckboxRow(isOn: $model.aiFallback,
                    text: L10n.lookup(italian: "Se la lettura fallisce, autorizzo l'analisi AI automatica del file completo tramite OpenRouter, inclusi eventuali dati personali, senza conservazione presso il provider. Dopo i controlli i dati vengono importati automaticamente e il supporto riceve un report tecnico."),
                    isDisabled: model.busy)
        let chosen = model.provider.map(ImportProviders.info)
        FilePickZone(title: model.busy ? L10n.lookup(italian: "Leggo il file…") : L10n.lookup(italian: "Scegli il file del tuo broker"),
                     subtitle: model.busy ? L10n.lookup(italian: "Un attimo")
                         : chosen?.fileLabel.map { L10n.lookup(italian: "Ti serve: {0}.", ["0": $0]) } ?? L10n.lookup(italian: "CSV o Excel"),
                     busy: model.busy) { picking = true }
        if let fileError = model.fileError {
            let explained = ImportMessages.explainFile(fileError)
            ImportNotice(tone: .error, title: explained.text, hint: explained.hint, detail: fileError,
                         report: ReportError(area: .importInvestimenti, message: fileError))
        }
        BBText(L10n.lookup(italian: "Più rendiconti? Selezionali insieme (fino a 20): IBKR, DEGIRO e Trade Republic."), style: BBTypography.body,
               color: .bbMutedForeground)
            .frame(maxWidth: .infinity)
            .multilineTextAlignment(.center)
        BBSeparator()
        Button { withAnimation(.easeOut(duration: 0.2)) { model.showGuide.toggle() } } label: {
            HStack(spacing: BBSpacing.space1_5) {
                BBText(L10n.lookup(italian: "Come ottengo il file?"), style: BBTypography.bodyStrong, color: .bbPrimary)
                BBIconView(.chevronDown, size: .md, color: .bbPrimary).rotationEffect(.degrees(model.showGuide ? 180 : 0))
            }
            .frame(minHeight: BBLayout.minTouchTarget)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        if model.showGuide {
            VStack(spacing: 0) {
                ForEach(Array(ImportProviders.all.enumerated()), id: \.element.id) { index, provider in
                    if index > 0 { BBSeparator() }
                    providerRow(provider)
                }
            }
        }
        InlineLinkText(parts: [.init(text: L10n.lookup(italian: "Il tuo broker non c'è?") + " "),
                               .init(text: L10n.lookup(italian: "Crea il tuo formato")) { onOpenImports(nil) }, .init(text: ".")])
    }

    private func providerRow(_ provider: ImportProviderInfo) -> some View {
        let selected = model.provider == provider.id
        return VStack(alignment: .leading, spacing: 0) {
            Button { model.selectProvider(selected ? nil : provider.id) } label: {
                HStack(spacing: BBSpacing.space3) {
                    BBText(provider.initials, style: BBTextStyle.titleSmall.with(size: 14, lineHeight: 20))
                        .frame(width: 40, height: 40)
                        .background(RoundedRectangle.bb(BBRadius.lg).fill(Color.bbMuted))
                    VStack(alignment: .leading, spacing: 0) {
                        BBText(provider.name, style: BBTypography.bodyStrong)
                        BBText(L10n.lookup(italian: provider.tagline), style: BBTypography.caption, color: .bbMutedForeground)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    ZStack {
                        Circle().strokeBorder(selected ? Color.bbPrimary : Color.bbBorder)
                        if selected {
                            Circle().fill(Color.bbPrimary)
                            BBIconView(.check, points: 12, color: .bbPrimaryForeground)
                        }
                    }
                    .frame(width: 20, height: 20)
                }
                .padding(.vertical, BBSpacing.space2)
                .padding(.horizontal, BBSpacing.space2)
                .frame(minHeight: 56)
                .background(RoundedRectangle.bb(BBRadius.xl).fill(selected ? Color.bbAlphaPrimary5 : Color.clear))
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityAddTraits(selected ? .isSelected : [])
            if selected {
                VStack(alignment: .leading, spacing: BBSpacing.space3) {
                    BBText("\(L10n.lookup(italian: "Come ottenere il file da")) \(provider.name)", style: BBTypography.bodyStrong)
                    ForEach(Array(provider.exportSteps.enumerated()), id: \.offset) { i, step in
                        HStack(alignment: .top, spacing: BBSpacing.space2_5) {
                            BBText(String(i + 1), style: BBTypography.caption.with(weight: 500))
                                .frame(width: 20, height: 20)
                                .background(Circle().fill(Color.bbMuted))
                            BBText(L10n.lookup(italian: step), style: BBTypography.body, color: .bbMutedForeground)
                        }
                    }
                    BBText(L10n.lookup(italian: provider.note), style: BBTypography.body, color: .bbMutedForeground)
                }
                .padding(.horizontal, BBSpacing.space2)
                .padding(.top, BBSpacing.space3)
                .padding(.bottom, BBSpacing.space2)
            }
        }
    }

    @ViewBuilder private var actions: some View {
        if model.done {
            HStack {
                Spacer()
                BBButton(L10n.lookup(italian: model.isBatch ? "File successivo" : "Chiudi"), size: .touch) { model.finish() }
            }
        } else {
            HStack(spacing: BBSpacing.space2) {
                BBButton(L10n.lookup(italian: model.step == .file ? "Annulla" : "Indietro"), variant: .ghost, size: .touch,
                         isDisabled: model.running || (model.isBatch && model.step == .mapping)) {
                    if model.step == .file { model.close() } else { model.back() }
                }
                Spacer(minLength: 0)
                switch model.step {
                case .file: EmptyView()
                case .mapping:
                    BBButton(model.resolving ? L10n.lookup(italian: "Cerco gli strumenti…") : L10n.lookup(italian: "Avanti"), size: .touch,
                             isDisabled: !model.missing.isEmpty || model.validRows == 0 || model.resolving) { Task { await model.goToInstruments() } }
                case .instruments:
                    BBButton(model.running ? L10n.lookup(italian: "Controllo…") : L10n.lookup(italian: "Avanti"), size: .touch,
                             isDisabled: (model.included.isEmpty && model.cashCount == 0) || model.running) { Task { await model.preview() } }
                case .summary:
                    if let result = model.result {
                        let label = model.running ? L10n.lookup(italian: "Importo…")
                            : result.counts.error > 0 ? L10n.lookup(italian: "Correggi le righe per continuare")
                            : result.counts.new == 0 ? L10n.lookup(italian: model.isBatch ? "Già importato · continua" : "Niente di nuovo da importare")
                            : L10n.lookup(italian: "Importa {0} {1}", ["0": String(result.counts.new),
                                                                       "1": L10n.lookup(italian: result.counts.new == 1 ? "operazione" : "operazioni")])
                        BBButton(label, size: .touch, isLoading: model.running,
                                 isDisabled: (result.counts.new == 0 && !model.isBatch) || result.counts.error > 0 || model.running) {
                            if result.counts.new == 0 && model.isBatch { model.nextFile() } else { Task { await model.confirm() } }
                        }
                    }
                }
            }
        }
    }
}

// MARK: - Shared pieces

enum ImportNoticeTone { case error, warning, info }

/// `ImportNotice`: tinted icon, title, explanation, «Cosa fare:» hint, technical detail on request.
struct ImportNotice<Content: View>: View {
    let tone: ImportNoticeTone
    let title: String
    var hint: String?
    var detail: String?
    /// `Segnala questo problema` at the end (web `action`), with the error to attach.
    var report: ReportError?
    @ViewBuilder var content: () -> Content
    @State private var showDetail = false

    var body: some View {
        let color: Color = switch tone {
        case .error: .bbDestructive
        case .warning: .bbSwatchAmber
        case .info: .bbSwatchIndigo
        }
        let icon: BBIcon = switch tone {
        case .error: .circleAlert
        case .warning: .triangleAlert
        case .info: .info
        }
        HStack(alignment: .top, spacing: BBSpacing.space3) {
            BBIconBadge(icon: icon, color: color, diameter: 32, iconSize: 16)
            VStack(alignment: .leading, spacing: BBSpacing.space1) {
                BBText(L10n.lookup(italian: title), style: BBTypography.bodyStrong)
                content()
                if let hint {
                    (Text(L10n.lookup(italian: "Cosa fare:") + " ").fontWeight(.medium) + Text(L10n.lookup(italian: hint)))
                        .font(BBTypography.body.font)
                        .foregroundStyle(Color.bbForeground)
                }
                if let detail {
                    Button { showDetail.toggle() } label: {
                        BBText(L10n.lookup(italian: "Dettaglio tecnico"), style: BBTypography.caption, color: .bbMutedForeground).underline()
                    }
                    .buttonStyle(.plain)
                    if showDetail {
                        Text(detail).font(.system(size: 12, design: .monospaced)).foregroundStyle(Color.bbMutedForeground).textSelection(.enabled)
                    }
                }
                if let report { ReportErrorLink(area: report.area, error: report.message) }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}

extension ImportNotice where Content == EmptyView {
    init(tone: ImportNoticeTone, title: String, hint: String? = nil, detail: String? = nil, report: ReportError? = nil) {
        self.init(tone: tone, title: title, hint: hint, detail: detail, report: report) { EmptyView() }
    }
}

/// Big numbers side by side with their label (`PreviewNumbers`).
struct PreviewNumbers: View {
    let items: [(value: Int, label: String)]

    var body: some View {
        HStack(alignment: .top, spacing: 0) {
            ForEach(Array(items.enumerated()), id: \.offset) { i, item in
                if i > 0 { Rectangle().fill(Color.bbBorder).frame(width: 1).padding(.horizontal, BBSpacing.space3) }
                VStack(alignment: .leading, spacing: 2) {
                    BBText(String(item.value), style: BBTypography.amountLarge, color: item.value == 0 ? .bbMutedForeground : .bbForeground)
                        .monospacedDigit()
                    BBText(L10n.lookup(italian: item.label), style: BBTypography.caption, color: .bbMutedForeground)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .fixedSize(horizontal: false, vertical: true)
    }
}

/// File read and how it was recognised (`PreviewHeader`).
struct PreviewHeader: View {
    let fileName: String?
    let providerName: String?

    var body: some View {
        VStack(alignment: .leading, spacing: BBSpacing.space1) {
            HStack(spacing: BBSpacing.space2) {
                BBIconView(.fileText, size: .md, color: .bbMutedForeground)
                BBText(fileName ?? L10n.lookup(italian: "Testo incollato"), style: BBTypography.bodyStrong, lineLimit: 1)
            }
            if let providerName {
                HStack(spacing: BBSpacing.space1_5) {
                    BBIconView(.circleCheck, size: .md, color: .bbPos)
                    BBText("\(L10n.lookup(italian: "Formato riconosciuto:")) \(L10n.lookup(italian: providerName))", style: BBTypography.body,
                           color: .bbMutedForeground)
                }
            } else {
                BBText(L10n.lookup(italian: "Non riconosco il formato di questo file: indicami cosa contiene ogni colonna."), style: BBTypography.body,
                       color: .bbMutedForeground)
            }
        }
    }
}

/// Section with an optional title and description (`DialogSection`).
struct ImportDialogSection<Content: View>: View {
    var title: String?
    var description: String?
    @ViewBuilder let content: () -> Content

    var body: some View {
        VStack(alignment: .leading, spacing: BBSpacing.space3) {
            if let title { BBText(title, style: BBTypography.sectionTitle) }
            if let description { BBText(description, style: BBTypography.body, color: .bbMutedForeground) }
            content()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

/// The first operations as they will be imported (phone list of `ImportRowsPreview`).
struct ImportRowsPreview: View {
    let rows: [ImportRow]
    var limit = 6
    @Environment(\.bbLocale) private var locale
    @Environment(\.bbHideAmounts) private var hide

    var body: some View {
        let ok = rows.filter(\.isOk)
        if !ok.isEmpty {
            VStack(alignment: .leading, spacing: BBSpacing.space2) {
                VStack(spacing: 0) {
                    ForEach(Array(ok.prefix(limit).enumerated()), id: \.offset) { i, row in
                        if i > 0 { BBSeparator() }
                        if let op = row.operation, let identity = row.identity {
                            HStack(alignment: .top, spacing: BBSpacing.space3) {
                                VStack(alignment: .leading, spacing: 0) {
                                    BBText(ImportNormalize.instrumentLabel(identity), style: BBTypography.bodyStrong, lineLimit: 1)
                                    BBText("\(dateLabel(op.date)) · \(L10n.lookup(italian: ImportOperationTypes.label(op.type)))", style: BBTypography.caption,
                                           color: .bbMutedForeground)
                                }
                                .frame(maxWidth: .infinity, alignment: .leading)
                                BBText((op.quantity != 0 ? L10n.lookup(italian: "{0} × ", ["0": number(op.quantity)]) : "") + number(op.grossAmount ?? op.price),
                                       style: BBTypography.caption, color: .bbMutedForeground)
                                    .monospacedDigit()
                            }
                            .padding(.vertical, BBSpacing.space2)
                        }
                    }
                }
                if ok.count > limit {
                    BBText("\(L10n.lookup(italian: "…e altre")) \(ok.count - limit) \(L10n.lookup(italian: "operazioni: le vedi tutte dopo l'import, in Operazioni."))",
                           style: BBTypography.caption, color: .bbMutedForeground)
                }
            }
        }
    }

    private func dateLabel(_ iso: String) -> String { iso.split(separator: "-").reversed().joined(separator: "/") }
    // INV-112: quantities and prices read from the file are the user's money too.
    private func number(_ value: Double) -> String { hide ? BBFormat.amountMask : BBFormat.formatNumber(value, maximumFractionDigits: 8, locale: locale) }
}

/// Rows not imported: errors to fix and rows skipped on purpose, grouped by reason (`SkippedRows`).
struct SkippedRowsView: View {
    let rows: [ImportRow]

    var body: some View {
        let problems = rows.filter { !$0.isOk }
        if !problems.isEmpty {
            let errors = problems.filter(\.isError)
            let skipped = groupedSkipped(problems)
            ImportDialogSection(title: "\(problems.count) \(L10n.lookup(italian: problems.count == 1 ? "riga non importata" : "righe non importate"))") {
                if !errors.isEmpty {
                    VStack(alignment: .leading, spacing: BBSpacing.space3) {
                        ForEach(Array(errors.prefix(5).enumerated()), id: \.offset) { _, row in
                            let e = ImportMessages.explainRow(row.message ?? "")
                            ImportNotice(tone: .warning, title: L10n.lookup(italian: "Riga {0}: {1}", ["0": String(row.line), "1": L10n.lookup(italian: e.text)]),
                                         hint: e.hint)
                        }
                        if errors.count > 5 {
                            BBText("\(L10n.lookup(italian: "…e altre")) \(errors.count - 5) \(L10n.lookup(italian: "righe con lo stesso tipo di problema."))",
                                   style: BBTypography.body, color: .bbMutedForeground)
                        }
                    }
                }
                if !skipped.isEmpty {
                    VStack(alignment: .leading, spacing: BBSpacing.space1) {
                        ForEach(Array(skipped.prefix(5).enumerated()), id: \.offset) { _, group in
                            (Text(L10n.lookup(italian: ImportMessages.explainRow(group.message).text) + " ")
                             + Text("(" + (group.lines.count == 1 ? L10n.lookup(italian: "riga {0}", ["0": String(group.lines[0])])
                                           : L10n.lookup(italian: "{0} righe", ["0": String(group.lines.count)])) + ")").font(BBTypography.caption.font))
                                .font(BBTypography.body.font)
                                .foregroundStyle(Color.bbMutedForeground)
                        }
                        if skipped.count > 5 {
                            BBText("\(L10n.lookup(italian: "…e altri")) \(skipped.count - 5) \(L10n.lookup(italian: "tipi di riga."))", style: BBTypography.body,
                                   color: .bbMutedForeground)
                        }
                    }
                }
            }
        }
    }

    private func groupedSkipped(_ rows: [ImportRow]) -> [(message: String, lines: [Int])] {
        var order: [String] = []
        var lines: [String: [Int]] = [:]
        for row in rows {
            guard case .skipped(let line, let message) = row else { continue }
            if lines[message] == nil { order.append(message) }
            lines[message, default: []].append(line)
        }
        return order.map { ($0, lines[$0]!) }
    }
}
