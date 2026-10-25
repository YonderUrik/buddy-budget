import BuddyBudgetKit
import SwiftUI

/// Onboarding wizard (AUTH-024…043): Valuta e paese, Categorie, [Assistente], Notifiche, Conferme.
struct OnboardingScreen: View {
    @Environment(AppEnvironment.self) private var env
    @State private var model: OnboardingModel?

    var body: some View {
        AuthScaffold(showsLanguagePicker: false) {
            if let model { OnboardingContent(model: model) }
        }
        .task {
            if model == nil {
                let created = OnboardingModel(env: env)
                model = created
                await created.load()
                #if DEBUG
                if let spec = DebugLaunch.value("-BBOnboarding") { await created.applyDebug(spec) }
                #endif
            }
        }
    }
}

private struct OnboardingContent: View {
    @Bindable var model: OnboardingModel
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        VStack(alignment: .leading, spacing: BBSpacing.space8) {
            VStack(alignment: .leading, spacing: BBSpacing.space2) {
                BBText(L10n.welcome, style: .authTitle).accessibilityAddTraits(.isHeader)
                StepProgress(index: model.index, count: model.steps.count, label: L10n.onboardingSteps)
                    .padding(.top, BBSpacing.space3)
            }
            VStack(alignment: .leading, spacing: BBSpacing.space5) {
                stepContent
            }
            .id(model.step)
            .transition(.asymmetric(insertion: .offset(x: reduceMotion ? 0 : CGFloat(14 * model.direction)).combined(with: .opacity),
                                    removal: .opacity))
            .animation(.bbMotion(.bb(BBMotion.springSnappy), reduceMotion: reduceMotion), value: model.index)

            if let error = model.error { BBErrorBox(message: error) }

            VStack(spacing: BBSpacing.space2) {
                BBButton(primaryLabel, variant: .sun, size: .touch, fullWidth: true, isLoading: model.saving,
                         isDisabled: model.isLast && !model.consent.isComplete) {
                    Task { await model.next() }
                }
                if !model.isFirst {
                    BBButton(L10n.back, variant: .ghost, size: .touch, fullWidth: true, isDisabled: model.saving) { model.back() }
                }
            }
        }
    }

    private var primaryLabel: String {
        if model.isLast { return model.saving ? L10n.saving_712d0f : L10n.getStarted }
        if model.step == .categories && !model.customized { return L10n.continueWithThese }
        if model.step == .interests && !model.focus.contains(where: { model.focusOptions.contains($0) }) { return L10n.lookup(italian: "Salta") }
        return L10n.continue_
    }

    @ViewBuilder private var stepContent: some View {
        switch model.step {
        case .currency:
            StepHeading(title: L10n.whichCurrencyWouldYouLikeToUse, description: L10n.usedForBalancesTransactionsAndInves)
            LocaleFields(country: model.country, language: model.language, height: BBLayout.minTouchTarget, currency: model.currency,
                         onCountry: model.setCountry, onLanguage: model.setLanguage)
            CurrencyPicker(selection: $model.currency)
        case .interests:
            StepHeading(title: L10n.lookup(italian: "Cosa vuoi tenere sotto controllo?"),
                        description: L10n.lookup(italian: "Scegli quante cose vuoi: in Panoramica ti diciamo da dove partire. Puoi cambiarle quando vuoi."))
            FocusPicker(options: model.focusOptions,
                        value: Binding(get: { model.focus.filter { model.focusOptions.contains($0) } }, set: { model.focus = $0 }),
                        isDisabled: model.saving)
        case .categories:
            CategorySetupStep(model: model)
        case .assistant:
            StepHeading(title: L10n.wouldYouLikeHelpCategorising, description: L10n.youCanChangeYourMindAnytimeInSett)
            VStack(alignment: .leading, spacing: BBSpacing.space3) {
                BBText(L10n.whenNewTransactionsArriveFromYourB, style: BBTypography.body, color: .bbMutedForeground)
                BBText(L10n.whenTheAppIsFairlySureItAssignsT_7e182f, style: BBTypography.body, color: .bbMutedForeground)
                BBText(L10n.toDoThisWeSendOpenrouterOnlyTheC, style: BBTypography.body, color: .bbMutedForeground)
            }
            HStack(spacing: BBSpacing.space4) {
                BBText(L10n.suggestCategories, style: BBTypography.bodyStrong)
                    .frame(maxWidth: .infinity, alignment: .leading)
                BBSwitch(isOn: $model.aiEnabled, accessibilityLabel: L10n.suggestCategories)
            }
            .padding(BBSpacing.space4)
            .overlay(RoundedRectangle.bb(BBRadius.xl).strokeBorder(Color.bbBorder, lineWidth: 1))
        case .notifications:
            StepHeading(title: L10n.whichEmailsWouldYouLikeToReceive, description: L10n.allStartDisabledEachIncludesAnUnsu)
            NotificationChoicesView(preferences: $model.notifications)
            InboxPreview(preferences: model.notifications)
        case .confirmations:
            StepHeading(title: L10n.oneLastStepConfirmations, description: L10n.requiredToUseTheAppAlwaysAvailable)
            LegalConsentFields(consent: $model.consent, legal: model.legal, isDisabled: model.saving)
        }
    }
}

// MARK: - Step pieces

/// «Passo 2 di 4» + segmented bar (web `StepProgress`).
struct StepProgress: View {
    let index: Int
    let count: Int
    let label: String
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        VStack(alignment: .leading, spacing: BBSpacing.space2) {
            BBText("\(L10n.step) \(index + 1) \(L10n.of_f502e8) \(count)", style: BBTypography.caption.with(weight: 500),
                   color: .bbMutedForeground)
            HStack(spacing: BBSpacing.space1_5) {
                ForEach(0..<count, id: \.self) { i in
                    ZStack(alignment: .leading) {
                        Capsule().fill(Color.bbBorder)
                        GeometryReader { proxy in
                            Capsule().fill(Color.bbPrimary).frame(width: i <= index ? proxy.size.width : 0)
                        }
                    }
                    .frame(height: 4)
                    .animation(.bbMotion(.bb(BBMotion.springSnappy), reduceMotion: reduceMotion), value: index)
                }
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(label)
        .accessibilityValue("\(index + 1) / \(count)")
    }
}

/// Step title (font-heading text-xl medium) + optional description (text-sm muted).
struct StepHeading: View {
    let title: String
    var description: String?

    var body: some View {
        VStack(alignment: .leading, spacing: BBSpacing.space1) {
            BBText(title, style: BBTypography.sectionTitle).accessibilityAddTraits(.isHeader)
            if let description { BBText(description, style: BBTypography.body, color: .bbMutedForeground) }
        }
    }
}

/// Product country + language selects with the notes (web `LocaleFields`, shared with Settings › Preferenze).
struct LocaleFields: View {
    let country: String
    let language: String
    var height: CGFloat = BBLayout.inputHeight
    var currency: String = LocaleRules.defaultCurrency
    var isDisabled = false
    let onCountry: (String) -> Void
    let onLanguage: (String) -> Void

    var body: some View {
        // AUTH-060 / SET-017 (web #397): country and language as two rows; the language list previews dates and amounts.
        VStack(alignment: .leading, spacing: BBSpacing.space4) {
            VStack(alignment: .leading, spacing: BBSpacing.space1_5) {
                BBSelect(label: L10n.country,
                         options: LocaleRules.countries.map { ($0, L10n.lookup(italian: LocaleRules.countryLabel($0))) },
                         selection: Binding(get: { country }, set: { _ in }), height: height, isDisabled: isDisabled,
                         onChange: onCountry, leading: { AnyView(BBFlag(code: .of(LocaleRules.flagCode($0)))) })
                BBText(L10n.decidesTaxesAndAvailableFeatures, style: BBTypography.caption, color: .bbMutedForeground)
            }
            VStack(alignment: .leading, spacing: BBSpacing.space1_5) {
                LanguageSelect(country: country, language: language, currency: currency, height: height, isDisabled: isDisabled,
                               onLanguage: onLanguage)
                BBText(L10n.onlyChangesTextDatesAndNumbers, style: BBTypography.caption, color: .bbMutedForeground)
            }
            // SET-017 / AUTH-027 (web `COUNTRY_UNAVAILABLE_NOTES`): what the chosen country does not have yet.
            if let note = LocaleRules.unavailableNote(country) {
                BBText(L10n.lookup(italian: note), style: BBTypography.body, color: .bbMutedForeground)
            }
        }
    }
}

/// The language row: opens every language with today's date and a sample amount; others' languages greyed (AUTH-060).
private struct LanguageSelect: View {
    let country: String
    let language: String
    let currency: String
    let height: CGFloat
    let isDisabled: Bool
    let onLanguage: (String) -> Void

    @State private var open = false
    @Environment(\.colorScheme) private var scheme

    var body: some View {
        VStack(alignment: .leading, spacing: BBSpacing.space2) {
            BBText(L10n.language, style: BBTypography.bodyStrong.with(lineHeight: 14))
            Button { open = true } label: {
                HStack(spacing: BBSpacing.space2) {
                    BBFlag(code: Self.flag(language), size: .md)
                    BBText(LocaleRules.languageName(language), style: BBTypography.body, lineLimit: 1)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    BBIconView(.chevronDown, size: .md, color: .bbMutedForeground)
                }
                .padding(.horizontal, BBSpacing.space3)
                .frame(height: height)
                .background(RoundedRectangle.bb(BBRadius.lg).fill(scheme == .dark ? Color.bbAlphaInput30 : Color.clear))
                .overlay(RoundedRectangle.bb(BBRadius.lg).strokeBorder(Color.bbInput, lineWidth: 1))
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .bbDisabled(isDisabled)
            .accessibilityLabel(L10n.language)
            .accessibilityValue(LocaleRules.languageName(language))
        }
        .bbSheet(isPresented: $open, title: L10n.language) {
            let today = CalendarDate.of(Date(), in: .current)
            VStack(spacing: BBSpacing.space1) {
                ForEach(LocaleRules.allLanguages, id: \.self) { option in
                    let available = LocaleRules.languages(country: country).contains(option)
                    let selected = option == language
                    let hint = available ? LocaleRules.languagePreview(option, currency: currency, today: today)
                        : LocaleRules.countryOf(option).map { L10n.availableWithCountry0(L10n.lookup(italian: LocaleRules.countryLabel($0))) } ?? ""
                    Button {
                        open = false
                        if !selected { onLanguage(option) }
                    } label: {
                        HStack(spacing: BBSpacing.space3) {
                            BBFlag(code: Self.flag(option), size: .lg)
                            VStack(alignment: .leading, spacing: 0) {
                                BBText(LocaleRules.languageName(option), style: BBTypography.bodyStrong)
                                if !hint.isEmpty { BBText(hint, style: BBTypography.caption, color: .bbMutedForeground, lineLimit: 1) }
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                            if selected { BBIconView(.check, size: .md, color: .bbPrimary) }
                        }
                        .padding(.horizontal, BBSpacing.space3)
                        .padding(.vertical, BBSpacing.space2)
                        .frame(minHeight: 56)
                        .background(RoundedRectangle.bb(BBRadius.md).fill(selected ? Color.bbAlphaPrimary10 : Color.clear))
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .bbDisabled(!available)
                    .accessibilityAddTraits(selected ? [.isSelected, .isButton] : .isButton)
                }
            }
        }
    }
}

extension LanguageSelect {
    /// #397: English uses the British flag (en-GB formats).
    static func flag(_ language: String) -> BBFlag.Code {
        switch language {
        case "de": .de
        case "en": .gb
        default: .it
        }
    }
}

/// Currency tiles 2×2 (web `CurrencyPicker`): symbol, name, ISO code; selected = primary border + accent fill.
struct CurrencyPicker: View {
    @Binding var selection: String

    var body: some View {
        LazyVGrid(columns: [GridItem(.flexible(), spacing: BBSpacing.space3), GridItem(.flexible(), spacing: BBSpacing.space3)],
                  spacing: BBSpacing.space3) {
            ForEach(LocaleRules.currencies, id: \.self) { currency in
                let selected = currency == selection
                Button { selection = currency } label: {
                    VStack(alignment: .leading, spacing: BBSpacing.space1) {
                        BBText(LocaleRules.currencySymbol(currency), style: BBTypography.amountLarge.with(lineHeight: 32),
                               color: selected ? .bbPrimary : .bbForeground)
                        BBText(L10n.lookup(italian: LocaleRules.currencyLabel(currency)), style: BBTypography.bodyStrong)
                        BBText(currency, style: BBTypography.caption, color: .bbText3)
                    }
                    .padding(BBSpacing.space4)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(RoundedRectangle.bb(BBRadius.xl).fill(selected ? Color.bbAccent : Color.bbCard))
                    .overlay(RoundedRectangle.bb(BBRadius.xl).strokeBorder(selected ? Color.bbPrimary : Color.bbBorder,
                                                                           lineWidth: selected ? 2 : 1))
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityAddTraits(selected ? [.isSelected, .isButton] : .isButton)
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel(L10n.mainCurrency)
    }
}

// MARK: - Notifications step

/// Switch rows for the optional emails (web `NotificationChoices`), digest frequency when the digest is on.
struct NotificationChoicesView: View {
    @Binding var preferences: NotificationPreferences

    var body: some View {
        VStack(spacing: BBSpacing.space2) {
            ForEach(NotificationKind.onboarding, id: \.self) { kind in
                let on = kind.isOn(preferences)
                VStack(spacing: 0) {
                    HStack(spacing: BBSpacing.space3) {
                        BBIconView(BBIcon.forKey(kind.iconKey) ?? .bell, size: .md, color: on ? .bbPrimary : .bbText3)
                            .frame(width: 36, height: 36)
                            .background(RoundedRectangle.bb(BBRadius.xl).fill(on ? Color.bbAlphaPrimary10 : Color.bbMuted))
                        VStack(alignment: .leading, spacing: BBSpacing.space0_5) {
                            BBText(L10n.lookup(italian: kind.label), style: BBTypography.bodyStrong)
                            BBText(L10n.lookup(italian: kind.onboardingHint), style: BBTypography.caption, color: .bbMutedForeground)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        BBSwitch(isOn: Binding(get: { on }, set: { kind.set($0, in: &preferences) }),
                                 accessibilityLabel: L10n.lookup(italian: kind.label))
                    }
                    .padding(BBSpacing.space3_5)
                    if kind == .digest && on {
                        SegmentedControl(options: DigestFrequency.allCases.map {
                            ($0, L10n.lookup(italian: NotificationChoices.onboardingLabel($0)))
                        }, selection: $preferences.digestFrequency, accessibilityLabel: L10n.howOftenToReceiveTheSummary, stretch: true)
                        .padding([.horizontal, .bottom], BBSpacing.space3_5)
                    }
                }
                .background(RoundedRectangle.bb(BBRadius.xl).fill(on ? Color.bbAlphaPrimary5 : Color.bbCard))
                .overlay(RoundedRectangle.bb(BBRadius.xl).strokeBorder(on ? Color.bbAlphaPrimary45 : Color.bbBorder, lineWidth: 1))
            }
        }
    }
}

/// «Nella tua casella» (AUTH-037).
struct InboxPreview: View {
    let preferences: NotificationPreferences

    var body: some View {
        let items = NotificationChoices.inboxPreview(preferences)
        VStack(alignment: .leading, spacing: BBSpacing.space2) {
            HStack(spacing: BBSpacing.space1_5) {
                BBIconView(.inbox, points: 14, color: .bbText3)
                BBText(L10n.inYourInbox, style: BBTypography.caption.with(weight: 500), color: .bbText3)
            }
            if items.isEmpty {
                BBText(L10n.noOptionalEmailsYouCanEnableThemA, style: BBTypography.caption, color: .bbMutedForeground)
            } else {
                VStack(spacing: BBSpacing.space1_5) {
                    ForEach(Array(items.enumerated()), id: \.offset) { offset, item in
                        HStack(alignment: .firstTextBaseline, spacing: BBSpacing.space3) {
                            BBText(L10n.lookup(italian: item.title), style: BBTypography.caption.with(weight: 500))
                            Spacer(minLength: 0)
                            BBText(L10n.lookup(italian: item.when, Dictionary(uniqueKeysWithValues: item.whenValues.enumerated().map { (String($0.offset), $0.element) })),
                                   style: BBTypography.caption, color: .bbMutedForeground)
                                .multilineTextAlignment(.trailing)
                        }
                    }
                }
            }
        }
        .padding(BBSpacing.space3_5)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle.bb(BBRadius.xl).fill(Color.bbCard))
        .overlay(RoundedRectangle.bb(BBRadius.xl).strokeBorder(Color.bbBorder, lineWidth: 1))
    }
}

/// Dot colour of a category group (web `EXPENSE_GROUPS[type].dotClassName`).
func categoryGroupColor(_ type: String) -> Color {
    switch type {
    case "dovuta": .bbCategoryGroupDovuta
    case "voluta": .bbCategoryGroupVoluta
    case "futuro": .bbCategoryGroupFuturo
    case "saltuaria": .bbCategoryGroupSaltuaria
    case "entrata": .bbPos
    default: .bbMutedForeground
    }
}
