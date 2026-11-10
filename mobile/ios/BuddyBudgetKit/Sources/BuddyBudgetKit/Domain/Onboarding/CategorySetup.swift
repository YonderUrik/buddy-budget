import Foundation

/// A category of the onboarding proposal (web `lib/categories/defaults.ts` + `setup.ts`). Names and descriptions are
/// Italian sources: the UI translates them with the catalog (web `localizedCategoryProposal`).
public struct CategoryProposalItem: Equatable, Sendable {
    /// Stable starter key; nil for categories added by the user.
    public var key: String?
    public var name: String
    public var type: String
    public var icon: String
    public var color: String
    public var description: String?
    public var enabled: Bool
    /// Optional starters are proposed switched off.
    public var optional: Bool

    public init(key: String?, name: String, type: String, icon: String, color: String, description: String?,
                enabled: Bool, optional: Bool) {
        self.key = key
        self.name = name
        self.type = type
        self.icon = icon
        self.color = color
        self.description = description
        self.enabled = enabled
        self.optional = optional
    }
}

/// Groups of the «Categorie» step, in the order of the Categories screen.
public struct CategorySetupGroup: Equatable, Sendable {
    public let type: String
    /// Italian source of the label.
    public let label: String
}

/// Proposal, validation and "customised" check of the onboarding category step (AUTH-030…034).
/// Same names on Android (`CategorySetup`).
public enum CategorySetup {
    public static let nameMaxLength = 40
    public static let customIcon = "package"
    public static let fallbackName = "Da categorizzare"

    public static let groups: [CategorySetupGroup] = [
        CategorySetupGroup(type: "dovuta", label: "Dovute"),
        CategorySetupGroup(type: "voluta", label: "Volute"),
        CategorySetupGroup(type: "futuro", label: "Te futuro"),
        CategorySetupGroup(type: "saltuaria", label: "Saltuarie"),
        CategorySetupGroup(type: "trasferimento", label: "Trasferimenti tra conti"),
        CategorySetupGroup(type: "entrata", label: "Entrate"),
    ]

    private static func item(_ key: String, _ name: String, _ type: String, _ icon: String, _ color: String,
                             _ description: String, optional: Bool = false) -> CategoryProposalItem {
        CategoryProposalItem(key: key, name: name, type: type, icon: icon, color: color, description: description,
                             enabled: !optional, optional: optional)
    }

    /// `buildCategoryProposal()`: the 24 starters (without the fallback) switched on, then the 5 optional ones off.
    /// `country` only changes two descriptions (web `localizedCategoryProposal`).
    public static func proposal(country: String = "IT") -> [CategoryProposalItem] {
        // Italian tax examples (F24, 730) only under the Italian rules (web #465: every country but IT).
        let de = country != "IT"
        return [
            item("affitto", "Affitto & Mutuo", "dovuta", "home", "slate", "Affitto, rata del mutuo, condominio"),
            item("bollette", "Bollette & Telefono", "dovuta", "zap", "yellow", "Luce, gas, acqua, internet, cellulare"),
            item("spesa", "Spesa", "dovuta", "shopping-cart", "green", "Supermercato, alimentari, casalinghi"),
            item("trasporti", "Trasporti", "dovuta", "car", "blue", "Carburante, mezzi pubblici, pedaggi, parcheggi, officina"),
            item("salute", "Salute", "dovuta", "cross", "rose", "Farmacia, visite, dentista, analisi"),
            item("assicurazioni", "Assicurazioni", "dovuta", "shield", "indigo", "Auto, casa, vita, salute"),
            item("rate", "Rate & Prestiti", "dovuta", "credit-card", "red", "Finanziamenti, prestiti, acquisti a rate"),
            item("ristoranti", "Ristoranti & Bar", "voluta", "utensils", "orange", "Pranzi e cene fuori, bar, caffè, consegne a domicilio"),
            item("abbonamenti", "Abbonamenti", "voluta", "tv", "purple", "Streaming, musica, app, software, giornali"),
            item("svago", "Svago", "voluta", "gamepad-2", "teal", "Cinema, concerti, hobby, giochi, libri"),
            item("benessere", "Sport & Benessere", "voluta", "dumbbell", "lime", "Palestra, sport, parrucchiere, estetista"),
            item("shopping", "Shopping", "voluta", "shopping-bag", "pink", "Vestiti, scarpe, elettronica, acquisti online"),
            item("viaggi", "Viaggi", "voluta", "plane", "cyan", "Voli, treni per le vacanze, hotel, case vacanza"),
            item("contanti", "Contanti", "voluta", "wallet", "emerald", "Prelievi al bancomat"),
            item("risparmio", "Risparmio", "futuro", "piggy-bank", "green", "Versamenti sul conto deposito o sul salvadanaio"),
            item("investimenti", "Investimenti", "futuro", "coins", "teal", "Versamenti al broker, piani di accumulo"),
            item("tasse", "Tasse & Bolli", "saltuaria", "receipt", "slate", de ? "Imposte e tributi" : "F24, IMU, TARI, bollo auto, canone"),
            item("casa", "Casa & Arredamento", "saltuaria", "sofa", "amber", "Mobili, elettrodomestici, lavori in casa"),
            item("regali", "Regali & Donazioni", "saltuaria", "gift", "pink", "Regali, ricorrenze, beneficenza"),
            item("trasferimenti", "Trasferimenti tra i miei conti", "trasferimento", "landmark", "slate", "Giroconti fra conti di tua proprietà: esclusi da entrate e spese"),
            item("stipendio", "Stipendio", "entrata", "banknote", "emerald", "Stipendio, pensione, tredicesima"),
            item("interessi", "Interessi & Dividendi", "entrata", "trending-up", "teal", "Interessi del conto deposito, dividendi e cedole"),
            item("rimborsi", "Rimborsi", "entrata", "calculator", "cyan", de ? "Resi, rimborsi fiscali, soldi restituiti" : "Resi, rimborsi del 730, soldi restituiti da amici"),
            item("altre-entrate", "Altre entrate", "entrata", "package", "slate", "Tutto ciò che non rientra nelle altre entrate"),
            item("figli", "Figli & Scuola", "dovuta", "graduation-cap", "violet", "Scuola, libri, mensa, attività dei figli", optional: true),
            item("animali", "Animali", "dovuta", "paw-print", "amber", "Cibo, veterinario, accessori", optional: true),
            item("pensione", "Pensione integrativa", "futuro", "landmark", "indigo", "Versamenti al fondo pensione", optional: true),
            item("imprevisti", "Imprevisti", "saltuaria", "alert-triangle", "yellow", "Spese che non avevi previsto", optional: true),
            item("lavoro-autonomo", "Lavoro autonomo", "entrata", "briefcase", "blue", "Fatture, prestazioni occasionali", optional: true),
        ]
    }

    /// The proposal with names and descriptions translated by `translate` (the catalog lookup of the app language).
    public static func localizedProposal(country: String, translate: (String) -> String) -> [CategoryProposalItem] {
        proposal(country: country).map { item in
            var copy = item
            copy.name = translate(item.name)
            copy.description = item.description.map(translate)
            return copy
        }
    }

    /// AUTH-033: true when anything differs from `proposal` (count, key, switch, trimmed name). Compares with the
    /// proposal in the same language (the web compares with the Italian one, so every en/de user looks "customised").
    public static func isCustomized(_ items: [CategoryProposalItem], proposal: [CategoryProposalItem]) -> Bool {
        guard items.count == proposal.count else { return true }
        return zip(proposal, items).contains { original, item in
            item.key != original.key || item.enabled != original.enabled || item.name.trimmingCharacters(in: .whitespaces) != original.name
        }
    }

    /// Why the choices aren't valid (AUTH-032): the reason as Italian source and its `{0}` value, or nil.
    public struct Problem: Equatable, Sendable {
        public let source: String
        public let value: String?
    }

    public static func validate(_ items: [CategoryProposalItem], reservedNames: [String] = [fallbackName]) -> Problem? {
        var seen = Set(reservedNames.map { $0.trimmingCharacters(in: .whitespaces).lowercased() })
        for item in items where item.enabled {
            let name = item.name.trimmingCharacters(in: .whitespaces)
            if name.isEmpty { return Problem(source: "Ogni categoria accesa deve avere un nome.", value: nil) }
            if name.utf16.count > nameMaxLength { return Problem(source: "«{0}…» è troppo lungo.", value: String(name.prefix(20))) }
            let normalized = name.lowercased()
            if seen.contains(normalized) { return Problem(source: "«{0}» c'è già.", value: name) }
            seen.insert(normalized)
        }
        return nil
    }

    /// Rename (switches the item on, like the web); returns the problem and leaves `items` unchanged when invalid.
    public static func rename(_ items: inout [CategoryProposalItem], at index: Int, to name: String) -> Problem? {
        var next = items
        next[index].name = name
        next[index].enabled = true
        if let problem = validate(next) { return problem }
        items = next
        return nil
    }

    /// Adds a user category (enabled, icon `package`, colour slate) to `type`; same rule as `rename`.
    public static func add(_ items: inout [CategoryProposalItem], type: String, name: String) -> Problem? {
        var next = items
        next.append(CategoryProposalItem(key: nil, name: name, type: type, icon: customIcon, color: "slate",
                                         description: nil, enabled: true, optional: false))
        if let problem = validate(next) { return problem }
        items = next
        return nil
    }

    /// AUTH-039 / AUTH-041: the categories to send — only when customised and valid.
    public static func payload(_ items: [CategoryProposalItem], proposal: [CategoryProposalItem]) -> [CategorySetupItem]? {
        guard isCustomized(items, proposal: proposal), validate(items) == nil else { return nil }
        return items.map { CategorySetupItem(key: $0.key, name: $0.name.trimmingCharacters(in: .whitespaces), type: $0.type, enabled: $0.enabled) }
    }

    public static func activeCount(_ items: [CategoryProposalItem]) -> Int { items.filter(\.enabled).count }
}
