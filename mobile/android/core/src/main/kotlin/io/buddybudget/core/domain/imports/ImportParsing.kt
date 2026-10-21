package io.buddybudget.core.domain.imports

import io.buddybudget.core.domain.format.JSNumber
import io.buddybudget.core.domain.periods.CalendarDate
import java.text.Normalizer

// Ports of the web's `lib/investments/import/csv.ts` and `values.ts` (shared by every import: the Pensione paste
// import now, the CSV/Excel imports of Phase 4). Pure, no I/O. Same names on iOS (`ImportParsing.swift`).

/** `DecimalSeparator`. */
enum class ImportDecimalSeparator(val symbol: Char) { DOT('.'), COMMA(',') }

/** `DateOrder`. */
enum class ImportDateOrder { YMD, DMY, MDY }

/** `CsvTable`: headers and rows of trimmed cells. */
data class ImportCsvTable(val delimiter: Char, val headers: List<String>, val rows: List<List<String>>)

object ImportCsv {
    val delimiters = listOf(',', ';', '\t', '|')
    private const val SAMPLE_LINES = 10

    /** `parseCsvRecords` (non-strict): logical records, quoted fields may contain new lines. */
    fun records(text: String, delimiter: Char = ','): List<List<String>> {
        val records = mutableListOf<List<String>>()
        var record = mutableListOf<String>()
        val field = StringBuilder()
        var quoted = false
        var i = 0
        while (i < text.length) {
            val c = text[i]
            if (quoted) {
                if (c == '"' && i + 1 < text.length && text[i + 1] == '"') {
                    field.append('"'); i += 1
                } else if (c == '"') {
                    quoted = false
                } else {
                    field.append(c)
                }
                i += 1
                continue
            }
            when {
                c == '"' && field.isEmpty() -> quoted = true
                c == delimiter -> { record.add(field.toString()); field.clear() }
                c == '\n' || c == '\r' -> {
                    if (c == '\r' && i + 1 < text.length && text[i + 1] == '\n') i += 1
                    record.add(field.toString()); records.add(record); record = mutableListOf(); field.clear()
                }
                else -> field.append(c)
            }
            i += 1
        }
        if (field.isNotEmpty() || record.isNotEmpty()) {
            record.add(field.toString()); records.add(record)
        }
        return records
    }

    /** `detectDelimiter`. */
    fun detectDelimiter(text: String): Char {
        val sample = text.split(Regex("\r?\n")).filter { JSNumber.trim(it).isNotEmpty() }.take(SAMPLE_LINES).joinToString("\n")
        var best = ',' to -1.0
        for (delimiter in delimiters) {
            val counts = records(sample, delimiter).map { it.size }
            val first = counts.firstOrNull() ?: continue
            if (first < 2) continue
            val consistent = counts.count { it == first }.toDouble() / counts.size
            val score = consistent * 100 + first
            if (score > best.second) best = delimiter to score
        }
        return best.first
    }

    /** `parseCsv`: strips the BOM, detects the delimiter, drops empty rows, trims cells. */
    fun parse(text: String, delimiter: Char? = null): ImportCsvTable {
        val clean = text.removePrefix("﻿")
        val chosen = delimiter ?: detectDelimiter(clean)
        val all = records(clean, chosen).map { r -> r.map { JSNumber.trim(it) } }.filter { r -> r.any { it.isNotEmpty() } }
        return ImportCsvTable(chosen, all.firstOrNull() ?: emptyList(), all.drop(1))
    }
}

object ImportValues {
    private val numberPattern = Regex("^[+-]?(\\d+\\.?\\d*|\\.\\d+)([eE][+-]?\\d+)?$")

    /** `parseNumber`. */
    fun parseNumber(raw: String, decimal: ImportDecimalSeparator): Double? {
        var text = JSNumber.trim(raw).filter { it !in " '€$£" && !it.isWhitespace() && it != ' ' }
        if (text.length >= 3 && text.take(3).all { it in 'A'..'Z' }) text = text.drop(3)
        if (text.length >= 3 && text.takeLast(3).all { it in 'A'..'Z' }) text = text.dropLast(3)
        if (text.isEmpty() || text == "-") return null
        if (text.length >= 2 && text.first() == '(' && text.last() == ')') text = "-" + text.substring(1, text.length - 1)
        val thousands = if (decimal == ImportDecimalSeparator.DOT) ',' else '.'
        text = text.filter { it != thousands }
        if (decimal == ImportDecimalSeparator.COMMA) text = text.replaceFirst(',', '.')
        if (!numberPattern.matches(text)) return null
        val value = text.toDoubleOrNull() ?: return null
        return if (value.isFinite()) value else null
    }

    /** `detectDecimalSeparator`. */
    fun detectDecimalSeparator(values: List<String>, fallback: ImportDecimalSeparator = ImportDecimalSeparator.DOT): ImportDecimalSeparator {
        var comma = 0
        var dot = 0
        for (raw in values) {
            val v = raw.filter { it in '0'..'9' || it == '.' || it == ',' }
            val lastComma = v.lastIndexOf(',')
            val lastDot = v.lastIndexOf('.')
            if (lastComma >= 0 && lastDot >= 0) {
                if (lastComma > lastDot) comma += 1 else dot += 1
            } else if (lastComma >= 0) {
                if (v.length - lastComma - 1 != 3) comma += 1
            } else if (lastDot >= 0) {
                if (v.length - lastDot - 1 != 3 || v.startsWith("0.")) dot += 1
            }
        }
        if (comma == dot) return fallback
        return if (comma > dot) ImportDecimalSeparator.COMMA else ImportDecimalSeparator.DOT
    }

    /** `parseDate`. */
    fun parseDate(raw: String, order: ImportDateOrder): String? {
        val text = JSNumber.trim(raw).split(Regex("[T\\s]")).first()
        val parts = if (text.length == 8 && text.all { it in '0'..'9' }) {
            if (order == ImportDateOrder.YMD) listOf(text.substring(0, 4), text.substring(4, 6), text.substring(6))
            else listOf(text.substring(0, 2), text.substring(2, 4), text.substring(4))
        } else {
            text.split('/', '.', '-')
        }
        if (parts.size != 3 || parts.any { it.length !in 1..4 || !it.all { c -> c in '0'..'9' } }) return null
        val n = parts.map { it.toInt() }
        val (year, month, day) = when (order) {
            ImportDateOrder.YMD -> Triple(n[0], n[1], n[2])
            ImportDateOrder.DMY -> Triple(n[2], n[1], n[0])
            ImportDateOrder.MDY -> Triple(n[2], n[0], n[1])
        }
        val fullYear = if (year < 100) 2000 + year else year
        if (fullYear !in 1900..2200 || month !in 1..12 || day < 1 || day > CalendarDate.daysInMonth(fullYear, month)) return null
        return CalendarDate(fullYear, month, day).iso
    }

    /** `detectDateOrder`: ties → dmy, then ymd, then mdy. */
    fun detectDateOrder(values: List<String>): ImportDateOrder {
        var best = ImportDateOrder.DMY to -1
        for (order in listOf(ImportDateOrder.DMY, ImportDateOrder.YMD, ImportDateOrder.MDY)) {
            val count = values.count { parseDate(it, order) != null }
            if (count > best.second) best = order to count
        }
        return best.first
    }

    /** `normalizeHeader`: lower case, no accents, only `a-z0-9`. */
    fun normalizeHeader(header: String): String =
        Normalizer.normalize(header.lowercase(), Normalizer.Form.NFD).filter { it in 'a'..'z' || it in '0'..'9' }
}
