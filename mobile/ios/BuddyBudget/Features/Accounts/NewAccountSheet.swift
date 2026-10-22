import BuddyBudgetKit
import SwiftUI

private func t(_ source: String, _ values: [String: String] = [:]) -> String { L10n.lookup(italian: source, values) }

/// GoCardless logos are public CDN images: loaded without the session token.
private let institutionLogos = LogoLoader(baseURL: URL(string: "https://cdn.gocardless.invalid/")!) { nil }

/// «Nuovo conto» (ACC-011…022, 029…031): choice, bank picker, manual form. Twin of `NewAccountSheet` on Android.
struct NewAccountSheet: View {
    let model: NewAccountModel

    var body: some View {
        VStack(alignment: .leading, spacing: BBSpacing.space4) {
            header
            switch model.step {
            case .choice: ChoiceView(model: model)
            case .bank: BankView(model: model)
            case .manual: ManualView(model: model)
            }
        }
        .task { await model.start() }
    }

    private var header: some View {
        let (title, description): (String, String) = switch model.step {
        case .choice: ("Nuovo conto", "Come vuoi tenere aggiornato questo conto?")
        case .bank: model.renew ? ("Rinnova il collegamento", "Scegli di nuovo la tua banca per rinnovare il consenso.")
            : ("Collega la tua banca", "Scegli la banca: saldi e movimenti arrivano da soli.")
        case .manual: ("Conto manuale", "Aggiorni tu saldo e movimenti, quando vuoi.")
        }
        return SheetHeader(icon: model.step == .manual ? .pencilLine : .landmark, title: t(title), description: t(description))
    }
}

/// Dialog header (web `PanelDialogHeader`): tinted icon 40, title text-lg, description.
struct SheetHeader: View {
    let icon: BBIcon
    let title: String
    var description: String?

    var body: some View {
        HStack(alignment: .top, spacing: BBSpacing.space3) {
            BBIconBadge(icon: icon, color: .bbPrimary, diameter: 40, iconSize: 20)
            VStack(alignment: .leading, spacing: BBSpacing.space1_5) {
                BBText(title, style: BBTypography.cardTitle.with(size: 18, lineHeight: 22)).accessibilityAddTraits(.isHeader)
                if let description { BBText(description, style: BBTypography.body, color: .bbMutedForeground) }
            }
        }
    }
}

// MARK: - Choice (ACC-011…013)

private struct ChoiceView: View {
    let model: NewAccountModel

    var body: some View {
        VStack(spacing: BBSpacing.space3) {
            if let blocked = model.unavailable {
                ChoiceRow(icon: .zap, color: .bbText3, title: t("Collega la tua banca"), badge: t(blocked.badge),
                          description: t(blocked.description), unavailable: true) {}
            } else {
                ChoiceRow(icon: .zap, color: .bbPrimary, title: t("Collega la tua banca"), badge: t("Automatico"),
                          description: t("Saldi e movimenti si aggiornano da soli, in sola lettura.")) { model.choose(.bank) }
            }
            ChoiceRow(icon: .pencilLine, color: .bbSwatchIndigo, title: t("Conto manuale"),
                      description: t("Per contanti, carte prepagate o qualsiasi banca: il saldo lo aggiorni tu.")) { model.choose(.manual) }
            ChoiceRow(icon: .fileSpreadsheet, color: .bbSwatchAmber, title: t("Importa un file CSV o Excel"),
                      description: t("Carica l'estratto conto: lo leggiamo e crei il conto con i suoi movimenti.")) {
                model.onNavigate(AccountsPaths.imports)
            }
        }
    }
}

private struct ChoiceRow: View {
    let icon: BBIcon
    let color: Color
    let title: String
    var badge: String?
    let description: String
    var unavailable = false
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: BBSpacing.space3_5) {
                BBIconBadge(icon: icon, color: color, diameter: 44, iconSize: 20)
                VStack(alignment: .leading, spacing: BBSpacing.space0_5) {
                    HStack(spacing: BBSpacing.space2) {
                        BBText(title, style: BBTypography.bodyStrong.with(weight: 600))
                        if let badge {
                            BBText(badge, style: BBTypography.badge, color: unavailable ? .bbMutedForeground : .bbPrimary, lineLimit: 1)
                                .padding(.horizontal, BBSpacing.space2)
                                .padding(.vertical, BBSpacing.space0_5)
                                .background(Capsule().fill(unavailable ? Color.bbMuted : Color.bbAlphaPrimary10))
                        }
                    }
                    BBText(description, style: BBTypography.body, color: .bbMutedForeground)
                        .multilineTextAlignment(.leading)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                if !unavailable { BBIconView(.chevronRight, size: .md, color: .bbMutedForeground) }
            }
            .padding(BBSpacing.space3_5)
            .frame(minHeight: 72)
            .contentShape(Rectangle())
        }
        .buttonStyle(BBPressableStyle(background: unavailable ? Color.bbMuted.opacity(0.3) : .bbBackground,
                                      pressedBackground: Color.bbMuted.opacity(0.6), shape: AnyShape(RoundedRectangle.bb(BBRadius.xl)),
                                      translate: false))
        .overlay(RoundedRectangle.bb(BBRadius.xl).strokeBorder(Color.bbBorder, lineWidth: 1))
        .allowsHitTesting(!unavailable)
        .accessibilityAddTraits(unavailable ? [] : .isButton)
    }
}

// MARK: - Bank (ACC-014, 016…022)

private struct BankView: View {
    @Bindable var model: NewAccountModel

    var body: some View {
        VStack(alignment: .leading, spacing: BBSpacing.space4) {
            Button { model.step = .choice } label: {
                HStack(spacing: BBSpacing.space1_5) {
                    BBIconView(.arrowLeft, size: .md, color: .bbMutedForeground)
                    BBText(t("Cambia modo"), style: BBTypography.bodyStrong, color: .bbMutedForeground)
                }
                .frame(minHeight: BBLayout.minTouchTarget)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .padding(.top, -BBSpacing.space2)
            .bbDisabled(model.busy)

            HStack(alignment: .top, spacing: BBSpacing.space2_5) {
                BBIconView(.lockKeyhole, size: .md, color: .bbMutedForeground).padding(.top, 2)
                BBLinkText(parts: [
                    .text(t("Ti porto sul sito della tua banca per dare il consenso. Il collegamento è in sola lettura: BuddyBudget non vede le tue credenziali e non può muovere denaro.") + " "),
                    .link(t("Come funziona"), URL(string: ExternalLinks.security)!),
                ], style: BBTypography.body, color: .bbMutedForeground)
                .environment(\.openURL, OpenURLAction { url in
                    BankBrowser.shared.open(url)
                    return .handled
                })
            }
            .padding(BBSpacing.space3)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(RoundedRectangle.bb(BBRadius.xl).fill(Color.bbMuted.opacity(0.6)))

            BBSelect(label: t("Paese"), options: BankCountries.all.map { ($0.code, "\($0.flag) \(t($0.label))") },
                     selection: Binding(get: { model.country }, set: { model.setCountry($0) }), height: 44,
                     isDisabled: model.busy)
            BBTextField(label: t("Cerca la tua banca"), text: $model.search, placeholder: t("Es. Intesa, Fineco, N26"),
                        isDisabled: model.busy, height: 44)

            results

            if let chosen = model.chosen {
                BBText(t("Ti porto sul sito di {0}…", ["0": chosen.name]), style: BBTypography.body, color: .bbMutedForeground)
            }
            if let error = model.linkError { BBErrorBox(message: error, reportArea: .collegaBanca) }
        }
    }

    @ViewBuilder private var results: some View {
        switch model.institutions {
        case .loading:
            VStack(spacing: BBSpacing.space2) {
                ForEach(0..<5, id: \.self) { _ in BBSkeleton(height: 56, radius: BBRadius.xl) }
            }
            .accessibilityElement()
            .accessibilityLabel(t("Caricamento delle banche"))
        case .failed:
            VStack(alignment: .leading, spacing: BBSpacing.space2) {
                BBText(t("Non riesco a caricare l'elenco delle banche."), style: BBTypography.bodyStrong)
                BBText(t("Succede se la connessione cade o il servizio è occupato. Non hai perso nulla."), style: BBTypography.body,
                       color: .bbMutedForeground)
                HStack(spacing: BBSpacing.space4) {
                    Button { model.loadInstitutions() } label: {
                        BBText(t("Riprova"), style: BBTypography.bodyStrong, color: .bbPrimary).bbHitArea(height: 20)
                    }
                    .buttonStyle(.plain)
                    ReportErrorLink(area: .collegaBanca, error: "Non riesco a caricare l'elenco delle banche.")
                }
            }
            .padding(BBSpacing.space4)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(RoundedRectangle.bb(BBRadius.xl).fill(Color.bbDestructive.opacity(0.05)))
            .overlay(RoundedRectangle.bb(BBRadius.xl).strokeBorder(Color.bbDestructive.opacity(0.3), lineWidth: 1))
        case .loaded:
            let list = model.filtered
            if list.isEmpty {
                VStack(alignment: .leading, spacing: BBSpacing.space1) {
                    BBText(accountsText(InstitutionSearch.emptyTitle(query: model.search)), style: BBTypography.bodyStrong)
                    BBText(t("Controlla il nome o cambia paese.") + t(" Se non c'è, puoi tenere il conto a mano e importare i movimenti da un file."),
                           style: BBTypography.body, color: .bbMutedForeground)
                    Button { model.choose(.manual) } label: {
                        BBText(t("Aggiungi un conto manuale"), style: BBTypography.bodyStrong, color: .bbPrimary)
                            .frame(minHeight: BBLayout.minTouchTarget)
                    }
                    .buttonStyle(.plain)
                }
                .padding(BBSpacing.space4)
                .frame(maxWidth: .infinity, alignment: .leading)
                .overlay(RoundedRectangle.bb(BBRadius.xl).strokeBorder(Color.bbBorder, style: StrokeStyle(lineWidth: 1, dash: [4, 3])))
            } else {
                BBText(accountsText(InstitutionSearch.countLabel(list.count)), style: BBTypography.caption, color: .bbMutedForeground)
                LazyVStack(spacing: BBSpacing.space2) {
                    ForEach(list) { institution in
                        InstitutionRow(institution: institution, chosen: model.chosen?.id == institution.id, disabled: model.busy) {
                            Task { await model.select(institution) }
                        }
                    }
                }
                .padding(.top, -BBSpacing.space2)
                .environment(\.bbLogoLoader, institutionLogos)
            }
        }
    }
}

private struct InstitutionRow: View {
    let institution: Institution
    let chosen: Bool
    let disabled: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: BBSpacing.space3) {
                MerchantLogo(name: institution.name, logoPath: institution.logo, fallback: .building2)
                VStack(alignment: .leading, spacing: 0) {
                    BBText(institution.name, style: BBTypography.bodyStrong)
                        .multilineTextAlignment(.leading)
                    if let history = InstitutionHistory.label(institution.transactionTotalDays) {
                        BBText(accountsText(history), style: BBTypography.caption, color: .bbMutedForeground)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                if chosen { BBSpinner(size: .md, color: .bbMutedForeground) } else { BBIconView(.chevronRight, size: .md, color: .bbMutedForeground) }
            }
            .padding(.horizontal, BBSpacing.space3)
            .padding(.vertical, BBSpacing.space2)
            .frame(minHeight: 56)
            .contentShape(Rectangle())
        }
        .buttonStyle(BBPressableStyle(background: .bbBackground, pressedBackground: Color.bbMuted.opacity(0.6),
                                      shape: AnyShape(RoundedRectangle.bb(BBRadius.xl)), translate: false))
        .overlay(RoundedRectangle.bb(BBRadius.xl).strokeBorder(Color.bbBorder, lineWidth: 1))
        .opacity(disabled && !chosen ? 0.6 : 1)
        .allowsHitTesting(!disabled)
    }
}

// MARK: - Manual (ACC-029…031)

private struct ManualView: View {
    @Bindable var model: NewAccountModel
    @State private var picker = false

    private var typeOptions: [(value: String?, label: String)] {
        AccountOptions.typePresets.map { (Optional($0), t($0)) } + [(nil, t("Altro…"))]
    }

    var body: some View {
        VStack(alignment: .leading, spacing: BBSpacing.space5) {
            StepProgressBar(index: model.manualStep, count: 2, label: t("Passi del nuovo conto"))
            if model.manualStep == 0 { stepOne } else { stepTwo }
            VStack(spacing: BBSpacing.space2) {
                if model.manualStep == 0 {
                    BBButton(L10n.lookup(italian: "Continua"), size: .touch, fullWidth: true) { model.next() }
                } else {
                    BBButton(t(model.creating ? "Aggiungo il conto…" : "Aggiungi il conto"), size: .touch, fullWidth: true,
                             isLoading: model.creating) { Task { await model.create() } }
                }
                BBButton(t("Indietro"), variant: .ghost, size: .touch, fullWidth: true, isDisabled: model.creating) { model.back() }
            }
            if let error = model.createError { BBErrorBox(message: error, reportArea: .conto) }
        }
        .bbSheet(isPresented: $picker) {
            AppearancePicker(color: model.draft.color, icon: model.draft.icon) { color, icon in
                model.draft.color = color
                model.draft.icon = icon
            }
        }
    }

    @ViewBuilder private var stepOne: some View {
        StepTitle(title: t("Come si chiama il conto?"))
        BBTextField(label: t("Nome del conto"), text: Binding(get: { model.draft.name }, set: { model.draft.name = ManualAccountDraft.clampName($0) }),
                    placeholder: t("Es. Conto Intesa"), error: model.errors.name.map { t($0) }, height: 44, contentType: nil,
                    submitLabel: .next, onSubmit: { model.next() }, autofocus: true)
        VStack(alignment: .leading, spacing: BBSpacing.space1_5) {
            BBSelect(label: t("Tipo"), options: typeOptions,
                     selection: Binding(get: { model.draft.typePreset }, set: { model.draft.typePreset = $0 }), height: 44)
            if model.draft.typePreset == nil {
                BBTextField(text: $model.draft.customType, placeholder: t("Es. Cassa contanti, Wallet crypto"),
                            error: model.errors.type.map { t($0) }, height: 44)
            }
        }
    }

    @ViewBuilder private var stepTwo: some View {
        StepTitle(title: t("Quanto c'è sul conto oggi?"), description: t("Da qui in poi lo aggiornano i movimenti che registri."))
        BBTextField(label: t("Saldo di oggi"), text: $model.draft.balanceText, error: model.errors.balance.map { t($0) },
                    keyboard: .signedAmount, prefix: BBFormat.getCurrencySymbol(model.env.session.currency, locale: LocalizedStrings.shared.language.bbLocale),
                    height: 44)
        HStack(spacing: BBSpacing.space3) {
            Button { picker = true } label: {
                BBIconBadge(icon: BBIcon.account(model.draft.icon), color: .bbSwatch(model.draft.color), diameter: 40, iconSize: 20)
            }
            .buttonStyle(.plain)
            .accessibilityLabel(t("Cambia icona e colore"))
            VStack(alignment: .leading, spacing: BBSpacing.space0_5) {
                BBText(model.draft.name.trimmingCharacters(in: .whitespaces).isEmpty ? t("Il tuo conto") : model.draft.name,
                       style: BBTypography.bodyStrong, lineLimit: 1)
                BBText(t("Tocca l'icona per cambiare icona e colore (facoltativo)."), style: BBTypography.caption, color: .bbMutedForeground)
            }
        }
        .padding(BBSpacing.space3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .overlay(RoundedRectangle.bb(BBRadius.xl).strokeBorder(Color.bbBorder, lineWidth: 1))
    }
}

/// «Passo 1 di 2» and a segmented bar (web `StepProgress`).
struct StepProgressBar: View {
    let index: Int
    let count: Int
    let label: String

    var body: some View {
        VStack(alignment: .leading, spacing: BBSpacing.space2) {
            BBText(L10n.lookup(italian: "Passo {0} di {1}", ["0": String(index + 1), "1": String(count)]),
                   style: BBTypography.caption.with(weight: 500), color: .bbMutedForeground)
            HStack(spacing: BBSpacing.space1_5) {
                ForEach(0..<count, id: \.self) { i in
                    Capsule().fill(i <= index ? Color.bbPrimary : Color.bbBorder).frame(height: 4)
                }
            }
            .animation(.bb(BBMotion.springSnappy), value: index)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(label)
        .accessibilityValue(L10n.lookup(italian: "Passo {0} di {1}", ["0": String(index + 1), "1": String(count)]))
    }
}

/// Step question (web `StepHeading`): font-heading text-xl medium + optional description.
struct StepTitle: View {
    let title: String
    var description: String?

    var body: some View {
        VStack(alignment: .leading, spacing: BBSpacing.space1) {
            BBText(title, style: BBTypography.sectionTitle).accessibilityAddTraits(.isHeader)
            if let description { BBText(description, style: BBTypography.body, color: .bbMutedForeground) }
        }
    }
}

// MARK: - Icon & colour picker

/// «Colore» (16 base swatches) and «Icona» (30 icons); every tap reports the new pair.
struct AppearancePicker: View {
    @State var color: String
    @State var icon: String
    let onChange: (String, String) -> Void

    private let columns = Array(repeating: GridItem(.flexible(), spacing: BBSpacing.space1), count: 6)

    var body: some View {
        VStack(alignment: .leading, spacing: BBSpacing.space2) {
            BBText(L10n.lookup(italian: "Colore"), style: BBTypography.caption.with(weight: 500), color: .bbMutedForeground)
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: BBSpacing.space2), count: 8), spacing: BBSpacing.space2) {
                ForEach(AccountOptions.colors, id: \.self) { key in
                    Button {
                        color = key
                        onChange(color, icon)
                    } label: {
                        Circle().fill(Color.bbSwatch(key)).frame(width: 32, height: 32)
                            .padding(3)
                            .overlay(Circle().strokeBorder(color == key ? Color.bbForeground : .clear, lineWidth: 2))
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(L10n.lookup(italian: "Colore {0}", ["0": AccountOptions.colorName(key)]))
                    .accessibilityAddTraits(color == key ? .isSelected : [])
                }
            }
            BBText(L10n.lookup(italian: "Icona"), style: BBTypography.caption.with(weight: 500), color: .bbMutedForeground)
                .padding(.top, BBSpacing.space2)
            LazyVGrid(columns: columns, spacing: BBSpacing.space1) {
                ForEach(AccountOptions.icons, id: \.self) { key in
                    Button {
                        icon = key
                        onChange(color, icon)
                    } label: {
                        BBIconView(BBIcon.account(key), size: .lg, color: icon == key ? .bbAccentForeground : .bbMutedForeground)
                            .frame(maxWidth: .infinity, minHeight: 44)
                            .background(RoundedRectangle.bb(BBRadius.lg).fill(icon == key ? Color.bbAccent : .clear))
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(L10n.lookup(italian: "Icona {0}", ["0": key]))
                    .accessibilityAddTraits(icon == key ? .isSelected : [])
                }
            }
        }
    }
}
