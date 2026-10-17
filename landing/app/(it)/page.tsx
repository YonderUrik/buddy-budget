import type { Metadata } from "next";
import { HomePage } from "@/components/home/home-page";
import { LangHint } from "@/components/lang-hint";
import { CLOSE, HOME_IT } from "@/content/home";
import { EN_PATHS, languageAlternates } from "@/content/locales";
import { CONTENT_PATHS } from "@/content/seo-pages";

export const metadata: Metadata = {
  alternates: languageAlternates("/", "it"),
};

/** Texts of the «also available in English» line: in English, for whoever does not read Italian. */
const LANG_HINT = { text: "This page is also available in English", dismiss: "Dismiss" } as const;

/** Italian home; sections and texts in `HomePage` and `content/home.ts`. */
export default function Page() {
  return (
    <HomePage
      content={HOME_IT}
      secondary={{ href: CONTENT_PATHS.strumenti, label: CLOSE.tools }}
      before={<LangHint href={EN_PATHS.home} text={LANG_HINT.text} dismiss={LANG_HINT.dismiss} />}
    />
  );
}
