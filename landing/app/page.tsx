import { Answers } from "@/components/answers";
import { Closing } from "@/components/closing";
import { Faq } from "@/components/faq";
import { FeaturesSection } from "@/components/features-section";
import { Hero } from "@/components/hero";
import { Security } from "@/components/security";
import { SiteNav } from "@/components/site-nav";
import { ToolsSection } from "@/components/tools-section";

export default function HomePage() {
  return (
    <>
      <SiteNav />
      <main>
        <Hero />
        <Answers />
        <FeaturesSection />
        <Security />
        <ToolsSection />
        <Faq />
        <Closing />
      </main>
    </>
  );
}
