import BuddyBudgetKit
import SwiftUI

@main
struct BuddyBudgetApp: App {
    @State private var environment = AppEnvironment.live()
    /// App language follows the account (`user.language`), not the device; see Resources/Generated/LocalizedStrings.swift.
    private let strings = LocalizedStrings.shared

    var body: some Scene {
        WindowGroup {
            root
                .environment(environment)
                .environment(\.locale, strings.locale)
                .environment(\.bbLocale, strings.language.bbLocale)
                .environment(\.bbHideAmounts, environment.privacy.hideAmounts)
                .environment(\.bbLogoLoader, environment.logoLoader)
                .bbToastHost(environment.toasts)
                .bbTheme(environment.preferences.theme)
                .onAppear { BBTheme.apply(environment.preferences.theme) }
                .onChange(of: environment.preferences.theme) { _, theme in BBTheme.apply(theme) }
                .onOpenURL { url in
                    if let item = IncomingItem.from(url) { environment.incoming = item }
                }
        }
    }

    @ViewBuilder private var root: some View {
        #if DEBUG
        if let page = GalleryPage.fromLaunchArguments() {
            ComponentGallery(page: page)
        } else {
            RootView()
        }
        #else
        RootView()
        #endif
    }
}
