"use client";

/** Risposte rapide a comparsa (un elemento `details` per domanda, accessibile da tastiera). Traccia quale domanda viene aperta. */

import { track } from "@/lib/analytics";
import { FAQ_ITEMS, type FaqItem } from "./faq.data";

export interface FaqListProps {
  items?: readonly FaqItem[];
}

export function FaqList({ items = FAQ_ITEMS }: FaqListProps) {
  return (
    <ul className="divide-y divide-border border-y border-border">
      {items.map((item) => (
        <li key={item.id}>
          <details
            className="group py-3"
            onToggle={(event) => {
              if (event.currentTarget.open) track("support_faq_opened", { id: item.id });
            }}
          >
            <summary className="flex min-h-9 cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium text-foreground [&::-webkit-details-marker]:hidden">
              {item.question}
              <span aria-hidden="true" className="text-muted-foreground transition-transform group-open:rotate-45">+</span>
            </summary>
            <p className="pt-2 pr-6 text-sm text-muted-foreground">{item.answer}</p>
          </details>
        </li>
      ))}
    </ul>
  );
}
