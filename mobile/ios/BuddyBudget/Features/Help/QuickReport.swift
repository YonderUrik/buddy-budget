import BuddyBudgetKit
import Observation
import SwiftUI

/// One opening of the quick-report sheet (SUP-019…022): where it started, the attached error and the screen it was
/// opened from. Every opening has a new id, so the form starts empty (SUP-022).
struct QuickReportRequest: Identifiable, Equatable {
    let id = UUID()
    let source: ReportSource
    let error: ReportError?
    /// Logical path of the screen behind the sheet (the context path).
    let path: String
}

/// Opens the quick-report sheet from anywhere in the signed-in app: the «Scrivici» button and the `Segnala` toast
/// action (SUP-019, SUP-023). Mounted once by the shell (`quickReportHost`). Twin of `QuickReportCenter` on Android.
@MainActor @Observable
final class QuickReportCenter {
    var request: QuickReportRequest?
    let api: SupportAPI
    /// Set by the shell: logical web path of the visible screen (mobile note on the technical context).
    @ObservationIgnored var currentPath: () -> String = { "/" }

    init(api: SupportAPI) {
        self.api = api
    }

    func makeRequest(source: ReportSource, error: ReportError? = nil) -> QuickReportRequest {
        QuickReportRequest(source: source, error: error, path: currentPath())
    }

    func open(source: ReportSource, error: ReportError? = nil) {
        request = makeRequest(source: source, error: error)
    }
}

private struct QuickReportKey: EnvironmentKey {
    static let defaultValue: QuickReportCenter? = nil
}

private struct ScriviciKey: EnvironmentKey {
    nonisolated(unsafe) static let defaultValue: (() -> Void)? = nil
}

extension EnvironmentValues {
    /// Set only inside the signed-in shell: report links render nothing without it (as on the web, where the sheet's
    /// provider lives in the authenticated layout).
    var quickReport: QuickReportCenter? {
        get { self[QuickReportKey.self] }
        set { self[QuickReportKey.self] = newValue }
    }

    /// SHELL-023: the «Scrivici» top-bar button of the tab roots (`BBScreen` shows it when set and there is no back).
    var openScrivici: (() -> Void)? {
        get { self[ScriviciKey.self] }
        set { self[ScriviciKey.self] = newValue }
    }
}

extension View {
    /// Mounts the quick-report sheet once for the whole signed-in app.
    func quickReportHost(_ center: QuickReportCenter) -> some View {
        modifier(QuickReportHost(center: center))
    }
}

private struct QuickReportHost: ViewModifier {
    @Bindable var center: QuickReportCenter
    /// Kept while the sheet animates out (the web keeps the content during the closing animation).
    @State private var shown: QuickReportRequest?

    func body(content: Content) -> some View {
        content
            .onChange(of: center.request) { _, request in if let request { shown = request } }
            .onAppear { if let request = center.request { shown = request } }
            .bbSheet(isPresented: Binding(get: { center.request != nil }, set: { if !$0 { center.request = nil } }),
                     title: QuickReportSheet.title(shown)) {
                if let shown { QuickReportSheet(request: shown, api: center.api).id(shown.id) }
            }
    }
}

/// Body of the quick-report sheet: description, the attached error box and the compact form.
struct QuickReportSheet: View {
    let request: QuickReportRequest
    @State private var model: ReportFormModel
    @Environment(\.colorScheme) private var scheme

    init(request: QuickReportRequest, api: SupportAPI) {
        self.request = request
        _model = State(initialValue: ReportFormModel(api: api, source: request.source, error: request.error))
    }

    /// `Segnala questo problema` with an attached error, else `Scrivici` (SUP-019, SUP-020).
    static func title(_ request: QuickReportRequest?) -> String {
        request?.error == nil ? L10n.lookup(italian: "Scrivici") : L10n.lookup(italian: "Segnala questo problema")
    }

    var body: some View {
        VStack(alignment: .leading, spacing: BBSpacing.space4) {
            BBText(L10n.lookup(italian: "Ti rispondiamo via email. Leggiamo tutto."), style: BBTypography.body, color: .bbMutedForeground)
            if let error = request.error {
                HStack(alignment: .top, spacing: BBSpacing.space2) {
                    BBIconView(.circleAlert, size: .md, color: .bbNeg).padding(.top, 2)
                    VStack(alignment: .leading, spacing: 0) {
                        BBText(L10n.lookup(italian: error.area.label), style: BBTypography.bodyStrong)
                        BBText(L10n.lookup(italian: error.message), style: BBTypography.body, color: .bbMutedForeground)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
                .padding(BBSpacing.space3)
                .background(RoundedRectangle.bb(BBRadius.lg).fill(Color.bbNegSoft))
                .accessibilityElement(children: .combine)
            }
            ReportFormView(model: model, context: ReportContextFactory.make(path: request.path, scheme: scheme), compact: true)
        }
        #if DEBUG
        .onAppear { model.applyDebugLaunch(context: ReportContextFactory.make(path: request.path, scheme: scheme)) }
        #endif
    }
}

/// `Segnala questo problema` under an error message (web `ReportErrorLink`): opens the sheet with the error attached.
/// Presents its own sheet so it also works inside another sheet or form dialog.
struct ReportErrorLink: View {
    let area: ReportErrorArea
    /// The message shown to the user (Italian source or server text); travels with the report.
    let error: String
    @Environment(\.quickReport) private var center
    @State private var request: QuickReportRequest?
    @State private var shown: QuickReportRequest?

    var body: some View {
        if let center {
            Button {
                let next = center.makeRequest(source: .errore, error: ReportError(area: area, message: error))
                shown = next
                request = next
            } label: {
                BBText(L10n.lookup(italian: "Segnala questo problema"), style: BBTypography.bodyStrong, color: .bbPrimary)
                    .frame(minHeight: 36)
                    .bbHitArea(height: 36)
            }
            .buttonStyle(.plain)
            .bbSheet(isPresented: Binding(get: { request != nil }, set: { if !$0 { request = nil } }),
                     title: QuickReportSheet.title(shown)) {
                if let shown { QuickReportSheet(request: shown, api: center.api).id(shown.id) }
            }
        }
    }
}

/// A form's error message with the report link below it (web `ErrorWithReport`).
struct ErrorWithReport: View {
    let area: ReportErrorArea
    let error: String

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            BBText(L10n.lookup(italian: error), style: BBTypography.body, color: .bbDestructive)
                .accessibilityAddTraits(.isStaticText)
            ReportErrorLink(area: area, error: error)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

extension ToastCenter {
    /// Error toast with the `Segnala` action (web `errorToast`, SUP-023): opens the sheet with the error attached.
    func showError(_ message: String, area: ReportErrorArea = .salvataggio) {
        guard let report = reportAction else {
            show(.error, message)
            return
        }
        show(.error, message, actionLabel: L10n.report) { report(ReportError(area: area, message: message)) }
    }
}
