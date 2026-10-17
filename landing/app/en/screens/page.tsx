import type { Metadata } from "next";
import { ContentPage } from "@/components/content-page";
import { JsonLd } from "@/components/json-ld";
import { ScreenGallery } from "@/components/screen-gallery";
import { EN_PATHS, languageAlternates } from "@/content/locales";
import { SITE_URL } from "@/content/site";

const TITLE = "BuddyBudget screens: accounts, investments, pension and debts";
const DESCRIPTION = "Every screen of the app, area by area. They are screenshots of the real app with made-up sample data.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: languageAlternates(EN_PATHS.screens, "en"),
};

/** English screen gallery; labels and captions from `content/screen-text.ts`. */
export default function Page() {
  return (
    <ContentPage
      title="The app's screens"
      lead="Screenshots of the real app, with the data of a made-up person. Pick an area and a screen."
      current={EN_PATHS.screens}
      locale="en"
      wide
      disclaimer={false}
      crumbs={[{ href: EN_PATHS.home, label: "BuddyBudget" }, { label: "Screens" }]}
      ctaTitle="See them with your own numbers."
      ctaText="Sign in with an email link or with Google and connect your accounts: no password to remember."
      ctaLocation="schermate"
    >
      <JsonLd data={{ "@context": "https://schema.org", "@type": "WebPage", name: TITLE, description: DESCRIPTION, url: `${SITE_URL}${EN_PATHS.screens}`, inLanguage: "en" }} />
      <ScreenGallery phoneOnMobile locale="en" label="Screens of the app" />
    </ContentPage>
  );
}
