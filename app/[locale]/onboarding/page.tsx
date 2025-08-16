import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getDictionary, Locale } from "@/lib/dictionaries";
import { siteConfig, defaultCategories } from "@/config/site";
import { Card, CardBody, CardFooter, CardHeader } from "@heroui/card";
import { OnboardingStepperForm } from "@/components/onboarding/stepper-form";

export default async function OnboardingPage({ params }: { params: { locale: string } }) {
  const session = await getSession();
  const { locale } = await params;
  if (!session?.user) redirect(`/${locale}/auth`);
  const user = session.user as any;
  if (user.onboarded) redirect(`/${locale}/dashboard`);

  const dict = await getDictionary(locale as Locale);

  async function completeOnboarding(formData: FormData) {
    "use server";
    const s = await getSession();
    const su = s?.user as any;
    if (!su?.id) return;
    const ageRaw = (formData.get("age") as string) || "";
    const country = (formData.get("country") as string) || undefined;
    const primaryCurrency = (formData.get("primaryCurrency") as string) || undefined;
    const discovery = (formData.get("discovery") as string) || undefined;
    const experienceLevel = (formData.get("experienceLevel") as string) || undefined;
    const primaryGoal = (formData.get("primaryGoal") as string) || undefined;
    const netWorthRaw = (formData.get("netWorth") as string) || "";
    const expectations = (formData.get("expectations") as string) || undefined;

    const age = ageRaw ? parseInt(ageRaw, 10) : undefined;
    const netWorth = netWorthRaw ? parseFloat(netWorthRaw) : undefined;

    // Precompute localized category payloads
    const dictForCategories = await getDictionary(locale as Locale);
    const localizedCategoryData = defaultCategories.map((c) => ({
      name: ((dictForCategories as any)?.categories && (dictForCategories as any).categories[c.name]) || c.name,
      icon: c.icon,
      color: c.color,
      type: c.type,
    }));

    // Single atomic transaction: update user and insert missing default categories
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: su.id as string },
        data: {
          onboarded: true,
          age,
          country,
          primaryCurrency,
          discovery,
          experienceLevel,
          primaryGoal,
          netWorth,
          expectations,
        },
      });

      const existing = await (tx as any).category.findMany({
        where: { userId: su.id as string },
        select: { name: true },
      });
      const existingNames = new Set<string>(existing.map((e: any) => e.name));
      const toCreate = localizedCategoryData
        .filter((c) => !existingNames.has(c.name))
        .map((c) => ({ ...c, userId: su.id as string }));

      if (toCreate.length > 0) {
        await (tx as any).category.createMany({ data: toCreate });
      }
    });
    redirect(`/${locale}/dashboard`);
  }

  return (
    <section className="relative min-h-dvh w-full overflow-y-auto bg-background px-4 py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-70 blur-3xl"
        style={{
          background:
            "radial-gradient(900px 300px at 85% 0%, hsl(var(--heroui-primary)) 0%, transparent 60%), radial-gradient(1000px 500px at 10% 10%, hsl(var(--heroui-secondary)) 0%, transparent 60%)",
        }}
      />
      <div className="mx-auto max-w-xl">
        <Card className="w-full border border-default-200/60 bg-background/60 backdrop-blur-xl shadow-large">
          <CardHeader className="flex flex-col items-start gap-2 px-5 pt-5 sm:px-6 sm:pt-6">
            <p className="text-xs font-medium uppercase tracking-widest text-primary">
            {dict.onboarding?.titleBefore} {siteConfig.name}
            </p>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              {dict.onboarding?.hello}
              <span className="ml-2 bg-gradient-to-tr from-primary to-secondary bg-clip-text text-transparent">
                {user?.name?.split(" ")[0]}
              </span>
            </h1>
            <p className="text-foreground-500">
              {dict.onboarding?.description}
            </p>
          </CardHeader>

          <CardBody className="px-5 pb-2 pt-0 sm:px-6">
            <OnboardingStepperForm dict={dict as any} onSubmit={completeOnboarding} />
          </CardBody>

          <CardFooter className="flex flex-col items-stretch gap-3 px-5 pb-5 pt-2 sm:px-6 sm:pb-6" />
        </Card>
      </div>
    </section>
  );
}


