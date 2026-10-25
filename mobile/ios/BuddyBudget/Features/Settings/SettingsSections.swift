import BuddyBudgetKit
import SwiftUI

private func longDate(_ iso: String?, _ locale: BBLocale) -> String {
    guard let iso, let day = ISODate.localDay(iso) else { return "" }
    return BBFormat.formatLongDate(day, locale: locale)
}

// MARK: - Account

/// Profilo (SET-005…008).
struct ProfileSection: View {
    @Bindable var model: SettingsModel
    let settings: UserSettings
    @State private var name = ""
    @Environment(\.bbLocale) private var locale

    var body: some View {
        let trimmed = name.trimmingCharacters(in: .whitespaces)
        let dirty = trimmed != settings.name
        SettingsSection(title: L10n.profile, icon: .userRound) {
            SettingsRow(label: L10n.name_13030d, hint: L10n.yourNameInTheApp, first: true) {
                HStack(spacing: BBSpacing.space2) {
                    BBTextField(text: $name, placeholder: L10n.yourName, contentType: .name, submitLabel: .done,
                                onSubmit: { save(trimmed, dirty) })
                        .onChange(of: name) { _, new in
                            if new.count > 80 { name = String(new.prefix(80)) }
                            model.nameSaved = false
                        }
                    BBButton(L10n.save, variant: .outline, isLoading: model.savingSettings, isDisabled: !dirty || trimmed.isEmpty) {
                        save(trimmed, dirty)
                    }
                }
                if model.nameSaved && !dirty { StatusLine(text: L10n.nameSaved, success: true) }
                if let error = model.settingsError { StatusLine(text: error) }
            }
            SettingsRow(label: L10n.email, hint: L10n.withBuddybudgetSince0(longDate(settings.createdAt, locale))) {
                BBText(settings.email, style: BBTypography.body)
            }
            SettingsRow(label: L10n.signInMethods, hint: L10n.youCanSignInUsingAnyOfTheseMetho) {
                HStack(spacing: BBSpacing.space2) {
                    BBIconView(.mail, size: .md, color: .bbMutedForeground)
                    BBText(L10n.emailLink, style: BBTypography.body)
                    BBText(L10n.active_13c496, style: BBTypography.caption, color: .bbPos)
                }
                // SET-007 «Collega» Google needs the native Google SDK (auth.md R3): shown only when already linked.
                if settings.googleLinked {
                    HStack(spacing: BBSpacing.space2) {
                        BBIconView(.globe, size: .md, color: .bbMutedForeground)
                        BBText(L10n.google, style: BBTypography.body)
                        BBText(L10n.connected, style: BBTypography.caption, color: .bbPos)
                    }
                }
            }
        }
        .onAppear { name = settings.name }
    }

    private func save(_ trimmed: String, _ dirty: Bool) {
        guard dirty, !trimmed.isEmpty else { return }
        Task { await model.saveName(trimmed) }
    }
}

/// Sessioni attive (SET-009…012).
struct SessionsSection: View {
    @Bindable var model: SettingsModel
    @Environment(\.bbLocale) private var locale

    var body: some View {
        SettingsSection(title: L10n.activeSessions, description: L10n.devicesYouSignedInFromSessionsExpi(String(DangerConfirmation.sessionIdleDays)),
                        icon: .monitorSmartphone) {
            switch model.sessions {
            case .loading: BBSkeleton(height: 96, radius: BBRadius.lg)
            case .failed: LoadError(message: L10n.unableToLoadSessions) { Task { await model.loadSessions() } }
            case .loaded(let sessions):
                VStack(spacing: 0) {
                    ForEach(Array(sessions.enumerated()), id: \.element.id) { offset, session in
                        row(session).padding(.vertical, BBSpacing.space3)
                    }
                }
                if sessions.contains(where: { !$0.current }) {
                    BBButton(L10n.signOutOfAllOtherDevices, variant: .outline, isLoading: model.revoking == "*",
                             isDisabled: model.revoking != nil) { Task { await model.revoke(nil) } }
                }
                if let error = model.sessionsError { StatusLine(text: error) }
            }
        }
    }

    private func row(_ session: UserSessionView) -> some View {
        HStack(spacing: BBSpacing.space3) {
            BBIconView(session.mobile ? .smartphone : .laptop, size: .lg, color: .bbMutedForeground)
            VStack(alignment: .leading, spacing: 0) {
                HStack(spacing: BBSpacing.space2) {
                    BBText(L10n.s0On1(L10n.lookup(italian: session.browser), L10n.lookup(italian: session.os)),
                           style: BBTypography.bodyStrong, lineLimit: 1)
                    if session.current { BBText(L10n.thisDevice, style: BBTypography.caption, color: .bbPos) }
                }
                BBText(subtitle(session), style: BBTypography.caption, color: .bbMutedForeground)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            if !session.current {
                BBButton(L10n.disconnect, variant: .outline, size: .sm, isLoading: model.revoking == session.id,
                         isDisabled: model.revoking != nil) { Task { await model.revoke(session.id) } }
            }
        }
    }

    private func subtitle(_ s: UserSessionView) -> String {
        let relative = ISODate.parse(s.lastActiveAt).map { BBFormat.formatRelativeTime($0, now: Date(), locale: locale) } ?? ""
        return "\(L10n.lastActive) \(relative) \(L10n.expiresOn) \(longDate(s.expiresAt, locale))"
    }
}

// MARK: - Aspetto e uso

/// Preferenze (SET-013…018). «Barra laterale» is web-only (spec mobile note).
struct PreferencesSection: View {
    @Bindable var model: SettingsModel
    let settings: UserSettings
    @Environment(AppEnvironment.self) private var env

    var body: some View {
        SettingsSection(title: L10n.preferences, icon: .slidersHorizontal) {
            SettingsRow(label: L10n.currency_04fe77, hint: L10n.onlyChangesHowAmountsAreDisplayedS, first: true) {
                BBSelect(options: LocaleRules.currencies.map {
                    ($0, "\(L10n.lookup(italian: LocaleRules.currencyLabel($0))) (\(LocaleRules.currencySymbol($0)))")
                }, selection: .constant(settings.currency), title: L10n.currency_04fe77, isDisabled: model.savingSettings) { (value: String) in
                    Task { await model.patch(UserSettingsPatch(currency: value)) }
                }
            }
            SettingsRow(label: L10n.homePage, hint: L10n.yourLandingPageAfterSignIn) {
                BBSelect(options: HomePage.options.map { ($0.rawValue, L10n.lookup(italian: $0.title)) },
                         selection: .constant(HomePage.resolve(settings.homePage).rawValue), title: L10n.homePage,
                         isDisabled: model.savingSettings) { (value: String) in
                    Task { await model.patch(UserSettingsPatch(homePage: value)) }
                }
            }
            SettingsRow(label: L10n.theme_6ae1bc, hint: L10n.appliesToThisDevice) {
                @Bindable var preferences = env.preferences
                SegmentedControl(options: [(BBThemePreference.light, L10n.light), (.dark, L10n.dark), (.system, L10n.system)],
                                 selection: $preferences.theme, accessibilityLabel: L10n.theme_6ae1bc)
            }
            VStack(alignment: .leading, spacing: 0) {
                LocaleFields(country: settings.productCountry, language: settings.language, currency: settings.currency,
                             isDisabled: model.savingSettings,
                             onCountry: { country in
                                 Task { await model.setLocale(country: country,
                                                              language: LocaleRules.languageAfterSwitching(to: country, current: settings.language)) }
                             },
                             onLanguage: { language in
                                 Task { await model.setLocale(country: settings.productCountry, language: language) }
                             })
            }
            .padding(.top, BBSpacing.space4)
            if let error = model.settingsError { StatusLine(text: error) }
        }
    }
}

// MARK: - Notifiche e AI

/// Notifiche (SET-023…028).
struct NotificationsSection: View {
    @Bindable var model: SettingsModel
    let settings: UserSettings
    @Environment(AppEnvironment.self) private var env

    var body: some View {
        SettingsSection(title: L10n.notifications, description: L10n.optionalSummaryAndAlertEmailsTo0A(settings.email), icon: .mail) {
            switch model.notifications {
            case .loading: BBSkeleton(height: 96, radius: BBRadius.lg)
            case .failed: StatusLine(text: L10n.couldNotLoadNotificationPreferences)
            case .loaded(let prefs):
                let kinds = NotificationKind.settings(goalsAvailable: env.session.sections.goals)
                ForEach(Array(kinds.enumerated()), id: \.element) { offset, kind in
                    SettingsSwitchRow(label: L10n.lookup(italian: kind.label), hint: L10n.lookup(italian: kind.settingsHint),
                                      first: offset == 0,
                                      isOn: Binding(get: { kind.isOn(prefs) }, set: { on in Task { await model.setNotification(kind.patch(on)) } }),
                                      isDisabled: model.savingNotifications)
                }
                if prefs.digestEnabled {
                    SettingsRow(label: L10n.summaryFrequency, hint: L10n.theSummaryCoversTheLastCompletedPe) {
                        BBSelect(options: DigestFrequency.allCases.map { ($0, L10n.lookup(italian: NotificationChoices.settingsLabel($0))) },
                                 selection: .constant(prefs.digestFrequency), title: L10n.summaryFrequency,
                                 isDisabled: model.savingNotifications) { (value: DigestFrequency) in
                            Task { await model.setNotification(NotificationPreferencesPatch(digestFrequency: value)) }
                        }
                    }
                }
                SettingsRow(label: L10n.viewAnExample, hint: L10n.weWillSendLastMonthSSummaryUsing) {
                    BBButton(model.exampleState == .sending ? L10n.sending_169cb1 : L10n.sendMeAnExample, variant: .outline,
                             isDisabled: model.exampleState == .sending) { Task { await model.sendExample() } }
                    switch model.exampleState {
                    case .sent: BBText(L10n.sentCheckYourInbox, style: BBTypography.caption, color: .bbMutedForeground)
                    case .failed(let message): StatusLine(text: message)
                    default: EmptyView()
                    }
                }
                if let error = model.notificationsError { StatusLine(text: error) }
            }
        }
    }
}

/// «Usa l'AI» tag next to a setting that sends data to an AI model (SET-050).
struct AiBadge: View {
    var body: some View { BBBadge(L10n.usesAi, variant: .soft, icon: .sparkles) }
}

/// «Dove l'app usa l'AI» (SET-050, web #394/#460).
private struct AiUsageSummary: View {
    @Environment(AppEnvironment.self) private var env
    @State private var legal: LegalMeta?

    var body: some View {
        VStack(alignment: .leading, spacing: BBSpacing.space3) {
            HStack(spacing: BBSpacing.space2) {
                BBText(L10n.whereTheAppUsesAi, style: BBTypography.bodyStrong).accessibilityAddTraits(.isHeader)
                AiBadge()
            }
            ForEach(AiUsage.items, id: \.title) { item in
                VStack(alignment: .leading, spacing: BBSpacing.space0_5) {
                    BBText(L10n.lookup(italian: item.title), style: BBTypography.bodyStrong)
                    BBText("\(L10n.lookup(italian: item.sent)) \(L10n.lookup(italian: item.where))", style: BBTypography.caption,
                           color: .bbMutedForeground)
                }
            }
            BBText(L10n.lookup(italian: AiUsage.noAiWithoutConsent), style: BBTypography.caption, color: .bbMutedForeground)
            if let url = URL(string: ExternalLinks.legal("privacy", meta: legal) + AiUsage.zdrAnchor) {
                BBLinkText(parts: [
                    .text(L10n.lookup(italian: AiUsage.zeroDataRetention) + " "),
                    .link(L10n.howItWorks, url),
                ], style: BBTypography.caption, color: .bbMutedForeground)
            }
        }
        .padding(BBSpacing.space4)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle.bb(BBRadius.xl).fill(Color.bbAlphaMuted50))
        .task { legal = await env.session.loadLegal() }
    }
}

/// Assistente per le categorie (SET-030…033, SET-050).
struct AiSection: View {
    @Bindable var model: SettingsModel
    @State private var draft: String?

    var body: some View {
        SettingsSection(title: L10n.categoryAssistant, description: L10n.suggestsCategoriesForNewSyncedAndI, icon: .sparkles) {
            AiUsageSummary()
            switch model.ai {
            case .loading: BBSkeleton(height: 64, radius: BBRadius.lg)
            case .failed: StatusLine(text: L10n.couldNotLoadThisSetting_e9e896)
            case .loaded(let state):
                SettingsSwitchRow(label: L10n.suggestCategoriesWithAi,
                                  hint: state.available ? L10n.whenOnTheCleanedUpMerchantNameNev : L10n.theServiceIsNotConfiguredOnThisSe,
                                  first: true,
                                  isOn: Binding(get: { state.enabled }, set: { on in Task { await model.setAi(AiCategorizationPatch(enabled: on)) } }),
                                  isDisabled: model.savingAi || !state.available, ai: true)
                SettingsSwitchRow(label: L10n.letTheAppChooseWhenConfidenceIsHi,
                                  hint: L10n.doesNotUseAiOnItsOwnYourRulesAl(CategorizationText.autoApplyPercent),
                                  isOn: Binding(get: { state.autoApply }, set: { on in Task { await model.setAi(AiCategorizationPatch(autoApply: on)) } }),
                                  isDisabled: model.savingAi)
                let value = draft ?? state.instructions
                let dirty = value.trimmingCharacters(in: .whitespacesAndNewlines) != state.instructions
                VStack(alignment: .leading, spacing: BBSpacing.space2) {
                    HStack(spacing: BBSpacing.space2) {
                        BBText(L10n.yourAiInstructions, style: BBTypography.bodyStrong)
                        AiBadge()
                    }
                    BBText(L10n.explainHowYouPreferToCategoriseSpe, style: BBTypography.body, color: .bbMutedForeground)
                    BBTextArea(text: Binding(get: { value }, set: { draft = $0; model.instructionsSaved = false }),
                               placeholder: L10n.forExamplePutMealDeliveriesInResta, maxLength: 2000, isDisabled: model.savingAi)
                    BBText("\(value.count)\(L10n.s2000ChangesApplyToNewSuggestionsAf)", style: BBTypography.caption, color: .bbMutedForeground)
                    BBButton(model.savingAi ? L10n.saving_f71782 : L10n.saveInstructions, isDisabled: !dirty || model.savingAi) {
                        Task {
                            await model.setAi(AiCategorizationPatch(instructions: value))
                            if model.aiError == nil { draft = nil }
                        }
                    }
                    if model.instructionsSaved {
                        BBText(L10n.instructionsSavedExistingCategoryAss, style: BBTypography.body, color: .bbMutedForeground)
                    }
                }
                .padding(.top, BBSpacing.space4)
                if let error = model.aiError { StatusLine(text: error) }
            }
        }
    }
}

// MARK: - Privacy e dati

/// Privacy (SET-035, SET-036). «Statistiche d'uso anonime» (SET-034) is not applicable: the apps send no analytics.
struct PrivacySection: View {
    @Bindable var model: SettingsModel
    let settings: UserSettings
    @Environment(AppEnvironment.self) private var env
    @Environment(\.openURL) private var openURL
    @Environment(\.bbLocale) private var locale
    @State private var legal: LegalMeta?

    var body: some View {
        SettingsSection(title: L10n.privacy, description: L10n.howWeHandleYourDataAndHowToExerc, icon: .shieldCheck) {
            SettingsRow(label: L10n.documents,
                        hint: settings.legalAcceptedAt != nil
                            ? L10n.youAcceptedThe0VersionOn1(settings.legalAcceptedVersion ?? "", longDate(settings.legalAcceptedAt, locale))
                            : L10n.noRecordedAcceptanceFound, first: true) {
                HStack(spacing: BBSpacing.space4) {
                    ForEach(ExternalLinks.legalDocuments, id: \.self) { id in
                        Button {
                            if let url = URL(string: ExternalLinks.legal(id, meta: legal)) { openURL(url) }
                        } label: {
                            BBText(id == "privacy" ? L10n.privacy : id == "termini" ? L10n.terms : L10n.cookies_e4f819,
                                   style: BBTypography.body, color: .bbMutedForeground).underline().bbHitArea(height: 20)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
            VStack(alignment: .leading, spacing: BBSpacing.space3) {
                BBLinkText(parts: [
                    .text(L10n.forOtherRequestsWriteTo + " "),
                    .link(PrivacyRequest.privacyEmail, URL(string: "mailto:\(PrivacyRequest.privacyEmail)")!),
                    .text(L10n.weReplyWithinAMonthTheseLinksOpen),
                ], style: BBTypography.body, color: .bbMutedForeground)
                ForEach(PrivacyRequest.options, id: \.type) { option in
                    Button {
                        if let url = URL(string: option.mailto(accountEmail: settings.email)) { openURL(url) }
                    } label: {
                        VStack(alignment: .leading, spacing: BBSpacing.space0_5) {
                            BBText(L10n.lookup(italian: option.label), style: BBTypography.bodyStrong)
                            BBText(L10n.lookup(italian: option.description), style: BBTypography.body, color: .bbMutedForeground)
                        }
                        .padding(BBSpacing.space3)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .overlay(RoundedRectangle.bb(BBRadius.lg).strokeBorder(Color.bbBorder, lineWidth: 1))
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(BBPressableStyle(pressedBackground: .bbMuted, shape: AnyShape(RoundedRectangle.bb(BBRadius.lg)), translate: false))
                }
            }
        }
        .task { legal = await env.session.loadLegal() }
    }
}

/// I tuoi dati (SET-037, SET-038, SET-039…041).
struct DataSection: View {
    @Bindable var model: SettingsModel
    let settings: UserSettings
    @Environment(AppEnvironment.self) private var env
    @Environment(\.bbLocale) private var locale
    @State private var export = ExportState()

    var body: some View {
        SettingsSection(title: L10n.yourData, description: L10n.downloadEverythingYouEnteredOrImpor, icon: .database) {
            switch model.dataSummary {
            case .loading: BBSkeleton(height: 112, radius: BBRadius.lg)
            case .failed: LoadError(message: L10n.unableToLoadTheDataSummary) { Task { await model.loadDataSummary() } }
            case .loaded(let summary):
                VStack(spacing: BBSpacing.space1_5) {
                    ForEach(DataSummaryItems.items(summary), id: \.label) { item in
                        HStack(alignment: .firstTextBaseline) {
                            BBText(L10n.lookup(italian: item.label), style: BBTypography.body, color: .bbMutedForeground)
                            Spacer(minLength: BBSpacing.space3)
                            BBText(BBFormat.formatNumber(Double(item.value), maximumFractionDigits: 0, locale: locale),
                                   style: BBTypography.bodyStrong.with(weight: 500).tabular)
                        }
                        .padding(.bottom, BBSpacing.space1_5)
                    }
                }
            }
            BBText(L10n.theZipArchiveContainsAllDataInJso, style: BBTypography.body, color: .bbMutedForeground)
            if !model.recentLogin || export.reauthRequired {
                ReauthPanel(model: model, email: settings.email) { export.reauthRequired = false; export.error = nil }
            } else {
                BBButton(export.running ? L10n.preparing : L10n.downloadMyData, icon: .download, isLoading: export.running) {
                    Task {
                        await DataExporter.run(env, state: $export)
                        if export.reauthRequired { model.forcedReauth = true }
                    }
                }
            }
            if let error = export.error, !export.reauthRequired { StatusLine(text: error) }
        }
        .shareSheet(file: $export.file)
    }
}

extension BBTextStyle {
    var tabular: BBTextStyle {
        BBTextStyle(role: role, size: size, lineHeight: lineHeight, weight: weight, letterSpacingEm: letterSpacingEm,
                    tabularNums: true, uppercase: uppercase, anchor: anchor)
    }
}
