import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import Psd2CallbackClient from "./client";

export default async function Psd2CallbackPage({ params }: { params: { locale: string } }) {
  const { locale } = await params;
  const session = await getSession();
  if (!session?.user) redirect(`/${locale}/auth`);
  const user = session.user as any;
  if (!user.onboarded) redirect(`/${locale}/onboarding`);

  return <Psd2CallbackClient locale={locale} />;
}


