import { Closing } from "@/components/closing";
import { Comparison } from "@/components/comparison";
import { FeaturesSection } from "@/components/features-section";
import { Founder } from "@/components/founder";
import { Hero } from "@/components/hero";
import { ProductTour } from "@/components/product-tour";
import { SiteNav } from "@/components/site-nav";
import { Story } from "@/components/story";

export default function HomePage() {
  return (
    <>
      <SiteNav />
      <main>
        <Hero />
        <Story />
        <ProductTour />
        <FeaturesSection />
        <Comparison />
        <Founder />
        <Closing />
      </main>
    </>
  );
}
