import BuddyBudgetKit
import Observation
import SwiftUI

/// State of the «Scrivici» report form (SUP-008…018), shared by the help screen and the quick-report sheet.
/// Twin of `ReportFormModel` on Android.
@MainActor @Observable
final class ReportFormModel {
    enum Phase: Equatable {
        case editing
        case sending
        case sent(reference: String)
    }

    var kind: ReportKind
    var message = ""
    var withContext = true
    private(set) var phase: Phase = .editing
    /// SUP-015: last failure (server text, Italian source when it has one); the message is kept for a retry.
    private(set) var failure: String?

    let source: ReportSource
    let error: ReportError?
    @ObservationIgnored private let api: SupportAPI

    init(api: SupportAPI, source: ReportSource, error: ReportError? = nil, initialKind: ReportKind = .problema) {
        self.api = api
        self.source = source
        self.error = error
        kind = error == nil ? initialKind : .problema
    }

    var canSubmit: Bool { Support.canSubmit(message: message, pending: phase == .sending) }

    func submit(context: ReportContext) async {
        guard canSubmit else { return }
        phase = .sending
        failure = nil
        let input = Support.input(kind: kind, message: message, withContext: withContext, context: context, source: source, error: error)
        do {
            let reference = try await api.send(input)
            message = ""
            phase = .sent(reference: reference)
        } catch {
            failure = error.message
            phase = .editing
        }
    }

    #if DEBUG
    /// `-BBReportMessage <text>` prefills, `-BBReportSubmit` sends, `-BBReportSent <ref>` shows the thank-you state
    /// with a fixture reference (the dev server cannot send email) — screenshots and E2E only.
    func applyDebugLaunch(context: ReportContext) {
        if let text = DebugLaunch.value("-BBReportMessage") { message = text }
        if let reference = DebugLaunch.value("-BBReportSent") { phase = .sent(reference: reference) }
        if DebugLaunch.flag("-BBReportSubmit") { Task { await submit(context: context) } }
    }
    #endif

    /// SUP-014: «Scrivi un'altra segnalazione» starts again from an empty form.
    func reset() {
        message = ""
        failure = nil
        phase = .editing
    }
}

/// The technical context for a report (SUP-011): logical path, `ios-<version> (<build>)`, screen points, resolved theme.
@MainActor
enum ReportContextFactory {
    static var version: String { "ios-\(AppVersion.version) (\(AppVersion.build))" }

    static func make(path: String, scheme: ColorScheme) -> ReportContext {
        let screen = UIApplication.shared.connectedScenes.compactMap { ($0 as? UIWindowScene)?.screen }.first
        let size = screen?.bounds.size ?? .zero
        return ReportContext(path: path, version: version, width: size.width, height: size.height, dark: scheme == .dark)
    }
}

/// «Scrivici» form (web `ReportForm`): kind, message, hint, context checkbox, error, «Invia»; success replaces it.
/// `compact` = the sheet version (label hidden, lower text area).
struct ReportFormView: View {
    @Bindable var model: ReportFormModel
    let context: ReportContext
    var compact = false

    var body: some View {
        if case .sent(let reference) = model.phase {
            sent(reference)
        } else {
            form
        }
    }

    private var form: some View {
        VStack(alignment: .leading, spacing: BBSpacing.space3) {
            if model.error == nil {
                SegmentedControl(options: ReportKind.allCases.map { ($0, L10n.lookup(italian: $0.label)) }, selection: $model.kind,
                                 accessibilityLabel: L10n.lookup(italian: "Di cosa si tratta"), stretch: true)
            }
            VStack(alignment: .leading, spacing: BBSpacing.space1_5) {
                if !compact {
                    BBText(L10n.lookup(italian: "Racconta"), style: BBTypography.bodyStrong)
                }
                BBTextArea(text: $model.message, placeholder: L10n.lookup(italian: model.kind.placeholder),
                           maxLength: Support.messageMaxLength, minHeight: compact ? 96 : 112)
                    .accessibilityLabel(L10n.lookup(italian: "Racconta"))
                BBText(L10n.lookup(italian: "Non scrivere IBAN, password o altri dati sensibili: non servono. Useremo la tua email solo per risponderti."),
                       style: BBTypography.caption, color: .bbMutedForeground)
            }
            contextRow
            if let failure = model.failure {
                BBText("\(L10n.lookup(italian: failure)) \(L10n.lookup(italian: "Puoi anche scrivere a")) \(Support.email).",
                       style: BBTypography.body, color: .bbNeg)
                    .accessibilityAddTraits(.isStaticText)
            }
            BBButton(model.phase == .sending ? L10n.lookup(italian: "Invio…") : L10n.lookup(italian: "Invia"),
                     size: .touch, fullWidth: true, isDisabled: !model.canSubmit) {
                Task { await model.submit(context: context) }
            }
        }
    }

    /// «Allega il contesto tecnico: pagina …, versione …, schermo …, tema …. Nessun dato finanziario.»
    private var contextRow: some View {
        let details = [
            L10n.lookup(italian: "pagina"), " ", context.path,
            L10n.lookup(italian: ", versione"), " ", context.version,
            L10n.lookup(italian: ", schermo"), " ", context.viewport,
            L10n.lookup(italian: ", tema"), " ", L10n.lookup(italian: context.theme.label),
        ].joined()
        return Button { model.withContext.toggle() } label: {
            HStack(alignment: .top, spacing: BBSpacing.space2) {
                BBCheckbox(isOn: $model.withContext).padding(.top, 2).allowsHitTesting(false)
                (Text(L10n.lookup(italian: "Allega il contesto tecnico:") + " ").foregroundStyle(Color.bbMutedForeground)
                    + Text(details).foregroundStyle(Color.bbForeground)
                    + Text(L10n.lookup(italian: ". Nessun dato finanziario.")).foregroundStyle(Color.bbMutedForeground))
                    .font(BBTypography.body.font)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .multilineTextAlignment(.leading)
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(.isToggle)
        .accessibilityValue(model.withContext ? "1" : "0")
    }

    private func sent(_ reference: String) -> some View {
        VStack(alignment: .leading, spacing: BBSpacing.space2) {
            BBText(L10n.lookup(italian: "Grazie, abbiamo ricevuto la segnalazione."), style: BBTypography.bodyStrong)
            (Text(L10n.lookup(italian: "Codice di riferimento") + " ").foregroundStyle(Color.bbMutedForeground)
                + Text(reference).font(BBTypography.mono.with(size: 14, lineHeight: 20).font).foregroundStyle(Color.bbForeground)
                + Text(L10n.lookup(italian: ". Ti rispondiamo via email.")).foregroundStyle(Color.bbMutedForeground))
                .font(BBTypography.body.font)
                .textSelection(.enabled)
            BBButton(L10n.lookup(italian: "Scrivi un'altra segnalazione"), variant: .outline, size: .sm) { model.reset() }
                .padding(.top, BBSpacing.space1)
        }
        .padding(BBSpacing.space4)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle.bb(BBRadius.lg).fill(Color.bbPosSoft))
        .accessibilityElement(children: .contain)
    }
}
