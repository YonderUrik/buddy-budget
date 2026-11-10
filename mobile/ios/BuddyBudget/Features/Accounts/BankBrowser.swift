import AuthenticationServices
import BuddyBudgetKit
import SafariServices
import UIKit

/// In-app browsers for the bank link (R6): the consent runs in an `ASWebAuthenticationSession` that ends on
/// `buddybudget://bank/return?…`; «Come funziona» opens in `SFSafariViewController`. Android: `BankBrowser` (Custom Tabs).
@MainActor
final class BankBrowser: NSObject, ASWebAuthenticationPresentationContextProviding {
    static let shared = BankBrowser()
    private var session: ASWebAuthenticationSession?

    /// The callback URL, or nil when the user closed the browser.
    func authenticate(_ url: URL) async -> URL? {
        await withCheckedContinuation { continuation in
            let session = ASWebAuthenticationSession(url: url, callbackURLScheme: BankLinkReturn.scheme) { callback, _ in
                continuation.resume(returning: callback)
            }
            session.presentationContextProvider = self
            // No shared cookies needed (the native return is public) and no "wants to sign in" system alert.
            session.prefersEphemeralWebBrowserSession = true
            self.session = session
            if !session.start() { continuation.resume(returning: nil) }
        }
    }

    nonisolated func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        MainActor.assumeIsolated { Self.keyWindow ?? ASPresentationAnchor() }
    }

    /// Opens a public page (security explanation) in the in-app browser.
    func open(_ url: URL) {
        guard var top = Self.keyWindow?.rootViewController else { return }
        while let presented = top.presentedViewController { top = presented }
        top.present(SFSafariViewController(url: url), animated: true)
    }

    private static var keyWindow: UIWindow? {
        UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
            .flatMap(\.windows).first { $0.isKeyWindow }
    }
}
