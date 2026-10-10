import { Answers } from "@/components/answers";
import { Closing } from "@/components/closing";
import { Compare } from "@/components/compare";
import { Faq } from "@/components/faq";
import { FeaturesSection } from "@/components/features-section";
import { Fit } from "@/components/fit";
import { Groups } from "@/components/groups";
import { Hero } from "@/components/hero";
import { ItalyRules } from "@/components/italy-rules";
import { OpenSource } from "@/components/open-source";
import { Security } from "@/components/security";
import { SiteNav } from "@/components/site-nav";
import { Steps } from "@/components/steps";

/** Home: cosa fa e come si parte, le domande con le risposte vere, il vantaggio italiano, il metodo, fiducia e confronto. */
export default function HomePage() {
  return (
    <>
      <SiteNav />
      <main>
        <Hero />
        <Steps />
        <Answers />
        <ItalyRules />
        <Groups />
        <FeaturesSection />
        <Security />
        <OpenSource />
        <Fit />
        <Compare />
        <Faq />
        <Closing />
      </main>
    </>
  );
}
