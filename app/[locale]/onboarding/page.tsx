import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export default async function OnboardingPage({ params }: { params: { locale: string } }) {
  const session = await getSession();
  const {locale} = await params;
  if (!session?.user) redirect(`/${locale}/auth`);
  const user = session.user as any;
  if (user.onboarded) redirect(`/${locale}/dashboard`);

  async function completeOnboarding() {
    "use server";
    const s = await getSession();
    if (!s?.user?.id) return;
    await prisma.user.update({ where: { id: s.user.id as string }, data: { onboarded: true } });
    redirect(`/${locale}/dashboard`);
  }

  return (
    <div className="container mx-auto max-w-xl py-10">
      <h1 className="text-2xl font-semibold mb-4">Welcome to Buddy Budget</h1>
      <p className="text-default-600 mb-8">Let's set up your account to get started.</p>
      <form action={completeOnboarding}>
        <button className="px-4 py-2 rounded-medium bg-foreground text-background" type="submit">
          Complete onboarding
        </button>
      </form>
    </div>
  );
}


