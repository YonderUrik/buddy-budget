import type { Metadata } from "next";
import { ContentPage } from "@/components/content-page";
import { JsonLd, pageJsonLd } from "@/components/json-ld";
import { ScreenGallery } from "@/components/screen-gallery";
import { EN_PATHS, languageAlternates } from "@/content/locales";
import { pageMetadata } from "@/lib/page-metadata";

const TITLE = "BuddyBudget screens: accounts, investments and debts";
const DESCRIPTION = "Every screen of the app, area by area: accounts, transactions, investments, pension and debts. Screenshots of the real app with made-up sample data.";

export const metadata: Metadata = pageMetadata("en", {
  title: TITLE,
  description: DESCRIPTION,
  alternates: languageAlternates(EN_PATHS.screens, "en"),
});

/** English screen gallery; labels and captions from `content/screen-text.ts`. */
export default function Page() {
  return (
    <ContentPage
      title="The app's screens"
      lead="Screenshots of the real app. Pick an area and a screen."
      current={EN_PATHS.screens}
      locale="en"
      wide
      disclaimer={false}
      crumbs={[{ href: EN_PATHS.home, label: "BuddyBudget" }, { label: "Screens" }]}
      ctaTitle="See them with your own numbers."
      ctaText="Sign in with an email link or with Google and connect your accounts: no password to remember."
      ctaLocation="schermate"
    >
      <JsonLd data={pageJsonLd({ locale: "en", path: EN_PATHS.screens, title: TITLE, description: DESCRIPTION })} />
      <ScreenGallery phoneOnMobile locale="en" label="Screens of the app" />
    </ContentPage>
  );
}
