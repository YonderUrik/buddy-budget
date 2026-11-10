import BuddyBudgetKit
import SwiftUI

/// `/importazioni` (14-imports): intro (IMP-001), report of the selected / just uploaded / first active job — receipt,
/// «Righe da controllare» or correction (IMP-006) — then the three-step upload form and «Le tue importazioni»
/// (one scrolling page, as on the web). Twin of `ImportsScreen` on Android.
struct ImportsScreen: View {
    @Environment(ShellModel.self) private var shell
    @Environment(\.shellBack) private var back
    @Environment(\.bbLocale) private var locale

    var body: some View {
        let model = shell.imports
        ScrollViewReader { proxy in
            BBScreen(title: nil, onBack: back, onRefresh: { await model.load() }) {
                VStack(alignment: .leading, spacing: BBSpacing.space8) {
                    // Web header: the spreadsheet icon beside the page title, then the explanation.
                    VStack(alignment: .leading, spacing: BBSpacing.space2) {
                        HStack(spacing: BBSpacing.space2) {
                            BBIconView(.fileSpreadsheet, points: 28, color: .bbMutedForeground).accessibilityHidden(true)
                            BBText(L10n.lookup(italian: "Importa da CSV o Excel"), style: .screenTitle).accessibilityAddTraits(.isHeader)
                        }
                        BBText(L10n.lookup(italian: "Per le banche e i broker che BuddyBudget non supporta ancora. L'AI riconosce le colonne e il formato resta tuo: lo riusi ai file successivi senza altre analisi."),
                               style: BBTypography.bodyLarge, color: .bbText2)
                    }
                    .padding(.top, BBSpacing.space4)
                    .id(ImportsModel.ScrollTarget.top)
                    if let job = model.reportJob {
                        let file = model.reportFile(locale: locale)
                        switch PersonalImportRules.reportKind(job, correcting: model.correcting) {
                        case .correction: ImportCorrectionView(model: model, job: job).id("c-\(job.id)")
                        case .review: ImportReviewView(model: model, job: job, file: file).id("r-\(job.id)")
                        case .receipt: ImportReceiptView(model: model, job: model.listing?.jobs.first { $0.id == job.id }, jobId: job.id, file: file)
                        }
                    }
                    if model.showsForm {
                        ImportUploadForm(model: model).id(ImportsModel.ScrollTarget.form)
                    }
                    ImportJobList(model: model).id(ImportsModel.ScrollTarget.list)
                }
                .padding(.bottom, BBSpacing.space8)
            }
            .onChange(of: model.scrollTarget) { _, target in
                guard let target else { return }
                DispatchQueue.main.async {
                    withAnimation(.easeOut(duration: 0.3)) { proxy.scrollTo(target, anchor: .top) }
                    model.scrollTarget = nil
                }
            }
        }
        .task { model.start() }
    }
}

// MARK: - Receipt (IMP-026…033)

struct ImportReceiptView: View {
    let model: ImportsModel
    let job: PersonalImportListing.Job?
    let jobId: String
    let file: PersonalImportReceiptFile
    @Environment(ShellModel.self) private var shell
    @Environment(\.bbLocale) private var locale

    var body: some View {
        let status = job?.status
        let imported = status == "imported"
        let failed = job != nil && PersonalImportRules.isFailed(status)
        let running = !imported && !failed
        let nothingNew = imported && PersonalImportRules.overlap(job?.results) == .nothingNew
        let summary = PersonalImportRules.importSummary(job?.results)
        VStack(alignment: .leading, spacing: BBSpacing.space5) {
            HStack(alignment: .top, spacing: BBSpacing.space3) {
                BBIconView(failed ? .circleAlert : nothingNew ? .info : .circleCheck, size: .xl,
                           color: failed ? .bbDestructive : nothingNew ? .bbMutedForeground : .bbPos).padding(.top, 2)
                VStack(alignment: .leading, spacing: BBSpacing.space1) {
                    BBText(L10n.lookup(italian: PersonalImportRules.receiptTitle(status, results: job?.results)), style: BBTextStyle.sectionHeading)
                        .accessibilityAddTraits(.isHeader)
                    BBText(imported ? L10n.lookup(italian: summary.template, summary.values)
                           : failed ? (job?.error ?? L10n.lookup(italian: "Puoi riprovare con un altro file, oppure aprire il dettaglio dalla lista."))
                           : L10n.lookup(italian: "L'abbiamo aggiunto alla lista delle tue importazioni e lo stiamo elaborando."),
                           style: BBTypography.body, color: .bbMutedForeground)
                    if failed {
                        ReportErrorLink(area: .importMovimenti, error: job?.error ?? L10n.lookup(italian: PersonalImportRules.receiptTitle(status)))
                    }
                }
            }
            ImportFileRow(name: file.name, detail: fileDetail)
            stages(status: status, failed: failed)
            if running { ProgressBar(state: .indeterminate, label: L10n.lookup(italian: "Importazione in corso")).frame(height: 6) }
            // IMP-030: what was added (not when nothing was new), then skipped rows, bank categories and older jobs' note.
            if imported, let results = job?.results, PersonalImportRules.showsAddedLines(results) {
                VStack(alignment: .leading, spacing: BBSpacing.space1_5) {
                    BBText(count(results.cash, "movimento aggiunto", "movimenti aggiunti") + " " + L10n.lookup(italian: "a Liquidità."),
                           style: BBTypography.body, color: .bbMutedForeground)
                    BBText(count(results.investments, "operazione aggiunta", "operazioni aggiunte") + " " + L10n.lookup(italian: "a Investimenti."),
                           style: BBTypography.body, color: .bbMutedForeground)
                    ForEach(Array(PersonalImportRules.receiptNotes(results).enumerated()), id: \.offset) { _, note in
                        BBText(L10n.lookup(italian: note.template, note.values), style: BBTypography.body, color: .bbMutedForeground)
                    }
                }
            }
            if running {
                VStack(alignment: .leading, spacing: BBSpacing.space1) {
                    BBText(L10n.lookup(italian: "Puoi chiudere questa pagina: ti scriviamo un'email appena abbiamo finito."), style: BBTypography.body)
                    if let job, !job.estimatedAt.isEmpty {
                        BBText(L10n.lookup(italian: "Stima: entro il") + " " + PersonalImportRules.dayMonthTime(job.estimatedAt, timeZone: .current, locale: locale)
                               + L10n.lookup(italian: ". È una stima, non una scadenza garantita."), style: BBTypography.body, color: .bbMutedForeground)
                    }
                }
            }
            VStack(spacing: BBSpacing.space2) {
                if imported, let results = job?.results {
                    if results.cash > 0 {
                        BBButton(L10n.lookup(italian: "Vai a Liquidità"), size: .touch, fullWidth: true) { shell.open(.liquidity) }
                    }
                    if results.investments > 0 {
                        BBButton(L10n.lookup(italian: "Vai alle operazioni"), variant: results.cash > 0 ? .outline : .default, size: .touch, fullWidth: true) {
                            shell.open(path: "/investimenti/operazioni")
                        }
                    }
                }
                // IMP-049…054: off until the web ships corrections (decision 0004).
                if imported, PersonalImportRules.correctionsEnabled {
                    BBButton(L10n.lookup(italian: "Il risultato è sbagliato"), variant: .outline, size: .touch, fullWidth: true) { model.correcting = jobId }
                }
                BBButton(L10n.lookup(italian: "Vedi le tue importazioni"), variant: .outline, size: .touch, fullWidth: true) { model.scrollTarget = .list }
                BBButton(L10n.lookup(italian: "Carica un altro file"), variant: .ghost, size: .touch, fullWidth: true) { model.anotherFile() }
            }
        }
        .padding(BBSpacing.space4)
        .overlay(RoundedRectangle.bb(BBRadius.xl).strokeBorder(Color.bbBorder))
    }

    private var fileDetail: String {
        var parts = [file.source]
        if let size = file.size { parts.append(PersonalImportRules.sizeText(size, locale)) }
        if let rows = file.rows { parts.append(rows == 1 ? L10n.lookup(italian: "1 riga") : L10n.lookup(italian: "{0} righe", ["0": String(rows)])) }
        return parts.joined(separator: " · ")
    }

    private func count(_ n: Int, _ one: String, _ many: String) -> String {
        n == 1 ? "1 \(L10n.lookup(italian: one))" : "\(n) \(L10n.lookup(italian: many))"
    }

    private func stages(status: String?, failed: Bool) -> some View {
        let stage = PersonalImportRules.receiptStage(status)
        return VStack(alignment: .leading, spacing: BBSpacing.space2_5) {
            ForEach(Array(PersonalImportRules.receiptStages.enumerated()), id: \.offset) { index, label in
                let done = index < stage
                let active = index == stage && !failed
                HStack(spacing: BBSpacing.space3) {
                    Group {
                        if active { BBSpinner(size: .xs, color: .bbForeground) } else {
                            BBIconView(done ? .check : .circleDashed, size: .xs, color: done ? .bbPos : .bbMutedForeground)
                        }
                    }
                    .frame(width: 24, height: 24)
                    .background(Circle().fill(done ? Color.bbPosSoft : Color.bbMuted))
                    if active {
                        ShimmerText(text: L10n.lookup(italian: label) + "…", style: BBTypography.bodyStrong)
                    } else {
                        BBText(L10n.lookup(italian: label), style: BBTypography.body, color: done ? .bbForeground : .bbMutedForeground)
                    }
                }
                .accessibilityElement(children: .combine)
                .accessibilityValue(done ? L10n.lookup(italian: "fatto") : active ? L10n.lookup(italian: "in corso") : L10n.lookup(italian: "in attesa"))
            }
        }
        .accessibilityLabel(L10n.lookup(italian: "Avanzamento dell'importazione"))
    }
}

// MARK: - Upload form (IMP-012…025)

struct ImportUploadForm: View {
    @Bindable var model: ImportsModel
    @State private var picking = false
    @State private var disclosure = false
    @Environment(\.bbLocale) private var locale

    var body: some View {
        let form = model.form
        let steps = PersonalImportRules.UploadStep.allCases
        VStack(alignment: .leading, spacing: BBSpacing.space6) {
            StepProgressBar(index: form.step.rawValue, count: steps.count, label: L10n.lookup(italian: "Passi dell'importazione"))
            VStack(alignment: .leading, spacing: BBSpacing.space4) {
                switch form.step {
                case .source: sourceStep
                case .file: fileStep
                case .consent: consentStep
                }
            }
            VStack(alignment: .leading, spacing: BBSpacing.space2) {
                HStack(spacing: BBSpacing.space2) {
                    if form.step != .source {
                        BBButton(L10n.lookup(italian: "Indietro"), variant: .ghost, size: .touch) { model.back() }
                        Spacer(minLength: 0)
                    }
                    BBButton(form.step == .consent ? (form.uploading ? L10n.lookup(italian: "Carico il file…") : L10n.lookup(italian: "Importa il file"))
                             : L10n.lookup(italian: "Continua"),
                             size: .touch, fullWidth: form.step == .source, isLoading: form.uploading, isDisabled: !model.stepMissing.isEmpty || form.uploading) {
                        if form.step == .consent { Task { await model.submit() } } else { model.next() }
                    }
                }
                if !model.stepMissing.isEmpty {
                    BBText(L10n.lookup(italian: "Per continuare:") + " " + model.stepMissing.map { L10n.lookup(italian: $0) }.joined(separator: ", ") + ".",
                           style: BBTypography.body, color: .bbMutedForeground)
                }
                if let error = form.uploadError {
                    if form.uploadNotice {
                        // IMP-062: a file already imported is a notice, not a fault (no report link).
                        HStack(alignment: .top, spacing: BBSpacing.space2) {
                            BBIconView(.info, size: .md, color: .bbMutedForeground).padding(.top, 2)
                            BBText(error, style: BBTypography.body).frame(maxWidth: .infinity, alignment: .leading)
                        }
                        .padding(BBSpacing.space3)
                        .background(RoundedRectangle.bb(BBRadius.xl).fill(Color.bbAlphaMuted50))
                    } else {
                        ErrorWithReport(area: .importMovimenti, error: error)
                    }
                }
            }
        }
        .importFilePicker(isPresented: $picking) { files in
            if let first = files.first { model.pick(first, locale: locale) }
        }
    }

    private func heading(_ title: String, _ description: String) -> some View {
        VStack(alignment: .leading, spacing: BBSpacing.space1) {
            BBText(title, style: BBTypography.sectionTitle).accessibilityAddTraits(.isHeader)
            BBText(description, style: BBTypography.body, color: .bbMutedForeground)
        }
    }

    @ViewBuilder private var sourceStep: some View {
        let formats = model.formats
        heading(L10n.lookup(italian: "Da dove arriva il file?"),
                formats.isEmpty ? L10n.lookup(italian: "Il nome della tua banca o del tuo broker: serve a riconoscere il formato la prossima volta.")
                    : L10n.lookup(italian: "Scegli un formato che hai già creato, oppure descrivine uno nuovo."))
        if !formats.isEmpty {
            BBSelect(label: L10n.lookup(italian: "Formato"),
                     options: [(String?.none, L10n.lookup(italian: "Nuova banca o broker"))] + formats.map { (Optional($0.id), $0.name) },
                     selection: Binding(get: { model.form.formatId }, set: { model.selectFormat($0) }), height: BBLayout.minTouchTarget)
        }
        if model.isNewFormat {
            BBTextField(label: L10n.lookup(italian: "Nome della banca o del broker"),
                        text: Binding(get: { model.form.name }, set: { model.form.name = String($0.prefix(PersonalImportRules.nameMaxLength)) }),
                        placeholder: L10n.lookup(italian: "Es. Banca Sella"), height: BBLayout.minTouchTarget)
        } else {
            CheckboxRow(isOn: $model.form.regenerate,
                        text: L10n.lookup(italian: "Rileggi il formato con l'AI") + " ",
                        muted: L10n.lookup(italian: "(se il file è cambiato o il risultato precedente non era giusto)"))
        }
    }

    @ViewBuilder private var fileStep: some View {
        heading(L10n.lookup(italian: "Carica il file"),
                L10n.lookup(italian: "CSV o Excel (.xlsx), fino a {0} e {1} righe.",
                            ["0": PersonalImportRules.sizeText(PersonalImportRules.maxBytes, locale),
                             "1": BBFormat.formatNumber(Double(PersonalImportRules.maxRows), locale: locale)]))
        if let file = model.form.file {
            ImportFileRow(name: file.name, detail: PersonalImportRules.sizeText(file.size, locale) + " " + L10n.lookup(italian: "· pronto"),
                          filled: false, removeLabel: L10n.lookup(italian: "Rimuovi {0}", ["0": file.name])) { model.removeFile() }
        } else {
            FilePickZone(title: model.form.reading ? L10n.lookup(italian: "Leggo il file…") : L10n.lookup(italian: "Scegli un file"),
                         subtitle: model.form.reading ? L10n.lookup(italian: "Un attimo") : L10n.lookup(italian: "CSV, TXT o Excel (.xlsx)"),
                         busy: model.form.reading) { picking = true }
        }
        if let error = model.form.fileError {
            ErrorWithReport(area: .importMovimenti, error: L10n.lookup(italian: error.template, error.values))
        }
    }

    @ViewBuilder private var consentStep: some View {
        heading(L10n.lookup(italian: "Ultimo passo: il consenso"),
                L10n.lookup(italian: "Per capire le colonne di un formato nuovo, il file viene letto da un modello AI."))
        CheckboxRow(isOn: Binding(get: { model.form.consent }, set: { model.setConsent($0) }),
                    text: L10n.lookup(italian: "Acconsento all'analisi AI del file, anche automaticamente se il formato salvato non riesce a leggerlo."))
        DisclosureBox(title: L10n.lookup(italian: "Cosa succede ai tuoi dati"), isOpen: $disclosure) {
            BBText(L10n.lookup(italian: "Il file originale completo è inviato a OpenRouter e al modello configurato, con fornitori senza conservazione dei dati. Può contenere descrizioni, dati finanziari ed eventuali dati personali presenti nel file."),
                   style: BBTypography.body, color: .bbMutedForeground)
            BBText(L10n.lookup(italian: "File e anteprima sono cifrati e restano disponibili per 7 giorni; il file originale viene eliminato al termine dell'analisi. Il formato che ne ricaviamo è privato. Pagamenti e investimenti si salvano da soli al termine dei controlli."),
                   style: BBTypography.body, color: .bbMutedForeground)
        }
    }
}

/// Checkbox with its sentence as one tappable row (min height 44).
struct CheckboxRow: View {
    @Binding var isOn: Bool
    let text: String
    var muted: String?
    var isDisabled = false

    var body: some View {
        Button { isOn.toggle() } label: {
            HStack(alignment: .top, spacing: BBSpacing.space3) {
                BBCheckbox(isOn: $isOn, accessibilityLabel: text, isDisabled: isDisabled).padding(.top, 2).allowsHitTesting(false)
                (Text(text).foregroundStyle(Color.bbForeground) + Text(muted ?? "").foregroundStyle(Color.bbMutedForeground))
                    .font(BBTypography.body.font)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .multilineTextAlignment(.leading)
            }
            .frame(minHeight: BBLayout.minTouchTarget, alignment: .topLeading)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(isDisabled)
    }
}

/// `<details>` box: muted background, tappable title with chevron (mobile note: native disclosure).
struct DisclosureBox<Content: View>: View {
    let title: String
    @Binding var isOpen: Bool
    var boxed = true
    var icon: BBIcon?
    @ViewBuilder let content: () -> Content

    var body: some View {
        VStack(alignment: .leading, spacing: BBSpacing.space2) {
            Button { withAnimation(.easeOut(duration: 0.2)) { isOpen.toggle() } } label: {
                HStack(spacing: BBSpacing.space2) {
                    if let icon { BBIconView(icon, size: .md, color: .bbMutedForeground) }
                    BBText(title, style: BBTypography.bodyStrong)
                    Spacer(minLength: 0)
                    BBIconView(.chevronDown, size: .md, color: .bbMutedForeground).rotationEffect(.degrees(isOpen ? 180 : 0))
                }
                .frame(minHeight: 36)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityAddTraits(isOpen ? .isSelected : [])
            if isOpen {
                VStack(alignment: .leading, spacing: BBSpacing.space2) { content() }
            }
        }
        .padding(boxed ? BBSpacing.space3 : 0)
        .background { if boxed { RoundedRectangle.bb(BBRadius.xl).fill(Color.bbAlphaMuted50) } }
    }
}

// MARK: - «Le tue importazioni» (IMP-007…011)

struct ImportJobList: View {
    let model: ImportsModel
    @Environment(\.bbLocale) private var locale

    var body: some View {
        PanelSection(title: L10n.lookup(italian: "Le tue importazioni"), icon: .listChecks, color: .bbSwatchSlate, action: { EmptyView() }) {
            if model.loading { BBText(L10n.lookup(italian: "Caricamento…"), style: BBTypography.body, color: .bbMutedForeground) }
            if model.loadFailed {
                BBText(L10n.lookup(italian: "Impossibile caricare i CSV personali. Riprova."), style: BBTypography.body, color: .bbDestructive)
            }
            if model.jobs.isEmpty, !model.loading, !model.loadFailed {
                VStack(spacing: BBSpacing.space2) {
                    BBIconView(.fileSpreadsheet, points: 32, color: .bbMutedForeground)
                    BBText(L10n.lookup(italian: "Nessun file caricato"), style: BBTypography.bodyStrong)
                    BBText(L10n.lookup(italian: "Quando carichi un file lo trovi qui, con il suo stato."), style: BBTypography.body, color: .bbMutedForeground)
                        .multilineTextAlignment(.center)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, BBSpacing.space6)
            }
            VStack(spacing: 0) {
                ForEach(Array(model.jobs.enumerated()), id: \.element.id) { index, job in
                    row(job)
                }
            }
        }
    }

    private func row(_ job: PersonalImportListing.Job) -> some View {
        let state = PersonalImportRules.islandState(job.status)
        let described = PersonalImportRules.describe(job)
        let message = described.message.verbatim ? described.message.template : L10n.lookup(italian: described.message.template, described.message.values)
        let name = model.source(of: job)
        let day = PersonalImportRules.dayLabel(job.createdAt, now: Date(), timeZone: .current, locale: locale)
        let selected = (model.reportJob?.id ?? model.selected) == job.id
        return VStack(alignment: .leading, spacing: 0) {
            Button { model.tap(job) } label: {
                HStack(spacing: BBSpacing.space3) {
                    ImportStatusIcon(state: state)
                    VStack(alignment: .leading, spacing: 2) {
                        HStack(alignment: .firstTextBaseline, spacing: BBSpacing.space2) {
                            BBText(name, style: BBTypography.bodyStrong, lineLimit: 1)
                            BBText(L10n.lookup(italian: day.template, day.values), style: BBTypography.caption, color: .bbMutedForeground, lineLimit: 1)
                                .layoutPriority(1)
                        }
                        if state == .running {
                            ShimmerText(text: message, color: .bbMutedForeground)
                        } else {
                            BBText(message, style: BBTypography.body, color: state == .failed ? .bbNeg : .bbMutedForeground, lineLimit: 1)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    BBIconView(.chevronRight, size: .md, color: .bbMutedForeground)
                }
                .padding(.vertical, BBSpacing.space3)
                .frame(minHeight: 56)
                .background(selected ? Color.bbAlphaMuted40 : Color.clear)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityAddTraits(selected ? .isSelected : [])
            if state == .running {
                ProgressBar(state: .indeterminate, label: L10n.lookup(italian: "Importazione {0} in corso", ["0": name]))
                    .frame(height: 6)
                    .padding(.leading, 44)
                    .padding(.bottom, BBSpacing.space3)
            }
        }
    }
}

struct ImportStatusIcon: View {
    let state: PersonalImportIslandState?

    var body: some View {
        Group {
            switch state {
            case .running: BBSpinner(size: .sm, color: .bbPrimary).frame(width: 32, height: 32).background(Circle().fill(Color.bbAlphaPrimary10))
            case .review: BBIconView(.listChecks, size: .sm, color: .bbPrimary).frame(width: 32, height: 32).background(Circle().fill(Color.bbAlphaPrimary10))
            case .done: BBIconView(.check, size: .sm, color: .bbPos).frame(width: 32, height: 32).background(Circle().fill(Color.bbPosSoft))
            default: BBIconView(.circleAlert, size: .sm, color: .bbNeg).frame(width: 32, height: 32).background(Circle().fill(Color.bbNegSoft))
            }
        }
        .accessibilityHidden(true)
    }
}
