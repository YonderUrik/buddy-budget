import { Faq } from "@/components/faq";
import { Closing } from "@/components/closing";
import { Comparison } from "@/components/comparison";
import { FeaturesSection } from "@/components/features-section";
import { HeadingReveals } from "@/components/heading-reveals";
import { Numbers } from "@/components/numbers";
import { Hero } from "@/components/hero";
import { ProductTour } from "@/components/product-tour";
import { Security } from "@/components/security";
import { ScreenGallery } from "@/components/screen-gallery";
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
        <Numbers />
        <ProductTour />
        <ScreenGallery />
        <FeaturesSection />
        <Comparison />
        <Security />
        <Faq />
        <Closing />
      </main>
    </>
  );
}
