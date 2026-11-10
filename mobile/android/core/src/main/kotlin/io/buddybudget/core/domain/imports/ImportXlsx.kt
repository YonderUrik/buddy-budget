package io.buddybudget.core.domain.imports

import io.buddybudget.core.domain.format.JSNumber
import io.buddybudget.core.domain.periods.CalendarDate
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.math.BigDecimal
import java.util.zip.ZipInputStream

// Port of the web's `lib/pension/import/xlsx.ts` (`readXlsx`) and `gridToCsv` (`lib/investments/import/fineco.ts`):
// the first sheet of an `.xlsx` file read on the device as a text grid, then turned into the same CSV text the web
// sends, so a format derived on the web reads a mobile upload identically (IMP-018, INV-093, PEN-014).
// Same names on iOS (`ImportXlsx.swift`).

/** Text grid of the first sheet: the first non-empty row is the header. */
data class ImportGrid(val headers: List<String>, val rows: List<List<String>>)

/** A file that cannot be read; [text] is the web's Italian message (catalog source). */
class ImportXlsxException(val text: String) : Exception(text)

object ImportXlsx {
    /** `XLSX_MAX_FILE_BYTES`. */
    const val MAX_FILE_BYTES = 5 * 1024 * 1024
    private const val MAX_PART_BYTES = 20 * 1024 * 1024
    /** `XLSX_MAX_ROWS`. */
    const val MAX_ROWS = 5000
    private const val EXCEL_EPOCH_OFFSET_DAYS = 25569.0
    private val builtinDateFormats = setOf(14, 15, 16, 17, 22, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 45, 46, 47, 50, 51, 52, 53, 54, 55, 56, 57, 58)

    private val rowRegex = Regex("<row\\b[^>]*?(?:/>|>([\\s\\S]*?)</row>)")
    private val cellRegex = Regex("<c\\b([^>]*?)(?:/>|>([\\s\\S]*?)</c>)")
    private val valueRegex = Regex("<v>([\\s\\S]*?)</v>")
    private val textRegex = Regex("<t(?:\\s[^>]*)?>([\\s\\S]*?)</t>")

    /** `readXlsx`: throws [ImportXlsxException] with the web's Italian message. */
    fun read(data: ByteArray): ImportGrid {
        if (data.size > MAX_FILE_BYTES) throw ImportXlsxException("Il file Excel è troppo grande")
        val files = try {
            unzip(data) { name ->
                name == "xl/sharedStrings.xml" || name == "xl/styles.xml" || name.startsWith("xl/worksheets/sheet") ||
                    name.startsWith("xl/workbook.xml") || name == "xl/_rels/workbook.xml.rels"
            }
        } catch (e: Exception) {
            throw ImportXlsxException("Il file non è un Excel (.xlsx) valido. I vecchi .xls vanno salvati come .xlsx o CSV")
        }
        val sheetPath = firstSheetPath(files) ?: throw ImportXlsxException("Non trovo nessun foglio nel file Excel")
        val strings = sharedStrings(files["xl/sharedStrings.xml"]?.decodeToString())
        val dateStyle = dateStyles(files["xl/styles.xml"]?.decodeToString())
        val sheet = files.getValue(sheetPath).decodeToString()

        val grid = mutableListOf<List<String>>()
        for (rowMatch in rowRegex.findAll(sheet)) {
            val row = mutableListOf<String>()
            val rowBody = rowMatch.groups[1]?.value ?: ""
            for (cellMatch in cellRegex.findAll(rowBody)) {
                val head = cellMatch.groups[1]?.value ?: ""
                val body = cellMatch.groups[2]?.value ?: ""
                val ref = attr(head, "r")
                val type = attr(head, "t")
                val raw = valueRegex.find(body)?.groups?.get(1)?.value ?: ""
                val text = when {
                    type == "s" -> raw.toIntOrNull()?.let { strings.getOrNull(it) } ?: ""
                    type == "inlineStr" -> textOf(body)
                    type == "str" || type == "e" || type == "b" -> decodeEntities(raw)
                    raw.isNotEmpty() -> {
                        val number = JSNumber.parse(raw)
                        val style = attr(head, "s")?.toIntOrNull() ?: 0
                        when {
                            dateStyle.getOrElse(style) { false } -> number?.let(::excelSerialToIso) ?: raw
                            number != null && number.isFinite() -> jsToString(number)
                            else -> raw
                        }
                    }
                    else -> ""
                }
                val column = ref?.let(::columnIndex) ?: row.size
                while (row.size < column) row.add("")
                val trimmed = JSNumber.trim(text)
                if (column < row.size) row[column] = trimmed else row.add(trimmed)
            }
            grid.add(row)
            if (grid.size > MAX_ROWS + 1) throw ImportXlsxException("Il foglio ha troppe righe: al massimo $MAX_ROWS")
        }
        val records = grid.filter { r -> r.any { it.isNotEmpty() } }
        return ImportGrid(records.firstOrNull() ?: emptyList(), records.drop(1))
    }

    /** `gridToCsv`: cells → CSV text with `;`, quoting cells containing `;`, `"` or a new line. */
    fun gridToCsv(grid: List<List<String>>): String {
        fun quote(cell: String) = if (cell.any { it == ';' || it == '"' || it == '\n' || it == '\r' }) "\"" + cell.replace("\"", "\"\"") + "\"" else cell
        return grid.joinToString("\n") { row -> row.joinToString(";") { quote(it) } }
    }

    /** CSV text of a sheet (headers + rows), as the web sends it. */
    fun csv(data: ByteArray): String {
        val sheet = read(data)
        return gridToCsv(listOf(sheet.headers) + sheet.rows)
    }

    /** `excelSerialToIso`. */
    fun excelSerialToIso(serial: Double): String? {
        if (!serial.isFinite() || serial < 1) return null
        val days = Math.floor(serial - EXCEL_EPOCH_OFFSET_DAYS)
        if (Math.abs(days) >= 1e8) return null
        return CalendarDate.ofEpochDay(days.toInt()).iso
    }

    /** JS `String(number)`: shortest round-trip digits, exponent form outside 1e-7 ≤ |x| < 1e21. */
    fun jsToString(value: Double): String {
        if (value.isNaN()) return "NaN"
        if (value == 0.0) return "0"
        if (value.isInfinite()) return if (value < 0) "-Infinity" else "Infinity"
        val sign = if (value < 0) "-" else ""
        val decimal = BigDecimal(java.lang.Double.toString(Math.abs(value))).stripTrailingZeros()
        val digits = decimal.unscaledValue().toString()
        val k = digits.length
        val n = k - decimal.scale()
        return when {
            n in k..21 -> sign + digits + "0".repeat(n - k)
            n in 1..21 -> sign + digits.substring(0, n) + "." + digits.substring(n)
            n in -5..0 -> sign + "0." + "0".repeat(-n) + digits
            else -> {
                val e = n - 1
                val exp = if (e < 0) "-${-e}" else "+$e"
                if (k == 1) "$sign${digits}e$exp" else "$sign${digits[0]}.${digits.substring(1)}e$exp"
            }
        }
    }

    // ---------------------------------------------------------------- XML helpers (same regular expressions as the web)

    internal fun decodeEntities(text: String): String {
        if (!text.contains('&')) return text
        return text
            .replace(Regex("&#x([0-9a-fA-F]+);")) { m -> m.groupValues[1].toIntOrNull(16)?.let { String(Character.toChars(it)) } ?: m.value }
            .replace(Regex("&#(\\d+);")) { m -> m.groupValues[1].toIntOrNull()?.let { String(Character.toChars(it)) } ?: m.value }
            .replace("&lt;", "<").replace("&gt;", ">").replace("&quot;", "\"").replace("&apos;", "'").replace("&amp;", "&")
    }

    internal fun attr(tag: String, name: String): String? =
        Regex("(?:^|\\s)" + Regex.escape(name) + "=\"([^\"]*)\"").find(tag)?.groupValues?.get(1)?.let(::decodeEntities)

    private fun textOf(xml: String): String = decodeEntities(textRegex.findAll(xml).joinToString("") { it.groupValues[1] })

    internal fun columnIndex(ref: String): Int {
        var index = 0
        for (c in ref.uppercase()) if (c in 'A'..'Z') index = index * 26 + (c.code - 64)
        return index - 1
    }

    private fun isDateFormatCode(code: String): Boolean =
        Regex("[dmyDMY]").containsMatchIn(code.replace(Regex("\"[^\"]*\"|\\[[^\\]]*\\]|\\\\."), ""))

    private fun dateStyles(xml: String?): List<Boolean> {
        xml ?: return emptyList()
        val custom = mutableMapOf<Int, Boolean>()
        for (m in Regex("<numFmt\\s[^>]*>").findAll(xml)) {
            val id = attr(m.value, "numFmtId")?.toIntOrNull() ?: continue
            custom[id] = isDateFormatCode(attr(m.value, "formatCode") ?: "")
        }
        val cellXfs = Regex("<cellXfs[^>]*>([\\s\\S]*?)</cellXfs>").find(xml)?.groupValues?.get(1) ?: ""
        return Regex("<xf\\s[^>]*>").findAll(cellXfs).map { m ->
            val id = attr(m.value, "numFmtId")?.toIntOrNull() ?: -1
            custom[id] ?: (id in builtinDateFormats)
        }.toList()
    }

    private fun sharedStrings(xml: String?): List<String> =
        xml?.let { Regex("<si(?:\\s[^>]*)?>([\\s\\S]*?)</si>").findAll(it).map { m -> textOf(m.groupValues[1]) }.toList() } ?: emptyList()

    private fun firstSheetPath(files: Map<String, ByteArray>): String? {
        val workbook = files["xl/workbook.xml"]?.decodeToString()
        val rels = files["xl/_rels/workbook.xml.rels"]?.decodeToString()
        val sheetTag = workbook?.let { Regex("<sheet\\s[^>]*>").find(it)?.value }
        val rid = sheetTag?.let { attr(it, "r:id") }
        if (rid != null && rels != null) {
            for (m in Regex("<Relationship\\s[^>]*>").findAll(rels)) {
                val target = attr(m.value, "Target")
                if (attr(m.value, "Id") == rid && target != null) {
                    val path = if (target.startsWith("/")) target.drop(1) else "xl/$target"
                    if (files.containsKey(path)) return path
                }
            }
        }
        return files.keys.sorted().firstOrNull { Regex("^xl/worksheets/sheet\\d+\\.xml$").matches(it) }
    }

    private fun unzip(data: ByteArray, filter: (String) -> Boolean): Map<String, ByteArray> {
        val out = mutableMapOf<String, ByteArray>()
        var entries = 0
        ZipInputStream(ByteArrayInputStream(data)).use { zip ->
            while (true) {
                val entry = zip.nextEntry ?: break
                entries += 1
                if (entry.isDirectory || !filter(entry.name)) continue
                val buffer = ByteArrayOutputStream()
                val chunk = ByteArray(16 * 1024)
                var skipped = false
                while (true) {
                    val read = zip.read(chunk)
                    if (read < 0) break
                    if (buffer.size() + read > MAX_PART_BYTES) { skipped = true; break }
                    buffer.write(chunk, 0, read)
                }
                if (!skipped) out[entry.name] = buffer.toByteArray()
            }
        }
        if (entries == 0) throw IllegalArgumentException("not a zip")
        return out
    }
}
