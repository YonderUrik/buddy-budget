/** Quick answers shown in «Aiuto», before the form: the help articles «Cerca» also answers from (`lib/help`). */

import { HELP_ARTICLES, type HelpArticle } from "@/lib/help";

export type FaqItem = Pick<HelpArticle, "id" | "question" | "answer">;

export const FAQ_ITEMS: readonly FaqItem[] = HELP_ARTICLES;
