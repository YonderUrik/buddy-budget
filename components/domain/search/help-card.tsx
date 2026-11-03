"use client";

/**
 * The answer to a «how do I…» question in «Cerca»: the AI's short answer written from the guide, or the guide's own answer
 * when the rules found it, then the guide's articles it comes from (a tap shows one in place), the way to do it (the page
 * or the «Aggiungi» form) and «Scrivici» when nothing fits. The articles are always ours, so an AI answer can be checked.
 */

import * as React from "react";
import { ArrowRightIcon, LifeBuoyIcon, SparklesIcon } from "lucide-react";
import { helpArticle, type HelpArticle } from "@/lib/help";
import { useLocalization } from "@/lib/localization/provider";
import type { SearchHit } from "@/lib/search/types";
import { cn } from "@/lib/utils";
import { SPOTLIGHT_CARD } from "./spotlight-style";

type HelpAnswer = Extract<NonNullable<SearchHit["answer"]>, { kind: "aiuto" }>;

export interface HelpCardProps {
  hit: SearchHit & { answer: HelpAnswer };
  selected: boolean;
  phone?: boolean;
  id: string;
  /** Does what an article says: its page or its «Aggiungi» form. */
  onOpenArticle: (article: HelpArticle) => void;
  /** «Scrivici»: the Aiuto page with the form. */
  onWriteUs: () => void;
  onHover?: () => void;
}

/** Label of the button that does what the article says. */
const actionLabel = (article: HelpArticle) => (article.quickAdd ? "Apri il modulo" : "Vai alla pagina");

export function HelpCard({ hit, selected, phone = false, id, onOpenArticle, onWriteUs, onHover }: HelpCardProps) {
  const { t: tr } = useLocalization();
  const articles = hit.answer.articles.map((articleId) => helpArticle(articleId)).filter((a): a is HelpArticle => a !== undefined);
  // The article shown in full: none while the AI's answer is on screen, the first one for the rules.
  const [open, setOpen] = React.useState<string | null>(hit.answer.text ? null : (articles[0]?.id ?? null));
  const shown = open ? articles.find((a) => a.id === open) : undefined;
  const action = shown ?? articles[0];
  const lit = selected && !phone;
  const ai = hit.answer.text !== null;
  return (
    <div role="option" id={id} aria-selected={selected} onMouseMove={onHover} className={cn("flex flex-col gap-3 transition-colors duration-100", phone ? cn("rounded-3xl p-3", SPOTLIGHT_CARD) : cn("rounded-2xl p-2", lit ? "bg-spotlight-lit" : "bg-foreground/[0.04]"))}>
      <div className="flex flex-col gap-1.5 px-2 pt-1">
        {ai ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-text-3">
            <SparklesIcon className="size-3.5" aria-hidden="true" />
            {tr("Scritta dall'AI con la guida")}
          </span>
        ) : null}
        {shown ? <span className="text-[15px] font-medium leading-snug">{tr(shown.question)}</span> : null}
        <p className="text-sm leading-relaxed text-text-2">{shown ? tr(shown.answer) : hit.answer.text}</p>
        {action && (action.href || action.quickAdd) ? (
          <button type="button" tabIndex={-1} onClick={() => onOpenArticle(action)} className="mt-1 inline-flex min-h-9 w-fit cursor-pointer items-center gap-1.5 rounded-full bg-foreground/[0.07] px-3.5 text-sm font-medium hover:bg-foreground/10">
            {tr(actionLabel(action))}
            <ArrowRightIcon className="size-3.5" aria-hidden="true" />
          </button>
        ) : null}
      </div>
      {articles.length > (shown && !ai ? 1 : 0) ? (
        <div className="flex flex-col px-2">
          <span className="pb-1 text-xs text-text-3">{tr(ai ? "Dalla guida" : "Altre risposte")}</span>
          <ul className="flex flex-col">
            {articles
              .filter((article) => ai || article.id !== open)
              .map((article) => (
                <li key={article.id}>
                  <button
                    type="button"
                    tabIndex={-1}
                    aria-pressed={article.id === open}
                    onClick={() => setOpen(article.id === open && ai ? null : article.id)}
                    className={cn("flex w-full cursor-pointer items-center gap-2 rounded-xl px-2 text-left text-sm hover:bg-foreground/5", phone ? "min-h-11 py-1.5" : "min-h-9 py-1", article.id === open && "font-medium")}
                  >
                    <LifeBuoyIcon className="size-3.5 shrink-0 text-text-3" aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate">{tr(article.question)}</span>
                  </button>
                </li>
              ))}
          </ul>
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-2 pb-1 text-xs text-text-3">
        {ai ? <span>{tr("L'AI può sbagliare: sotto trovi le risposte della guida")}</span> : null}
        <button type="button" tabIndex={-1} onClick={onWriteUs} className="cursor-pointer underline-offset-2 hover:underline">
          {tr("Non è quello che cercavi? Scrivici")}
        </button>
        {!phone && action && (action.href || action.quickAdd) ? <span className="ml-auto">{tr(action.quickAdd ? "⏎ apre il modulo" : "⏎ va alla pagina")}</span> : null}
      </div>
    </div>
  );
}
