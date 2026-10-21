import { rulesTexts, type ByRules, type RulesNoteText } from "@/lib/visitor-country";

export type { RulesNoteText };

/**
 * A text that changes with the visitor's product rules (`ByRules`): a plain string when it never changes, otherwise
 * one `<span data-variant>` per version, and the CSS of `globals.css` shows the visitor's one before the first paint.
 */
export function ByRulesText({ text }: { text: ByRules }) {
  const parts = rulesTexts(text);
  if (parts.length === 1) return <>{parts[0].text}</>;
  return (
    <>
      {parts.map((p) => (
        <span key={p.variants.join("-")} data-variant={p.variants.join(" ")}>
          {p.text}
        </span>
      ))}
    </>
  );
}

/** One line, only for visitors whose country lacks what a hidden block needed: what is missing and that it is coming. */
export function RulesNote({ text, className }: { text: RulesNoteText; className?: string }) {
  const cls = `rules-note${className ? ` ${className}` : ""}`;
  if (text.de === text.none) return <p className={cls} data-variant="de none">{text.none}</p>;
  return (
    <>
      {text.de ? <p className={cls} data-variant="de">{text.de}</p> : null}
      <p className={cls} data-variant="none">{text.none}</p>
    </>
  );
}
