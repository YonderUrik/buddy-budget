package io.buddybudget.core.domain.onboarding

import io.buddybudget.core.data.CategorySetupItem

/**
 * A category of the onboarding proposal (web `lib/categories/defaults.ts` + `setup.ts`). Names and descriptions are
 * Italian sources: the UI translates them with the catalog (web `localizedCategoryProposal`).
 */
data class CategoryProposalItem(
    /** Stable starter key; null for categories added by the user. */
    val key: String?,
    val name: String,
    val type: String,
    val icon: String,
    val color: String,
    val description: String?,
    val enabled: Boolean,
    /** Optional starters are proposed switched off. */
    val optional: Boolean,
)

/** Groups of the «Categorie» step, in the order of the Categories screen. */
data class CategorySetupGroup(val type: String, /** Italian source of the label. */ val label: String)

/** Proposal, validation and "customised" check of the onboarding category step (AUTH-030…034). Same names on iOS. */
object CategorySetup {
    const val NAME_MAX_LENGTH = 40
    const val CUSTOM_ICON = "package"
    const val FALLBACK_NAME = "Da categorizzare"

    val groups = listOf(
        CategorySetupGroup("dovuta", "Dovute"),
        CategorySetupGroup("voluta", "Volute"),
        CategorySetupGroup("futuro", "Te futuro"),
        CategorySetupGroup("saltuaria", "Saltuarie"),
        CategorySetupGroup("trasferimento", "Trasferimenti tra conti"),
        CategorySetupGroup("entrata", "Entrate"),
    )

    private fun item(key: String, name: String, type: String, icon: String, color: String, description: String, optional: Boolean = false) =
        CategoryProposalItem(key, name, type, icon, color, description, enabled = !optional, optional = optional)

    /**
     * `buildCategoryProposal()`: the 24 starters (without the fallback) switched on, then the 5 optional ones off.
     * `country` only changes two descriptions (web `localizedCategoryProposal`).
     */
    fun proposal(country: String = "IT"): List<CategoryProposalItem> {
        val de = country == "DE"
        return listOf(
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
            item("tasse", "Tasse & Bolli", "saltuaria", "receipt", "slate", if (de) "Imposte e tributi" else "F24, IMU, TARI, bollo auto, canone"),
            item("casa", "Casa & Arredamento", "saltuaria", "sofa", "amber", "Mobili, elettrodomestici, lavori in casa"),
            item("regali", "Regali & Donazioni", "saltuaria", "gift", "pink", "Regali, ricorrenze, beneficenza"),
            item("trasferimenti", "Trasferimenti tra i miei conti", "trasferimento", "landmark", "slate", "Giroconti fra conti di tua proprietà: esclusi da entrate e spese"),
            item("stipendio", "Stipendio", "entrata", "banknote", "emerald", "Stipendio, pensione, tredicesima"),
            item("interessi", "Interessi & Dividendi", "entrata", "trending-up", "teal", "Interessi del conto deposito, dividendi e cedole"),
            item("rimborsi", "Rimborsi", "entrata", "calculator", "cyan", if (de) "Resi, rimborsi fiscali, soldi restituiti" else "Resi, rimborsi del 730, soldi restituiti da amici"),
            item("altre-entrate", "Altre entrate", "entrata", "package", "slate", "Tutto ciò che non rientra nelle altre entrate"),
            item("figli", "Figli & Scuola", "dovuta", "graduation-cap", "violet", "Scuola, libri, mensa, attività dei figli", optional = true),
            item("animali", "Animali", "dovuta", "paw-print", "amber", "Cibo, veterinario, accessori", optional = true),
            item("pensione", "Pensione integrativa", "futuro", "landmark", "indigo", "Versamenti al fondo pensione", optional = true),
            item("imprevisti", "Imprevisti", "saltuaria", "alert-triangle", "yellow", "Spese che non avevi previsto", optional = true),
            item("lavoro-autonomo", "Lavoro autonomo", "entrata", "briefcase", "blue", "Fatture, prestazioni occasionali", optional = true),
        )
    }

    /** The proposal with names and descriptions translated by [translate] (the catalog lookup of the app language). */
    fun localizedProposal(country: String, translate: (String) -> String): List<CategoryProposalItem> =
        proposal(country).map { it.copy(name = translate(it.name), description = it.description?.let(translate)) }

    /**
     * AUTH-033: true when anything differs from [proposal] (count, key, switch, trimmed name). Compares with the
     * proposal in the same language (the web compares with the Italian one, so every en/de user looks "customised").
     */
    fun isCustomized(items: List<CategoryProposalItem>, proposal: List<CategoryProposalItem>): Boolean {
        if (items.size != proposal.size) return true
        return proposal.zip(items).any { (original, item) ->
            item.key != original.key || item.enabled != original.enabled || item.name.trim() != original.name
        }
    }

    /** Why the choices aren't valid (AUTH-032): the reason as Italian source and its `{0}` value. */
    data class Problem(val source: String, val value: String?)

    fun validate(items: List<CategoryProposalItem>, reservedNames: List<String> = listOf(FALLBACK_NAME)): Problem? {
        val seen = reservedNames.map { it.trim().lowercase() }.toMutableSet()
        for (item in items.filter { it.enabled }) {
            val name = item.name.trim()
            if (name.isEmpty()) return Problem("Ogni categoria accesa deve avere un nome.", null)
            if (name.length > NAME_MAX_LENGTH) return Problem("«{0}…» è troppo lungo.", name.take(20))
            val normalized = name.lowercase()
            if (normalized in seen) return Problem("«{0}» c'è già.", name)
            seen += normalized
        }
        return null
    }

    /** Rename (switches the item on, like the web): the new list, or the problem when invalid. */
    fun rename(items: List<CategoryProposalItem>, index: Int, name: String): Pair<List<CategoryProposalItem>, Problem?> {
        val next = items.mapIndexed { i, item -> if (i == index) item.copy(name = name, enabled = true) else item }
        val problem = validate(next)
        return (if (problem == null) next else items) to problem
    }

    /** Adds a user category (enabled, icon `package`, colour slate) to [type]; same rule as [rename]. */
    fun add(items: List<CategoryProposalItem>, type: String, name: String): Pair<List<CategoryProposalItem>, Problem?> {
        val next = items + CategoryProposalItem(null, name, type, CUSTOM_ICON, "slate", null, enabled = true, optional = false)
        val problem = validate(next)
        return (if (problem == null) next else items) to problem
    }

    /** AUTH-039 / AUTH-041: the categories to send — only when customised and valid. */
    fun payload(items: List<CategoryProposalItem>, proposal: List<CategoryProposalItem>): List<CategorySetupItem>? {
        if (!isCustomized(items, proposal) || validate(items) != null) return null
        return items.map { CategorySetupItem(it.key, it.name.trim(), it.type, it.enabled) }
    }

    fun activeCount(items: List<CategoryProposalItem>): Int = items.count { it.enabled }
}
