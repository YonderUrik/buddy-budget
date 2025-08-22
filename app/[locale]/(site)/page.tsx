import { getDictionary, Locale } from "@/lib/dictionaries";
import { HeroSection } from "@/components/sections/hero";
import { FeaturesSection } from "@/components/sections/features";
import { CTASection } from "@/components/sections/cta";
import { HowItWorksSection } from "@/components/sections/how-it-works";
import { FAQSection } from "@/components/sections/faq";
import { TrustedBySection } from "@/components/sections/trusted";
import { PricingSection } from "@/components/sections/pricing";

export default async function Home({
  params,
}: {
  params: { locale: string };
}) {
  const { locale } = await params;

  const dict = await getDictionary(locale as Locale);

  return (
    <>
      <HeroSection dict={dict} />
      <FeaturesSection dict={dict} />
      <TrustedBySection />
      <HowItWorksSection dict={dict} />
      <PricingSection dict={dict} />
      <FAQSection dict={dict} />
      <CTASection dict={dict} />
    </>
  );
}
