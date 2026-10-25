import BuddyBudgetKit
import SwiftUI
import UIKit

/// «Abbiamo aggiornato Termini e Privacy» (AUTH-044…046, SHELL-003): the three declarations, accept, sign out and
/// download the data (ZIP via the share sheet).
struct LegalAcceptanceScreen: View {
    @Environment(AppEnvironment.self) private var env
    @State private var consent = LegalConsent()
    @State private var legal: LegalMeta?
    @State private var saving = false
    @State private var error: String?
    @State private var export = ExportState()

    var body: some View {
        AuthScaffold {
            VStack(alignment: .leading, spacing: BBSpacing.space8) {
                VStack(alignment: .leading, spacing: BBSpacing.space2) {
                    BBText(L10n.weHaveUpdatedOurTermsAndPrivacyPo, style: .authTitle).accessibilityAddTraits(.isHeader)
                    BBText(L10n.readAndAcceptTheDocumentsToKeepUs, style: BBTypography.bodyLarge, color: .bbText2)
                }
                LegalConsentFields(consent: $consent, legal: legal, isDisabled: saving)
                if let error { BBErrorBox(message: error) }
                VStack(spacing: BBSpacing.space3) {
                    BBButton(saving ? L10n.saving_712d0f : L10n.acceptAndContinue, variant: .sun, size: .touch, fullWidth: true,
                             isLoading: saving, isDisabled: !consent.isComplete) { accept() }
                    BBButton(L10n.signOut, variant: .outline, size: .touch, fullWidth: true, isDisabled: saving) {
                        Task { await env.session.signOut() }
                    }
                    ExportLink(state: $export)
                }
            }
        }
        .task { legal = await env.session.loadLegal() }
    }

    private func accept() {
        let version = legal?.version ?? env.session.bootstrap?.legal.currentVersion ?? ""
        guard let payload = consent.payload(version: version) else { return }
        saving = true
        error = nil
        Task {
            do {
                try await env.user.acceptLegal(payload)
                await env.session.refresh()
            } catch let api as APIError where api.isTransport {
                error = L10n.connectionFailedCheckYourNetworkAnd
            } catch {
                self.error = L10n.couldNotRecordAcceptanceTryAgain
            }
            saving = false
        }
    }
}

/// «Il tuo account è disattivato» (AUTH-047…049, SHELL-002): deletion date, reactivate or sign out.
struct DeactivatedScreen: View {
    @Environment(AppEnvironment.self) private var env
    @Environment(\.bbLocale) private var locale
    @State private var reactivating = false
    @State private var signingOut = false
    @State private var error: String?

    var body: some View {
        AuthScaffold {
            VStack(alignment: .leading, spacing: BBSpacing.space8) {
                VStack(alignment: .leading, spacing: BBSpacing.space2) {
                    BBText(L10n.yourAccountIsDeactivated, style: .authTitle).accessibilityAddTraits(.isHeader)
                    BBText(L10n.yourAccountAndAllDataWillBePerman(deletionDate) + L10n.untilThenYouCanReactivateItAndRec,
                           style: BBTypography.bodyLarge, color: .bbText2)
                }
                if let error { BBErrorBox(message: error) }
                VStack(spacing: BBSpacing.space3) {
                    BBButton(L10n.reactivateAccount, variant: .sun, size: .touch, fullWidth: true, isLoading: reactivating,
                             isDisabled: signingOut) { reactivate() }
                    BBButton(L10n.signOut, variant: .outline, size: .touch, fullWidth: true, isLoading: signingOut,
                             isDisabled: reactivating) {
                        signingOut = true
                        Task { await env.session.signOut() }
                    }
                }
            }
        }
    }

    private var deletionDate: String {
        guard let iso = env.session.bootstrap?.account.deletionScheduledAt, let day = ISODate.localDay(iso) else { return "" }
        return BBFormat.formatLongDate(day, locale: locale)
    }

    private func reactivate() {
        reactivating = true
        error = nil
        Task {
            do {
                try await env.user.reactivate()
                await env.session.refresh()
            } catch let api as APIError where api.isTransport {
                error = L10n.connectionFailedCheckYourNetworkAnd
            } catch let api as APIError {
                error = api.body?.message ?? L10n.reactivationFailed
            } catch {
                self.error = L10n.reactivationFailed
            }
            reactivating = false
        }
    }
}

// MARK: - Data export (shared with Settings › I tuoi dati)

/// State of a `GET /api/user/export` download handed to the share sheet (SET-038).
struct ExportState {
    var running = false
    var error: String?
    var reauthRequired = false
    var file: URL?
}

@MainActor
enum DataExporter {
    /// Downloads the ZIP into a temporary file; maps `reauth_required` and network errors.
    static func run(_ env: AppEnvironment, state: Binding<ExportState>) async {
        state.wrappedValue.running = true
        state.wrappedValue.error = nil
        defer { state.wrappedValue.running = false }
        do {
            let today = CalendarDate.of(Date(), in: .current)
            let export = try await env.user.export(today: today)
            let url = FileManager.default.temporaryDirectory.appendingPathComponent(export.fileName)
            try export.data.write(to: url, options: .atomic)
            state.wrappedValue.file = url
        } catch let api as APIError {
            if api.code == .reauthRequired {
                state.wrappedValue.reauthRequired = true
                state.wrappedValue.error = api.body?.message
            } else if api.isTransport {
                state.wrappedValue.error = L10n.connectionFailedCheckYourNetworkAnd
            } else {
                state.wrappedValue.error = api.body?.message ?? L10n.genericError
            }
        } catch {
            state.wrappedValue.error = L10n.genericError
        }
    }
}

/// «Scarica i miei dati» as a small underlined link (legal-acceptance screen).
private struct ExportLink: View {
    @Binding var state: ExportState
    @Environment(AppEnvironment.self) private var env

    var body: some View {
        VStack(spacing: BBSpacing.space2) {
            Button {
                Task { await DataExporter.run(env, state: $state) }
            } label: {
                HStack(spacing: BBSpacing.space1_5) {
                    if state.running { BBSpinner(size: .sm, color: .bbText3) }
                    BBText(state.running ? L10n.preparing : L10n.downloadMyData, style: BBTypography.body, color: .bbText3)
                        .underline()
                }
                .bbHitArea(height: 20)
            }
            .buttonStyle(.plain)
            .disabled(state.running)
            if let error = state.error {
                BBText(error, style: BBTypography.body, color: .bbNeg).multilineTextAlignment(.center)
            }
        }
        .frame(maxWidth: .infinity)
        .shareSheet(file: $state.file)
    }
}

/// Presents the system share sheet for a file (save to Files, AirDrop…): spec mobile note for `Scarica i miei dati`.
struct ShareSheet: UIViewControllerRepresentable {
    let url: URL

    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: [url], applicationActivities: nil)
    }

    func updateUIViewController(_ controller: UIActivityViewController, context: Context) {}
}

extension View {
    func shareSheet(file: Binding<URL?>) -> some View {
        sheet(isPresented: Binding(get: { file.wrappedValue != nil }, set: { if !$0 { file.wrappedValue = nil } })) {
            if let url = file.wrappedValue { ShareSheet(url: url).presentationDetents([.medium, .large]) }
        }
    }
}
