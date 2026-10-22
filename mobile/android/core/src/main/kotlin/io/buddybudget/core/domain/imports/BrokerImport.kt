package io.buddybudget.core.domain.imports

import io.buddybudget.core.data.Instrument
import io.buddybudget.core.domain.format.JSNumber
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive

// Broker-file import (07-investments §8, INV-092…105): ports of the web's `lib/investments/import/{providers,mapping,
// presets,normalize,fineco,statement-rows,messages,batch,format-metadata}.ts` and
// `components/domain/investments/import/investment-import.state.ts`. IBKR, DEGIRO and Trade Republic statements are
// parsed by the server (`POST /api/investments/import/parse`); generic, Yahoo and Fineco CSVs are read here with the
// same rules as the web (ADR 0002: no server parse endpoint exists for them yet, see api/gaps.md §5).
// Same names on iOS (`BrokerImport.swift`). Italian strings are catalog sources.

// ---------------------------------------------------------------- Providers (`providers.ts`)

enum class ImportProviderId(val raw: String) {
    InteractiveBrokers("interactive-brokers"), Degiro("degiro"), YahooPortfolio("yahoo-portfolio"),
    TradeRepublic("trade-republic"), Fineco("fineco"), Generic("generic");

    /** Parsed by the server (`/api/investments/import/parse`). */
    val isServerStatement: Boolean get() = this == InteractiveBrokers || this == Degiro || this == TradeRepublic

    companion object {
        fun of(raw: String): ImportProviderId? = entries.firstOrNull { it.raw == raw }
    }
}

/** `ImportProviderInfo`: one row of «Come ottengo il file?». */
data class ImportProviderInfo(
    val id: ImportProviderId,
    val name: String,
    val initials: String,
    val tagline: String,
    val fileLabel: String?,
    val exportSteps: List<String>,
    val note: String,
)

object ImportProviders {
    /** `IMPORT_PROVIDERS`, in the web's order. */
    val all: List<ImportProviderInfo> = listOf(
        ImportProviderInfo(
            ImportProviderId.TradeRepublic, "Trade Republic", "TR", "Investimenti e pagamenti con carta", "Transaction export.csv",
            listOf(
                "Scarica da Trade Republic l'esportazione delle transazioni: il file si chiama «Transaction export.csv».",
                "Scegli lo storico completo del conto principale, non solo l'ultimo periodo.",
                "Caricalo qui sotto così com'è, senza aprirlo e risalvarlo con Excel.",
            ),
            "Importo investimenti, pagamenti con carta, bonifici, interessi e bonus. Il saldo è calcolato dai movimenti partendo da zero: il file non contiene un saldo certificato né il numero del conto. Usa questa fonte per un solo conto Trade Republic e aggiorna sempre con lo storico completo.",
        ),
        ImportProviderInfo(
            ImportProviderId.Degiro, "DEGIRO", "DG", "Estratto conto Account.csv", "Account.csv",
            listOf(
                "Accedi a DEGIRO dal sito, con la lingua impostata su italiano.",
                "Apri Attività → Estratto conto e scegli il periodo più ampio possibile.",
                "Premi Esporta, scegli CSV e carica qui il file «Account.csv».",
            ),
            "Include movimenti, commissioni e cambi. Il file non contiene una valutazione del portafoglio né il numero del conto: usa questa fonte per un solo conto DEGIRO.",
        ),
        ImportProviderInfo(
            ImportProviderId.Fineco, "Fineco", "FB", "Movimenti Dossier Titoli (Excel)", "File Excel (.xlsx)",
            listOf(
                "In FinecoX apri il dossier titoli e vai su Movimenti.",
                "Cerca il periodo che ti serve ed esporta in Excel (.xlsx).",
                "Carica qui il file Excel scaricato.",
            ),
            "Importo acquisti, vendite e, se presenti, dividendi e cedole. Il file non ha il saldo né le posizioni, quindi la liquidità non cambia. Uso «Data operazione», non la data valuta.",
        ),
        ImportProviderInfo(
            ImportProviderId.InteractiveBrokers, "Interactive Brokers", "IB", "Activity Statement in CSV", "Activity Statement (.csv)",
            listOf(
                "Nel portale apri Rendiconti → Rendiconti di attività (Activity Statement).",
                "Scegli Annuale o Personalizzato, con il periodo che ti serve.",
                "Come formato scegli CSV e come lingua inglese, poi carica il file qui.",
            ),
            "Puoi caricare più rendiconti insieme: li ordino per conto e periodo e salto quelli già importati.",
        ),
        ImportProviderInfo(
            ImportProviderId.YahooPortfolio, "Yahoo Finance", "YF", "Export del portafoglio", "File CSV",
            listOf("Su Yahoo Finance apri il tuo portafoglio.", "Premi Altro (⋯) → Esporta portafoglio.", "Carica qui il CSV scaricato."),
            "I simboli di Yahoo sono già quelli delle quotazioni, quindi gli strumenti si abbinano da soli. Controlla l'anteprima prima di confermare.",
        ),
    )

    fun info(id: ImportProviderId): ImportProviderInfo =
        all.firstOrNull { it.id == id } ?: ImportProviderInfo(ImportProviderId.Generic, "Altro CSV", "CSV", "", null, emptyList(), "")

    private val tradeRepublicHeaders = listOf("datetime", "date", "account_type", "category", "type", "asset_class", "name", "symbol", "shares",
        "price", "amount", "fee", "tax", "currency", "description", "transaction_id")
    private val degiroHeaders = listOf("Data", "Ora", "Data Valore", "Prodotto", "ISIN", "Descrizione", "Borsa", "Variazioni", "", "Saldo", "", "ID Ordine")

    private fun firstLineCells(text: String): List<String> {
        val line = text.removePrefix("﻿").split(Regex("\r?\n"), limit = 2).first()
        return ImportCsv.records(line, ',').firstOrNull() ?: emptyList()
    }

    fun looksLikeTradeRepublic(text: String): Boolean = firstLineCells(text).let { h -> tradeRepublicHeaders.all { it in h } }

    fun looksLikeDegiro(text: String): Boolean = firstLineCells(text) == degiroHeaders

    fun looksLikeInteractiveBrokers(text: String): Boolean {
        val head = text.removePrefix("﻿").take(2000)
        return Regex("^\"?Statement\"?,\"?Header\"?,").containsMatchIn(head) && head.contains("Interactive Brokers", ignoreCase = true)
    }

    /** `detectImportProvider`. */
    fun detect(text: String): ImportProviderId? = when {
        looksLikeTradeRepublic(text) -> ImportProviderId.TradeRepublic
        looksLikeDegiro(text) -> ImportProviderId.Degiro
        FinecoImport.looksLikeFineco(text) -> ImportProviderId.Fineco
        looksLikeInteractiveBrokers(text) -> ImportProviderId.InteractiveBrokers
        ImportPresets.detect(ImportCsv.parse(text).headers)?.id == "yahoo-portfolio" -> ImportProviderId.YahooPortfolio
        else -> null
    }

    /** `providerMismatchMessage`. */
    fun mismatchMessage(chosen: ImportProviderId, detected: ImportProviderId?): String? {
        if (chosen == ImportProviderId.Generic || detected == chosen) return null
        val name = info(chosen).name
        val other = detected?.let { " Sembra invece un file di ${info(it).name}: scegli quella scheda." } ?: " Scegli un altro provider oppure «Altro CSV»."
        return "Questo file non sembra un export di $name.$other"
    }
}

// ---------------------------------------------------------------- Mapping (`mapping.ts`)

enum class ImportField(val raw: String, val label: String) {
    Date("date", "Data operazione"), Type("type", "Tipo operazione"), Symbol("symbol", "Simbolo / ticker"), Isin("isin", "ISIN"),
    Name("name", "Nome strumento"), Quantity("quantity", "Quantità"), Price("price", "Prezzo unitario"), Total("total", "Controvalore / importo"),
    Fees("fees", "Commissioni"), Taxes("taxes", "Imposte"), Currency("currency", "Valuta"), Note("note", "Note");

    companion object {
        val required = setOf(Date, Symbol, Isin, Name, Quantity, Price, Total)
        val formOrder: List<ImportField> get() = entries.filter { it in required } + entries.filter { it !in required }
        fun of(raw: String): ImportField? = entries.firstOrNull { it.raw == raw }
    }
}

object ImportOperationTypes {
    val all = listOf("acquisto", "vendita", "dividendo", "cedola", "rimborso", "split", "rettifica")
    val typeTargets = listOf("acquisto", "vendita", "dividendo", "cedola", "rimborso", "split", "ignora")
    fun label(type: String): String = when (type) {
        "acquisto" -> "Acquisto"
        "vendita" -> "Vendita"
        "dividendo" -> "Dividendo"
        "cedola" -> "Cedola"
        "rimborso" -> "Rimborso"
        "split" -> "Split"
        "rettifica" -> "Operazione sul capitale"
        "ignora" -> "Ignora la riga"
        else -> type
    }
}

/** `ImportMapping`. */
data class ImportMapping(
    val columns: Map<ImportField, Int>,
    val dateOrder: ImportDateOrder,
    val decimal: ImportDecimalSeparator,
    /** Key: cell value lower-cased → operation type or `ignora`. */
    val typeValues: Map<String, String>,
    val defaultType: String = "acquisto",
    val symbolIsYahoo: Boolean = false,
)

/** Device-storable form of an [ImportMapping]. */
@Serializable
data class StoredImportMapping(
    val columns: Map<String, Int>, val dateOrder: String, val decimal: String, val typeValues: Map<String, String>,
    val defaultType: String, val symbolIsYahoo: Boolean,
) {
    fun mapping(): ImportMapping? {
        val order = ImportDateOrder.entries.firstOrNull { it.name.lowercase() == dateOrder } ?: return null
        val sep = ImportDecimalSeparator.entries.firstOrNull { it.symbol.toString() == decimal } ?: return null
        return ImportMapping(columns.mapNotNull { (k, v) -> ImportField.of(k)?.let { it to v } }.toMap(), order, sep, typeValues, defaultType, symbolIsYahoo)
    }

    companion object {
        fun of(m: ImportMapping) = StoredImportMapping(m.columns.mapKeys { it.key.raw }, m.dateOrder.name.lowercase(), m.decimal.symbol.toString(),
            m.typeValues, m.defaultType, m.symbolIsYahoo)
    }
}

object ImportMappingRules {
    private val headerSynonyms = mapOf(
        ImportField.Date to listOf("tradedate", "dataoperazione", "dataesecuzione", "dataeseguito", "operationdate", "transactiondate", "data", "date", "datetime"),
        ImportField.Type to listOf("transactiontype", "tipooperazione", "tipo", "operazione", "segno", "side", "action", "type", "causale"),
        ImportField.Symbol to listOf("symbol", "ticker", "simbolo", "codicetitolo", "codice"),
        ImportField.Isin to listOf("isin", "codiceisin"),
        ImportField.Name to listOf("name", "nome", "titolo", "descrizione", "strumento", "instrument", "security", "asset", "prodotto"),
        ImportField.Quantity to listOf("quantity", "quantita", "qty", "quote", "shares", "units", "nominale"),
        ImportField.Price to listOf("purchaseprice", "prezzoeseguito", "prezzounitario", "executionprice", "unitprice", "prezzo", "price"),
        ImportField.Total to listOf("controvalore", "totale", "total", "importo", "amount", "ammontare", "value"),
        ImportField.Fees to listOf("commission", "commissioni", "commissione", "fees", "fee", "spese", "costi"),
        ImportField.Taxes to listOf("taxes", "imposte", "tasse", "tax"),
        ImportField.Currency to listOf("currency", "valuta", "divisa"),
        ImportField.Note to listOf("comment", "note", "nota", "notes"),
    )

    private val typeSynonyms = mapOf(
        "buy" to "acquisto", "acquisto" to "acquisto", "acq" to "acquisto", "a" to "acquisto", "b" to "acquisto", "purchase" to "acquisto",
        "compra" to "acquisto", "sottoscrizione" to "acquisto", "sell" to "vendita", "vendita" to "vendita", "ven" to "vendita", "v" to "vendita",
        "s" to "vendita", "sale" to "vendita", "dividend" to "dividendo", "dividendo" to "dividendo", "div" to "dividendo", "coupon" to "cedola",
        "cedola" to "cedola", "rimborso" to "rimborso", "redemption" to "rimborso", "maturity" to "rimborso",
    )

    fun suggestTypeValue(value: String): String = typeSynonyms[JSNumber.trim(value).lowercase()] ?: "ignora"

    fun suggestColumns(headers: List<String>): Map<ImportField, Int> {
        val normalized = headers.map(ImportValues::normalizeHeader)
        val used = mutableSetOf<Int>()
        val columns = mutableMapOf<ImportField, Int>()
        for (exact in listOf(true, false)) {
            for (field in ImportField.entries) {
                if (field in columns) continue
                for (synonym in headerSynonyms.getValue(field)) {
                    val index = normalized.indices.firstOrNull { i ->
                        i !in used && (if (exact) normalized[i] == synonym else synonym.length >= 5 && normalized[i].startsWith(synonym))
                    }
                    if (index != null) {
                        columns[field] = index
                        used.add(index)
                        break
                    }
                }
            }
        }
        return columns
    }

    fun distinctValues(table: ImportCsvTable, column: Int?): List<String> {
        column ?: return emptyList()
        return table.rows.map { JSNumber.trim(it.getOrElse(column) { "" }) }.filter { it.isNotEmpty() }.distinct()
    }

    private fun columnValues(table: ImportCsvTable, column: Int?): List<String> =
        if (column == null) emptyList() else table.rows.map { it.getOrElse(column) { "" } }.filter { JSNumber.trim(it).isNotEmpty() }

    /** `completeMapping`. */
    fun complete(
        table: ImportCsvTable,
        columns: Map<ImportField, Int>,
        dateOrder: ImportDateOrder? = null,
        decimal: ImportDecimalSeparator? = null,
        typeValues: Map<String, String> = emptyMap(),
        defaultType: String? = null,
        symbolIsYahoo: Boolean? = null,
    ): ImportMapping {
        val numeric = listOf(ImportField.Quantity, ImportField.Price, ImportField.Total, ImportField.Fees, ImportField.Taxes).flatMap { columnValues(table, columns[it]) }
        val values = LinkedHashMap<String, String>()
        for (value in distinctValues(table, columns[ImportField.Type])) values[value.lowercase()] = suggestTypeValue(value)
        values.putAll(typeValues)
        return ImportMapping(
            columns,
            dateOrder ?: ImportValues.detectDateOrder(columnValues(table, columns[ImportField.Date])),
            decimal ?: ImportValues.detectDecimalSeparator(numeric, if (table.delimiter == ';') ImportDecimalSeparator.COMMA else ImportDecimalSeparator.DOT),
            values, defaultType ?: "acquisto", symbolIsYahoo ?: false,
        )
    }

    fun missingFields(mapping: ImportMapping): List<String> {
        val c = mapping.columns
        val missing = mutableListOf<String>()
        if (ImportField.Date !in c) missing.add("la data")
        if (ImportField.Symbol !in c && ImportField.Isin !in c && ImportField.Name !in c) missing.add("lo strumento (simbolo, ISIN o nome)")
        if (ImportField.Quantity !in c) missing.add("la quantità")
        if (ImportField.Price !in c && ImportField.Total !in c) missing.add("il prezzo o il controvalore")
        return missing
    }

    fun settingColumn(mapping: ImportMapping, field: ImportField, column: Int?, table: ImportCsvTable): ImportMapping {
        val columns = mapping.columns.toMutableMap().apply { if (column == null) remove(field) else put(field, column) }
        val typeValues = LinkedHashMap(mapping.typeValues)
        if (field == ImportField.Type) {
            for (v in distinctValues(table, columns[ImportField.Type])) typeValues.putIfAbsent(v.lowercase(), suggestTypeValue(v))
        }
        return mapping.copy(columns = columns, typeValues = typeValues)
    }

    fun columnExample(table: ImportCsvTable, column: Int): String =
        table.rows.firstOrNull { JSNumber.trim(it.getOrElse(column) { "" }).isNotEmpty() }?.get(column) ?: ""

    fun storageKey(headers: List<String>): String = "bb-import-mapping:" + headers.joinToString("|") { ImportValues.normalizeHeader(it) }

    fun savedMappingIsValid(mapping: ImportMapping, headers: List<String>): Boolean = mapping.columns.values.all { it >= 0 && it < headers.size }
}

// ---------------------------------------------------------------- Presets (`presets.ts`)

class ImportPreset(val id: String, val label: String, internal val requiredHeaders: List<String>, internal val adjust: (ImportMapping) -> ImportMapping)

object ImportPresets {
    val templateHeaders = listOf("Data", "Tipo", "ISIN", "Simbolo", "Nome", "Quantità", "Prezzo", "Controvalore", "Commissioni", "Imposte", "Valuta", "Note")

    val all: List<ImportPreset> = listOf(
        ImportPreset("yahoo-portfolio", "Yahoo Finance · portafoglio", listOf("symbol", "tradedate", "purchaseprice", "quantity")) { m ->
            m.copy(dateOrder = ImportDateOrder.YMD, decimal = ImportDecimalSeparator.DOT, symbolIsYahoo = true,
                typeValues = linkedMapOf("buy" to "acquisto", "sell" to "vendita") + m.typeValues)
        },
        ImportPreset("buddybudget-template", "Modello BuddyBudget", templateHeaders.map(ImportValues::normalizeHeader)) { m ->
            m.copy(dateOrder = ImportDateOrder.DMY, decimal = ImportDecimalSeparator.COMMA, symbolIsYahoo = true)
        },
    )

    fun detect(headers: List<String>): ImportPreset? {
        val present = headers.map(ImportValues::normalizeHeader).toSet()
        return all.firstOrNull { p -> p.requiredHeaders.all { it in present } }
    }

    fun initialMapping(table: ImportCsvTable): Pair<ImportMapping, ImportPreset?> {
        val preset = detect(table.headers)
        val base = ImportMappingRules.complete(table, ImportMappingRules.suggestColumns(table.headers))
        return (preset?.adjust?.invoke(base) ?: base) to preset
    }
}

// ---------------------------------------------------------------- Rows (`normalize.ts`)

@Serializable
data class ImportIdentity(
    val key: String,
    val symbol: String? = null,
    val isin: String? = null,
    val name: String? = null,
    val currency: String? = null,
    val symbolIsYahoo: Boolean = false,
    val type: String? = null,
)

data class ImportOperation(
    val type: String,
    val date: String,
    val quantity: Double,
    val price: Double,
    val grossAmount: Double?,
    val fees: Double,
    val taxes: Double,
    val note: String?,
    val sourceCurrency: String? = null,
    val costCurrency: String? = null,
    val brokerFxToEur: Double? = null,
)

sealed interface ImportRow {
    val line: Int

    data class Ok(override val line: Int, val identity: ImportIdentity, val operation: ImportOperation, val warnings: List<String>) : ImportRow
    data class Skipped(override val line: Int, val text: String) : ImportRow
    data class Error(override val line: Int, val text: String) : ImportRow

    val isOk: Boolean get() = this is Ok
    val message: String? get() = when (this) {
        is Ok -> null
        is Skipped -> text
        is Error -> text
    }
}

data class ImportIdentityCount(val identity: ImportIdentity, val count: Int) {
    val id: String get() = identity.key
}

object ImportNormalize {
    const val NOTE_MAX_LENGTH = 500
    private val positionTypes = setOf("acquisto", "vendita", "rimborso")

    fun isValidIsin(value: String): Boolean {
        if (!Regex("^[A-Z]{2}[A-Z0-9]{9}\\d$").matches(value)) return false
        val digits = value.take(11).map { if (it.isDigit()) it.toString() else (it.code - 55).toString() }.joinToString("")
        var sum = 0
        var double = true
        for (i in digits.indices.reversed()) {
            var d = digits[i] - '0'
            if (double) {
                d *= 2
                if (d > 9) d -= 9
            }
            sum += d
            double = !double
        }
        return (10 - sum % 10) % 10 == value[11] - '0'
    }

    private fun identityOf(cell: (ImportField) -> String, symbolIsYahoo: Boolean): ImportIdentity? {
        val rawIsin = cell(ImportField.Isin).uppercase()
        val isin = rawIsin.takeIf(::isValidIsin)
        val symbol = cell(ImportField.Symbol).uppercase().ifEmpty { null }
        val name = cell(ImportField.Name).ifEmpty { null }
        val currencyText = cell(ImportField.Currency)
        val currency = if (Regex("^[A-Za-z]{3}$").matches(currencyText)) currencyText.uppercase() else null
        val key = isin?.let { "isin:$it" } ?: symbol?.let { "symbol:$it" } ?: name?.let { "name:${it.lowercase()}" } ?: return null
        return ImportIdentity(key, symbol, isin, name, currency, symbolIsYahoo)
    }

    /** `normalizeRows`. */
    fun rows(table: ImportCsvTable, mapping: ImportMapping, today: String): List<ImportRow> = table.rows.mapIndexed { index, cells ->
        val line = index + 2
        val cell = { field: ImportField -> mapping.columns[field]?.let { JSNumber.trim(cells.getOrElse(it) { "" }) } ?: "" }
        val number = { field: ImportField -> if (cell(field).isEmpty()) null else ImportValues.parseNumber(cell(field), mapping.decimal) }
        row(line, cell, number, mapping, today)
    }

    private fun row(line: Int, cell: (ImportField) -> String, number: (ImportField) -> Double?, mapping: ImportMapping, today: String): ImportRow {
        val rawType = cell(ImportField.Type)
        val target = if (rawType.isEmpty()) mapping.defaultType else mapping.typeValues[rawType.lowercase()] ?: "ignora"
        if (target == "ignora") return ImportRow.Skipped(line, "Tipo \"$rawType\" ignorato")
        val date = ImportValues.parseDate(cell(ImportField.Date), mapping.dateOrder)
            ?: return ImportRow.Error(line, if (cell(ImportField.Date).isEmpty()) "Data mancante" else "Data \"${cell(ImportField.Date)}\" non valida")
        if (date > today) return ImportRow.Error(line, "Data nel futuro")
        val identity = identityOf(cell, mapping.symbolIsYahoo) ?: return ImportRow.Error(line, "Manca lo strumento (simbolo, ISIN o nome)")
        for (field in listOf(ImportField.Quantity, ImportField.Price, ImportField.Total, ImportField.Fees, ImportField.Taxes)) {
            if (cell(field).isNotEmpty() && number(field) == null) return ImportRow.Error(line, "Numero \"${cell(field)}\" non valido")
        }
        val warnings = mutableListOf<String>()
        if (cell(ImportField.Isin).isNotEmpty() && identity.isin == null) warnings.add("ISIN \"${cell(ImportField.Isin)}\" non valido, ignorato")
        var type = target
        val signedQuantity = number(ImportField.Quantity) ?: 0.0
        if (type == "acquisto" && signedQuantity < 0) type = "vendita"
        val quantity = Math.abs(signedQuantity)
        val total = number(ImportField.Total)?.let { Math.abs(it) }
        val fees = Math.abs(number(ImportField.Fees) ?: 0.0)
        val taxes = Math.abs(number(ImportField.Taxes) ?: 0.0)
        val note = cell(ImportField.Note).take(NOTE_MAX_LENGTH).ifEmpty { null }
        if (type == "split") {
            if (!(quantity > 0)) return ImportRow.Error(line, "Rapporto dello split mancante (va nella colonna delle quote)")
            return ImportRow.Ok(line, identity, ImportOperation(type, date, quantity, 0.0, null, 0.0, 0.0, note), warnings)
        }
        if (type in positionTypes) {
            if (!(quantity > 0)) return ImportRow.Error(line, "Quantità mancante o zero")
            val price = number(ImportField.Price)?.let { Math.abs(it) } ?: total?.let { it / quantity } ?: return ImportRow.Error(line, "Prezzo mancante")
            if (price == 0.0 && type != "acquisto") return ImportRow.Error(line, "Prezzo zero su una vendita")
            if (price == 0.0) warnings.add("Prezzo zero: quote ricevute gratis (es. staking)")
            return ImportRow.Ok(line, identity, ImportOperation(type, date, quantity, price, null, fees, taxes, note), warnings)
        }
        val price = Math.abs(number(ImportField.Price) ?: 0.0)
        val gross = total ?: if (quantity > 0 && price > 0) quantity * price else null
        if (gross == null || gross == 0.0) return ImportRow.Error(line, "Importo del dividendo o della cedola mancante")
        return ImportRow.Ok(line, identity, ImportOperation(type, date, 0.0, 0.0, gross, fees, taxes, note), warnings)
    }

    /** `collectIdentities`. */
    fun identities(rows: List<ImportRow>): List<ImportIdentityCount> {
        val byKey = LinkedHashMap<String, ImportIdentityCount>()
        for (row in rows) {
            if (row !is ImportRow.Ok) continue
            val current = byKey[row.identity.key]
            byKey[row.identity.key] = if (current == null) {
                ImportIdentityCount(row.identity, 1)
            } else {
                val id = current.identity
                ImportIdentityCount(
                    id.copy(name = id.name ?: row.identity.name, symbol = id.symbol ?: row.identity.symbol, currency = id.currency ?: row.identity.currency),
                    current.count + 1,
                )
            }
        }
        return byKey.values.toList()
    }

    fun instrumentLabel(identity: ImportIdentity): String = identity.symbol ?: identity.isin ?: identity.name ?: ""

    /** `identityLabel`. */
    fun identityLabel(identity: ImportIdentity): String = listOfNotNull(identity.symbol, identity.isin, identity.name).filter { it.isNotEmpty() }.joinToString(" · ")
}

// ---------------------------------------------------------------- Fineco (`fineco.ts`)

object FinecoImport {
    private val headers = listOf("operazione", "datavaluta", "descrizione", "titolo", "isin", "segno", "quantita", "divisa", "prezzo", "controvalore")
    val tableHeaders = listOf("Data", "Tipo", "ISIN", "Nome", "Quantità", "Prezzo", "Controvalore", "Commissioni", "Valuta")
    private const val HEADER_SCAN_ROWS = 30

    private fun recordsOf(text: String): List<List<String>> {
        val clean = text.removePrefix("﻿")
        val delimiter = if (clean.take(4000).split("\n").any { it.contains(';') }) ';' else ','
        return ImportCsv.records(clean, delimiter).map { r -> r.map { JSNumber.trim(it) } }
    }

    private fun findHeaderRow(records: List<List<String>>): Int {
        for (i in 0 until minOf(records.size, HEADER_SCAN_ROWS)) {
            val present = records[i].map(ImportValues::normalizeHeader).toSet()
            if (headers.all { it in present }) return i
        }
        return -1
    }

    fun looksLikeFineco(text: String): Boolean = findHeaderRow(recordsOf(text.take(20_000))) >= 0

    private fun plainNumber(value: String): String {
        val v = JSNumber.trim(value)
        return if (v.contains(',')) v.replace(".", "").replaceFirst(',', '.') else v
    }

    private fun isoDate(value: String): String {
        val m = Regex("^(\\d{1,2})/(\\d{1,2})/(\\d{4})$").find(value) ?: return value
        return "${m.groupValues[3]}-${m.groupValues[2].padStart(2, '0')}-${m.groupValues[1].padStart(2, '0')}"
    }

    private fun operationType(description: String, sign: String): String {
        val d = description.lowercase()
        return when {
            d.contains("compravendita") -> when (sign.uppercase()) {
                "A" -> "Acquisto"
                "V" -> "Vendita"
                else -> description
            }
            d.contains("dividend") -> "Dividendo"
            d.contains("cedol") -> "Cedola"
            else -> description
        }
    }

    /** `parseFinecoTable`. */
    fun parseTable(text: String): ImportCsvTable {
        val records = recordsOf(text)
        val at = findHeaderRow(records)
        if (at < 0) throw ImportXlsxException("Non trovo la tabella dei movimenti: serve l'export «Movimenti Dossier Titoli» di Fineco")
        val rows = records.drop(at + 1).filter { r -> r.any { it.isNotEmpty() } }.map { r ->
            val cell = { i: Int -> r.getOrElse(i) { "" } }
            listOf(isoDate(cell(0)), operationType(cell(2), cell(5)), cell(4).uppercase(), cell(3), plainNumber(cell(6)), plainNumber(cell(8)),
                plainNumber(cell(10)), plainNumber(cell(11)), cell(7))
        }
        return ImportCsvTable(';', tableHeaders, rows)
    }

    fun mapping(table: ImportCsvTable): ImportMapping = ImportMappingRules.complete(
        table, ImportMappingRules.suggestColumns(table.headers), ImportDateOrder.YMD, ImportDecimalSeparator.DOT,
        mapOf("acquisto" to "acquisto", "vendita" to "vendita", "dividendo" to "dividendo", "cedola" to "cedola"), symbolIsYahoo = false,
    )
}

// ---------------------------------------------------------------- Server statements (`statement-rows.ts`)

@Serializable
data class ActivityStatement(
    val preset: String,
    val statement: Statement? = null,
    val cashMovements: List<CashMovement>? = null,
    val identities: List<ImportIdentity> = emptyList(),
    val operations: List<Operation> = emptyList(),
    val issues: List<Issue> = emptyList(),
) {
    @Serializable
    data class Issue(val line: Int, val section: String, val severity: String, val message: String)

    @Serializable
    data class CashMovement(val line: Int, val date: String, val currency: String, val amount: Double, val externalId: String, val description: String)

    @Serializable
    data class Operation(
        val key: String, val line: Int, val type: String, val date: String, val quantity: Double, val price: Double,
        val grossAmount: Double? = null, val fees: Double = 0.0, val taxes: Double = 0.0, val note: String? = null, val sourceCurrency: String? = null,
    )

    @Serializable
    data class Statement(val account: String, val from: String, val to: String, val issues: List<String> = emptyList())

    val provider: ImportProviderId get() = ImportProviderId.of(preset) ?: ImportProviderId.InteractiveBrokers

    val isEmpty: Boolean get() = operations.isEmpty() && cashMovements.orEmpty().isEmpty() && issues.none { it.severity == "error" }

    /** `statementToRows`. */
    val rows: List<ImportRow>
        get() {
            val byKey = identities.associateBy { it.key }
            val rows = mutableListOf<ImportRow>()
            for (op in operations) {
                val identity = byKey[op.key] ?: continue
                rows.add(ImportRow.Ok(op.line, identity,
                    ImportOperation(op.type, op.date, op.quantity, op.price, op.grossAmount, op.fees, op.taxes, op.note, op.sourceCurrency), emptyList()))
            }
            for (issue in issues) if (issue.severity == "error") rows.add(ImportRow.Error(issue.line, "${issue.section}: ${issue.message}"))
            return rows.sortedBy { it.line }
        }

    val warnings: List<Issue> get() = issues.filter { it.severity == "warning" }
}

// ---------------------------------------------------------------- Messages (`messages.ts`)

data class ExplainedMessage(val text: String, val hint: String? = null)

object ImportMessages {
    private const val CHECK_FILE = "controlla quel valore nel file, oppure riesporta il file dal broker senza modificarlo."
    private val fieldLabels = mapOf(
        "amount" to "importo", "price" to "prezzo", "shares" to "quantità", "fee" to "commissione", "tax" to "imposta", "fx_rate" to "cambio",
        "datetime" to "data e ora", "date" to "data", "currency" to "valuta", "isin" to "ISIN", "transaction_id" to "identificativo dell'operazione",
    )

    /** `explainRowMessage`. */
    fun explainRow(message: String): ExplainedMessage {
        Regex("^Tipo \"(.*)\" ignorato$").find(message)?.let { return ExplainedMessage("«${it.groupValues[1]}» non è un acquisto, una vendita né un dividendo: la salto.") }
        Regex("^Data \"(.*)\" non valida$").find(message)?.let {
            return ExplainedMessage("La data «${it.groupValues[1]}» non esiste.", "correggila nel file (per esempio 31/02 non è un giorno valido) oppure togli la riga.")
        }
        when (message) {
            "Vende più quote di quelle possedute a quella data" -> return ExplainedMessage(
                "Questa vendita supera le quote che avevi a quella data.",
                "probabilmente mancano acquisti precedenti: importa prima lo storico completo (o aggiungi l'acquisto da «Registra») e riprova, oppure escludi lo strumento al passo Strumenti.",
            )
            "Data mancante" -> return ExplainedMessage("La riga non ha la data.", "compila la data nel file oppure togli la riga.")
            "Data nel futuro" -> return ExplainedMessage("La data è nel futuro.", "controlla l'anno nel file: si importano solo operazioni già avvenute.")
            "Manca lo strumento (simbolo, ISIN o nome)" -> return ExplainedMessage("La riga non dice di quale strumento si tratta.", "compila almeno uno tra simbolo, ISIN e nome.")
            "Quantità mancante o zero" -> return ExplainedMessage("La quantità manca o è zero.", "compilala nel file oppure togli la riga.")
            "Prezzo mancante" -> return ExplainedMessage("Il prezzo manca.", "compilalo nel file oppure togli la riga.")
            "Prezzo zero su una vendita" -> return ExplainedMessage("Una vendita ha prezzo zero.", "controlla il prezzo nel file: solo gli acquisti possono essere gratuiti.")
            "Importo del dividendo o della cedola mancante" -> return ExplainedMessage("Manca l'importo del dividendo o della cedola.", "compila la colonna dell'importo oppure togli la riga.")
            "Rapporto dello split mancante (va nella colonna delle quote)" -> return ExplainedMessage("Manca il rapporto dello split.", "scrivilo nella colonna delle quantità (per esempio 2 per uno split 2 a 1).")
        }
        Regex("^Numero \"(.*)\" non valido$").find(message)?.let {
            return ExplainedMessage("«${it.groupValues[1]}» non è un numero.",
                "se il numero è giusto, controlla il separatore dei decimali in «Come leggo le colonne»; altrimenti correggilo nel file.")
        }
        Regex("^(?:Riga (\\d+): )?([a-z_]+) non valido$").find(message)?.let { m ->
            val label = fieldLabels[m.groupValues[2]]
            if (label != null) {
                val line = m.groups[1]?.value
                return if (line != null) ExplainedMessage("Alla riga $line il campo «$label» non contiene un valore valido.", CHECK_FILE)
                else ExplainedMessage("Il campo «$label» non contiene un valore valido.", CHECK_FILE)
            }
        }
        Regex("^(?:Riga (\\d+): )?numero colonne non valido$").find(message)?.let { m ->
            val line = m.groups[1]?.value
            return ExplainedMessage(if (line != null) "La riga $line ha un numero di colonne diverso dalle altre." else "Una riga ha un numero di colonne diverso dalle altre.", CHECK_FILE)
        }
        Regex("^Riga (\\d+): (.*)$").find(message)?.let { m ->
            var text = "Riga ${m.groupValues[1]}: ${m.groupValues[2]}."
            if (text.endsWith("..")) text = text.dropLast(1)
            return ExplainedMessage(text, CHECK_FILE)
        }
        return ExplainedMessage(message)
    }

    /** `explainFileError`. */
    fun explainFile(message: String): ExplainedMessage {
        if (message.startsWith("Questo file non sembra un export di ")) {
            val text = message.replace(Regex(" (Sembra invece|Scegli un altro).*$"), "")
            val other = Regex("Sembra invece un file di (.+?):").find(message)?.groupValues?.get(1)
            return if (other != null) ExplainedMessage(text, "Scegli la scheda $other, oppure tocca di nuovo la scheda scelta per lasciar riconoscere il formato al file.")
            else ExplainedMessage(text, "Scegli il broker giusto, «Altro CSV» o lascia riconoscere il formato al file.")
        }
        if (message == "Il file non sembra un CSV con intestazioni e almeno una riga") {
            return ExplainedMessage("Non riesco a leggere questo file.", "serve un CSV o un Excel con una riga di intestazioni e almeno un'operazione. Non vanno bene PDF, immagini o file vuoti.")
        }
        if (message == "Nel file Fineco non ci sono movimenti da importare") {
            return ExplainedMessage("Nel file di Fineco non ci sono movimenti.", "riesporta i movimenti del dossier titoli con un periodo in cui ci sono operazioni.")
        }
        if (message.startsWith("Nel rendiconto non ci sono acquisti")) {
            return ExplainedMessage("Nel rendiconto non ci sono acquisti, vendite o dividendi di azioni ed ETF da importare.", "riesporta il rendiconto con un periodo più ampio.")
        }
        if (message.startsWith("Seleziona al massimo")) return ExplainedMessage(message, "importa i file in più volte.")
        if (message.startsWith("Ogni file deve essere più piccolo")) return ExplainedMessage(message, "riesporta il file con un periodo più breve.")
        if (message.startsWith("La selezione supera")) return ExplainedMessage(message, "importa i file in più volte.")
        return explainRow(message)
    }
}

// ---------------------------------------------------------------- Batch (`batch.ts`)

data class PreparedStatementFile(val name: String, val text: String, val parsed: ActivityStatement)

object ImportBatch {
    const val MAX_FILES = 20
    const val MAX_BYTES = 25 * 1024 * 1024
    const val MAX_FILE_BYTES = 5 * 1024 * 1024
    const val MAX_IDENTITIES = 50
    const val MAX_OPERATIONS = 5000

    /** `validateImportFiles` (INV-093). */
    fun validate(sizes: List<Long>): String? = when {
        sizes.size > MAX_FILES -> "Seleziona al massimo $MAX_FILES file alla volta."
        sizes.any { it > MAX_FILE_BYTES } -> "Ogni file deve essere più piccolo di 5 MB."
        sizes.sum() > MAX_BYTES -> "La selezione supera 25 MB. Seleziona meno file."
        else -> null
    }

    /** `orderStatementFiles`. */
    fun order(files: List<PreparedStatementFile>): List<PreparedStatementFile> {
        for (file in files) {
            if (file.parsed.operations.isEmpty() && file.parsed.cashMovements.orEmpty().isEmpty()) {
                throw ImportXlsxException("${file.name}: nessuna operazione da importare. Carica un rendiconto con acquisti, vendite o proventi.")
            }
            val statement = file.parsed.statement ?: throw ImportXlsxException("${file.name}: serve un rendiconto completo.")
            val errors = statement.issues + file.parsed.issues.filter { it.severity == "error" }.map { it.message }
            if (errors.isNotEmpty()) throw ImportXlsxException("${file.name}: ${errors.first()}")
        }
        return files.sortedWith(compareBy<PreparedStatementFile>({ if (it.parsed.preset == "degiro") 1 else 0 },
            { it.parsed.statement!!.account }, { it.parsed.statement!!.from }, { it.parsed.statement!!.to }))
    }
}

// ---------------------------------------------------------------- Instrument choices (`investment-import.state.ts`)

sealed interface ImportMatch {
    data class Known(val instrument: Instrument) : ImportMatch
    data class Proposal(val input: JsonElement, val label: String, val detail: String, val type: String, val confidence: String, val source: String) : ImportMatch
    data class None(val reason: String) : ImportMatch
}

sealed interface InstrumentChoice {
    data class Known(val instrument: Instrument) : InstrumentChoice
    data class Create(val input: JsonElement, val label: String, val detail: String, val type: String, val confidence: String, val source: String) : InstrumentChoice
    data class Skip(val reason: String) : InstrumentChoice

    val isUsable: Boolean get() = this !is Skip

    companion object {
        /** `choiceFromMatch`. */
        fun of(match: ImportMatch): InstrumentChoice = when (match) {
            is ImportMatch.Known -> Known(match.instrument)
            is ImportMatch.Proposal -> Create(match.input, match.label, match.detail, match.type, match.confidence, match.source)
            is ImportMatch.None -> Skip(match.reason)
        }
    }
}

enum class ChoiceTone { Ready, Check, Missing, Manual }

data class ChoiceStatus(val tone: ChoiceTone, val title: String, val text: String)

object ImportChoices {
    fun attentionRank(choice: InstrumentChoice?): Int = when (choice) {
        null, is InstrumentChoice.Skip -> 0
        is InstrumentChoice.Create -> if (choice.confidence == "guess") 1 else 2
        is InstrumentChoice.Known -> 2
    }

    /** `describeChoice`. */
    fun describe(choice: InstrumentChoice?): ChoiceStatus = when (choice) {
        null, is InstrumentChoice.Skip ->
            if ((choice as? InstrumentChoice.Skip)?.reason == "unavailable") {
                ChoiceStatus(ChoiceTone.Missing, "Fonti non raggiungibili", "Non sono riuscito a cercarlo ora. Cercalo qui sotto oppure lascialo fuori dall'import.")
            } else {
                ChoiceStatus(ChoiceTone.Missing, "Non trovato", "Non l'ho trovato né tra i tuoi strumenti né sulle fonti di prezzo. Cercalo qui sotto oppure lascialo fuori dall'import.")
            }
        is InstrumentChoice.Known -> ChoiceStatus(
            ChoiceTone.Ready, "Già tra i tuoi strumenti",
            if (choice.instrument.priceMode == "manuale" && choice.instrument.isin != null) "Ha i prezzi manuali: durante l'import provo a collegare la quotazione automatica."
            else "Uso quello che hai già: le operazioni si aggiungono alla sua storia.",
        )
        is InstrumentChoice.Create -> when {
            choice.source == "manuale" -> ChoiceStatus(ChoiceTone.Manual, "Nuovo, con i prezzi del broker",
                "Non c'è una quotazione automatica compatibile (per esempio perché è in un'altra valuta): lo aggiungo con i prezzi del file e potrai collegarla dopo.")
            choice.confidence == "guess" -> ChoiceStatus(ChoiceTone.Check, "Da controllare",
                "Ho scelto la quotazione più probabile tra più risultati: verifica che sia quella giusta, o cambiala.")
            else -> ChoiceStatus(ChoiceTone.Ready, "Nuovo, collegato in automatico", "Lo aggiungo ai tuoi strumenti con la quotazione trovata, e scarico i prezzi storici.")
        }
    }

    fun typeLabel(type: String): String = when (type) {
        "etf" -> "ETF"
        "azione" -> "Azione"
        "obbligazione" -> "Obbligazione / BTP"
        "fondo" -> "Fondo comune"
        "crypto" -> "Crypto"
        "etc" -> "ETC (materie prime)"
        else -> type
    }
}

sealed interface ImportInstrumentSelection {
    val key: String
    data class Existing(override val key: String, val instrumentId: String) : ImportInstrumentSelection
    data class Create(override val key: String, val input: JsonElement) : ImportInstrumentSelection
}

data class ImportRequestOperation(val key: String, val line: Int, val operation: ImportOperation)

/** `RunImportInput` (POST /api/investments/import). */
data class RunImportRequest(
    val dryRun: Boolean,
    val preset: String?,
    val instruments: List<ImportInstrumentSelection>,
    val operations: List<ImportRequestOperation>,
    val statementCsv: String? = null,
    val portfolioId: String? = null,
    val formatMetadata: JsonElement? = null,
) {
    fun json(): JsonObject {
        val body = linkedMapOf<String, JsonElement>(
            "dryRun" to JsonPrimitive(dryRun),
            "preset" to (preset?.let(::JsonPrimitive) ?: JsonNull),
            "instruments" to JsonArray(instruments.map {
                when (it) {
                    is ImportInstrumentSelection.Existing -> JsonObject(mapOf("key" to JsonPrimitive(it.key), "instrumentId" to JsonPrimitive(it.instrumentId)))
                    is ImportInstrumentSelection.Create -> JsonObject(mapOf("key" to JsonPrimitive(it.key), "create" to it.input))
                }
            }),
            "operations" to JsonArray(operations.map { op ->
                val o = op.operation
                val m = linkedMapOf<String, JsonElement>(
                    "key" to JsonPrimitive(op.key), "line" to JsonPrimitive(op.line), "type" to JsonPrimitive(o.type), "date" to JsonPrimitive(o.date),
                    "quantity" to JsonPrimitive(o.quantity), "price" to JsonPrimitive(o.price),
                    "grossAmount" to (o.grossAmount?.let(::JsonPrimitive) ?: JsonNull), "fees" to JsonPrimitive(o.fees), "taxes" to JsonPrimitive(o.taxes),
                    "note" to (o.note?.let(::JsonPrimitive) ?: JsonNull),
                )
                o.sourceCurrency?.let { m["sourceCurrency"] = JsonPrimitive(it) }
                JsonObject(m)
            }),
        )
        statementCsv?.let { body["statementCsv"] = JsonPrimitive(it) }
        portfolioId?.let { body["portfolioId"] = JsonPrimitive(it) }
        formatMetadata?.let { body["formatMetadata"] = it }
        return JsonObject(body)
    }

    companion object {
        /** `buildImportRequest`. */
        fun build(rows: List<ImportRow>, choices: Map<String, InstrumentChoice>, excluded: Set<String>, dryRun: Boolean, preset: String?): RunImportRequest? {
            val instruments = choices.keys.sorted().filter { it !in excluded }.mapNotNull { key ->
                when (val choice = choices.getValue(key)) {
                    is InstrumentChoice.Known -> ImportInstrumentSelection.Existing(key, choice.instrument.id)
                    is InstrumentChoice.Create -> ImportInstrumentSelection.Create(key, choice.input)
                    is InstrumentChoice.Skip -> null
                }
            }
            val included = instruments.map { it.key }.toSet()
            val operations = rows.filterIsInstance<ImportRow.Ok>().filter { it.identity.key in included }
                .map { ImportRequestOperation(it.identity.key, it.line, it.operation) }
            if (operations.isEmpty()) return null
            return RunImportRequest(dryRun, preset, instruments, operations)
        }
    }
}

object ImportFormatMetadata {
    /** `mappedFormatMetadata`. */
    fun mapped(table: ImportCsvTable, mapping: ImportMapping, provider: ImportProviderId?): JsonObject {
        val institution = if (provider != null && provider != ImportProviderId.Generic) {
            JsonObject(mapOf("name" to JsonPrimitive(ImportProviders.info(provider).name), "evidence" to JsonPrimitive("recognized_format")))
        } else {
            JsonObject(mapOf("name" to JsonNull, "evidence" to JsonPrimitive("unknown")))
        }
        val delimiter = when (table.delimiter) {
            ',', ';', '\t', '|' -> table.delimiter.toString()
            else -> "unknown"
        }
        val columns = table.headers.mapIndexed { index, name ->
            val trimmed = JSNumber.trim(name)
            val maps = ImportField.entries.filter { mapping.columns[it] == index }.map { JsonPrimitive(if (it == ImportField.Total) "grossAmount" else it.raw) }
            JsonObject(mapOf("section" to JsonNull, "index" to JsonPrimitive(index), "name" to (if (trimmed.isEmpty()) JsonNull else JsonPrimitive(trimmed)),
                "mapsTo" to JsonArray(maps)))
        }
        return JsonObject(mapOf("version" to JsonPrimitive(1), "institution" to institution, "delimiter" to JsonPrimitive(delimiter), "columns" to JsonArray(columns)))
    }
}
