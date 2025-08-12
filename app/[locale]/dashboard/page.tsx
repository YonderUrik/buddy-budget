import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function DashboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const session = await getSession();
  const {locale} = await params;
  if (!session?.user) redirect(`/${locale}/auth`);
  const user = session.user as any;
  if (!user.onboarded) redirect(`/${locale}/onboarding`);

  return (
    <div className="container mx-auto max-w-5xl py-10">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <p className="text-default-500 mt-2">Plan: {user.plan}</p>
    </div>
  );
}


