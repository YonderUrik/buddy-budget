import { ToolsSection } from "@/components/tools-section";
import { Faq } from "@/components/faq";
import { Closing } from "@/components/closing";
import { FeaturesSection } from "@/components/features-section";
import { HeadingReveals } from "@/components/heading-reveals";
import { Hero } from "@/components/hero";
import { ProductTour } from "@/components/product-tour";
import { Security } from "@/components/security";
import { SiteNav } from "@/components/site-nav";
import { Story } from "@/components/story";

export default function HomePage() {
  return (
    <>
      <SiteNav />
      <HeadingReveals />
      <main>
        <Hero />
        <Story />
        <ProductTour />
        <FeaturesSection />
        <Security />
        <ToolsSection />
        <Faq />
        <Closing />
      </main>
    </>
  );
}
