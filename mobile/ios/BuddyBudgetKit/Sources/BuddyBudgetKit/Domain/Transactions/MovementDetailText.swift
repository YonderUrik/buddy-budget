import Foundation

/// Sentences of the movement detail (TX-064…073, web #455 `lib/transactions/detail-text.ts`): where the movement came
/// from, who chose its category and what «Chiedi all'AI» answered. Italian catalog sources; `tr` translates a source
/// with its `{0}` values, so every language reads as on the web. Same names on Android (`MovementDetailText`).
public enum MovementDetailText {
    public typealias Translate = CategorizationText.Translate

    /// TX-069: where the movement came from, in one short sentence.
    public static func originText(_ origin: MovementOrigin, tr: Translate) -> String {
        switch origin.kind {
        case "banca":
            if let name = origin.institution, !name.isEmpty { return tr("Dalla banca collegata, {0}", ["0": name]) }
            return tr("Dalla banca collegata", [:])
        case "file":
            if let format = origin.format, !format.isEmpty { return tr("Da un file importato, formato «{0}»", ["0": format]) }
            return tr("Da un file importato", [:])
        case "broker": return tr("Dall'estratto conto di {0}", ["0": origin.broker ?? ""])
        case "esempio": return tr("Dai dati d'esempio", [:])
        default: return tr("Aggiunto da te", [:])
        }
    }

    /// TX-067: who chose the category — one of the user's rules (named when it still matches), the bank's category in an
    /// imported file, the app from past choices or the AI, or the user. Nil when nothing is known (legacy rows) or the
    /// movement is still on the fallback, whose name already says so.
    public static func categoryOriginText(_ source: CategorySource?, confidence: Double?, rule: DetailRule?, uncategorized: Bool,
                                          bankCategory: String?, tr: Translate) -> String? {
        if uncategorized { return nil }
        switch source {
        case .utente: return tr("Scelta da te", [:])
        case .regola:
            guard let rule else { return CategorizationText.autoOriginDescription(.regola, confidence: nil, bankCategory: nil, tr: tr) }
            return rule.matchType == "contains"
                ? tr("Messa dalla tua regola: il testo contiene «{0}»", ["0": rule.pattern])
                : tr("Messa dalla tua regola per «{0}»", ["0": rule.pattern])
        case .banca, .storico, .assistente:
            return CategorizationText.autoOriginDescription(source, confidence: confidence, bankCategory: bankCategory, tr: tr)
        default: return nil
        }
    }

    /// TX-071: «12 movimenti nell'ultimo anno».
    public static func merchantCountSource(_ count: Int) -> (String, [String: String]) {
        ("{0} movimenti nell'ultimo anno", ["0": String(count)])
    }

    /// What «Chiedi all'AI» says when it has no category to propose (TX-068); nil for an `ok` answer.
    public static func aiNoAnswerSource(_ status: String) -> String? {
        switch status {
        case "ok": return nil
        case "blocked": return "Sembra un trasferimento o un pagamento a una persona: per riservatezza non lo mandiamo all'AI."
        case "limited": return "Hai chiesto molte volte nell'ultima ora: riprova più tardi."
        case "disabled": return "L'assistente per le categorie è spento."
        default: return "L'AI non ha risposto. Riprova tra poco."
        }
    }

    /// The answer of «Chiedi all'AI» as the detail shows it.
    public enum AiAnswer: Equatable, Sendable {
        /// The AI agrees with the current category.
        case agrees
        /// Another category, with its confidence as a whole percentage.
        case proposes(categoryId: String, percent: Int)
        /// No category: the message source and whether to point to the setting.
        case message(source: String, offersSettings: Bool)
    }

    /// TX-068: turns a server answer into what the detail shows. An `ok` answer naming a category the movement cannot take
    /// (unknown or not selectable) counts as no answer.
    public static func aiAnswer(_ result: SingleSuggestion, currentCategoryId: String?, selectableIds: Set<String>) -> AiAnswer {
        if result.status == "ok" {
            if let id = result.categoryId, selectableIds.contains(id) {
                return id == currentCategoryId ? .agrees : .proposes(categoryId: id, percent: CategorizationText.confidencePercent(result.confidence))
            }
            return .message(source: aiNoAnswerSource("failed")!, offersSettings: false)
        }
        return .message(source: aiNoAnswerSource(result.status)!, offersSettings: result.status == "disabled")
    }

    /// The answer shown without calling the server when the assistant is switched off in Settings.
    public static var aiOff: AiAnswer { .message(source: aiNoAnswerSource("disabled")!, offersSettings: true) }
}
