import "./blur-words.css";
import type { CSSProperties, ElementType } from "react";

export interface BlurWordsProps {
  children: string;
  /** Elemento da usare (es. `h1`). */
  as?: ElementType;
  className?: string;
  /** Ritardo tra una parola e l'altra, in millisecondi. */
  stepMs?: number;
}

/**
 * Titolo che entra parola per parola emergendo dalla sfocatura. Solo CSS: le parole sono già nell'HTML (nessun salto
 * all'idratazione, testo indicizzabile), l'animazione parte al caricamento e con `prefers-reduced-motion` non c'è.
 * Idea di Text Animate di Magic UI (MIT).
 */
export function BlurWords({ children, as: Tag = "span", className, stepMs = 70 }: BlurWordsProps) {
  const words = children.split(" ");
  return (
    <Tag className={className}>
      {words.map((word, index) => (
        <span key={`${word}-${index}`} className="blur-word" style={{ "--blur-delay": `${index * stepMs}ms` } as CSSProperties}>
          {word}
          {index < words.length - 1 ? " " : ""}
        </span>
      ))}
    </Tag>
  );
}
